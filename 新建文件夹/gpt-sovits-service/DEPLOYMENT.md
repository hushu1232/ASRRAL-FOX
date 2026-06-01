# GPT-SoVITS 音色自定义 — 部署与使用指南

## 概述

AstralFox 桌面宠物支持双引擎 TTS 方案：

| 引擎 | 类型 | 特点 | 部署要求 |
|------|------|------|----------|
| **sherpa-onnx** | 本地离线 | 快速、低延迟、无需网络 | 预装在桌宠 StreamAssets 中 |
| **GPT-SoVITS** | 远程 GPU | 自定义音色、声音克隆 | Docker + NVIDIA GPU |

---

## 1. 系统架构

```
Unity 桌面客户端
  └── TTSService.cs (引擎切换)
        │
        ├── sherpa-onnx (本地): tts_server.exe → 直接返回 WAV
        │
        └── gpt-sovits (远程): HTTP → Next.js BFF (:3000)
              └── /api/tts/synthesize
                    │
                    ├── engine=sherpa-onnx: 返回 JSON → 桌宠本地合成
                    └── engine=gpt-sovits:  代理 → GPT-SoVITS (:8002) → WAV
```

**容错机制**：GPT-SoVITS 不可达时，Unity 客户端自动降级到本地 sherpa-onnx。

---

## 2. 部署步骤

### 2.1 前提条件

- **NVIDIA GPU**（6GB+ 显存推荐） + NVIDIA Container Toolkit
- Docker Compose v2+
- 已克隆 GPT-SoVITS 仓库并下载预训练模型

### 2.2 下载 GPT-SoVITS 预训练模型

```bash
# 克隆仓库
git clone https://github.com/RVC-Boss/GPT-SoVITS.git /opt/gpt-sovits

# 下载预训练模型（二选一）
# 方式 A: 使用 GPT-SoVITS 自带脚本
cd /opt/gpt-sovits
python tools/download_models.py

# 方式 B: 手动下载并解压到 pretrained_models/
wget https://huggingface.co/lj1995/GPT-SoVITS/resolve/main/gsv-v2final-pretrained/s1bert25hz-2kh-longer-epoch=68e-step=50232.ckpt \
  -O /opt/gpt-sovits/pretrained_models/s1bert25hz-2kh-longer-epoch=68e-step=50232.ckpt
wget https://huggingface.co/lj1995/GPT-SoVITS/resolve/main/gsv-v2final-pretrained/s2G488k.pth \
  -O /opt/gpt-sovits/pretrained_models/s2G488k.pth
```

### 2.3 构建并启动

```bash
# 在 avatar-web-management 目录下

# 构建 gpt-sovits 镜像（首次约 10-20 分钟）
docker compose build gpt-sovits

# 启动全部服务（含 GPU 服务）
docker compose --profile gpu up -d

# 查看日志
docker compose logs -f gpt-sovits

# 验证健康
curl http://localhost:8002/health
# → {"status":"ok","service":"gpt-sovits","version":"1.0.0","device":"cuda"}
```

### 2.4 环境变量

在 `avatar-web-management/.env` 中配置：

```env
# GPT-SoVITS 服务地址（默认 localhost:8002）
GPT_SOVITS_URL=http://localhost:8002
```

## 3. 声音克隆使用指南

### 3.1 录音准备

在录制参考音频前，请遵循以下建议：

1. **环境**：安静的房间，关闭风扇、空调等噪音源
2. **设备**：使用指向性麦克风，避免使用笔记本内置麦克风
3. **内容**：
   - 长度 1-5 分钟（至少 30 秒有效语音）
   - 用正常语速、自然音量说话
   - 避免唱歌、喊叫、耳语等特殊发声
   - 包含日常对话的自然停顿和语调变化
4. **格式**：WAV（推荐）/ MP3 / OGG / FLAC，16kHz+

### 3.2 启动训练

1. 打开 Web 管理后台 → 桌宠 → 自定义音色
2. **步骤 1**：拖拽上传录音样本，输入音色名称
3. **步骤 2**：点击"开始训练"，观察进度条
4. **步骤 3**：训练完成后试听，确认后设为桌宠语音

### 3.3 训练时间估算

| 音频长度 | GPU 型号 | 预计时间 |
|----------|----------|----------|
| 1 分钟 | RTX 3060 | ~5 分钟 |
| 3 分钟 | RTX 3060 | ~8 分钟 |
| 5 分钟 | RTX 3060 | ~12 分钟 |
| 1 分钟 | RTX 4090 | ~3 分钟 |
| 5 分钟 | RTX 4090 | ~6 分钟 |

## 4. 客户端配置

### 4.1 桌面端切换到 GPT-SoVITS

在桌宠设置页面（`localhost:18920`）或 Web 管理后台配置：

```json
{
  "tts_engine": "gpt-sovits",
  "gpt_sovits_url": "http://localhost:3000/api/tts",
  "custom_voice_id": ""  // 留空使用默认音色
}
```

### 4.2 验证

1. 桌宠和 Web 管理后台均已启动
2. 修改配置后，点击"同步"按钮
3. 与桌宠对话，观察日志：
   - `[TTS:gpt-sovits]` 前缀 = 使用 GPT-SoVITS
   - `[TTS:sherpa-onnx]` 前缀 = 降级到本地引擎

## 5. 故障排查

### GPT-SoVITS 服务不启动

```bash
# 检查 Docker 日志
docker compose logs gpt-sovits

# 常见问题：
# - "CUDA not available" → 安装 NVIDIA Container Toolkit
# - "Model not found" → 检查 pretrained_models 目录
# - "Port 8002 already in use" → 修改 GPT-SOVITS_PORT 环境变量
```

### 训练失败

```bash
# 检查音频格式
ffprobe your_audio.wav
# 确认：sample_rate=16000+, channels=1, duration>=30s

# 清理失败任务的残留文件
docker compose exec gpt-sovits rm -rf /app/models/voices/<task_id>
```

### 客户端降级到 sherpa-onnx

这是正常的容错行为。检查：
- GPT-SoVITS Docker 容器是否在运行：`docker compose ps gpt-sovits`
- 网络连通性：`curl http://localhost:8002/health`
- BFF 代理是否正常：`curl http://localhost:3000/api/tts/health`

## 6. 文件清单

```
gpt-sovits-service/
├── Dockerfile                  # GPU 推理镜像
├── requirements.txt            # Python 依赖
└── app/
    ├── main.py                 # FastAPI 入口
    ├── config.py               # 配置（模型路径、GPU设置）
    └── routes/
        ├── __init__.py
        ├── synthesize.py       # POST /synthesize — TTS 合成
        ├── train.py            # POST /train — 声音克隆训练
        └── voices.py           # GET/DELETE /voices — 音色管理

avatar-web-management/
├── docker-compose.yml          # 新增 gpt-sovits 服务
├── prisma/schema.prisma        # PetConfig 新增 ttsEngine/customVoiceId
└── src/
    ├── lib/services/
    │   └── ttsService.ts       # TTS 引擎切换 + GPT-SoVITS HTTP 客户端
    ├── app/api/tts/
    │   ├── synthesize/route.ts # BFF 代理：引擎路由
    │   ├── train/route.ts      # 代理：启动训练
    │   ├── train/[taskId]/status/route.ts  # 代理：训练进度
    │   ├── voices/route.ts     # 代理：音色列表
    │   └── health/route.ts     # 健康检查
    ├── components/pet/
    │   └── VoiceCloningWizard.tsx  # 声音克隆三步向导
    └── app/(auth)/dashboard/pet/voice/
        └── page.tsx            # /dashboard/pet/voice 页面

AstralFox/Unity/
├── Assets/Scripts/Runtime/
│   ├── Config/
│   │   ├── AppConfig.cs        # 新增 tts_engine/gpt_sovits_url/custom_voice_id
│   │   └── PetApiClient.cs     # 同步 TTS 字段
│   └── Voice/
│       └── TTSService.cs       # 双引擎切换 + 自动降级
└── Assets/StreamingAssets/tts/
    └── tts_server.py           # sherpa-onnx 本地引擎（保持不变）
```

## 7. 后续规划

- [ ] 训练队列：多用户排队训练，避免 GPU OOM
- [ ] 模型缓存：训练完毕后自动部署到边缘节点
- [ ] 音色市场：用户可将训练好的音色上架交易
- [ ] 零样本克隆：利用 GPT-SoVITS 的 3 秒音频快速克隆
