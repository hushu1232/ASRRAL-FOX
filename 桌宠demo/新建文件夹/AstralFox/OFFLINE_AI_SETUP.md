# 星尘狐 全离线 AI 引擎 — 搭建指南

> 将 AstralFox 从云端依赖改造为完全离线运行的桌面伴侣

---

## 架构总览

```
┌────────────────────────────────────────────────────┐
│                  Unity Desktop Pet                   │
│                                                      │
│  MicrophoneCapture ─→ VoiceManager ─→ TTSPlayer     │
│         │                 │                ↑         │
│         │           AIManager ─────────────┘         │
│         │          /    |     \                      │
│         │    FunASR   LLMService  TTSService         │
│         │    (HTTP)   (in-proc)    (HTTP)            │
│         └────────┬──────┬──────────┘                 │
│                  │      │                            │
└──────────────────┼──────┼────────────────────────────┘
                   │      │
    ┌──────────────┴──┐   │   ┌──────────────────────┐
    │ funasr_server   │   │   │ tts_server.exe       │
    │ (Python :8766)  │   │   │ (Python :8767)       │
    │ Paraformer-large│   │   │ sherpa-onnx VITS-Melo│
    └─────────────────┘   │   └──────────────────────┘
                           │
                    ┌──────┴──────────────────────────┐
                    │ LLMUnity (in-process)            │
                    │ Qwen2.5-7B-Instruct-Q4_K_M.gguf │
                    └─────────────────────────────────┘
```

---

## 模块清单

### 已完成代码

| 文件 | 功能 | 位置 |
|------|------|------|
| `LocalServiceBase.cs` | Python 子进程管理基类 | `Assets/Scripts/Runtime/Voice/` |
| `FunASRService.cs` | FunASR 语音识别 Unity 客户端 | `Assets/Scripts/Runtime/Voice/` |
| `LLMService.cs` | LLMUnity Qwen2.5 对话服务 | `Assets/Scripts/Runtime/Voice/` |
| `TTSService.cs` | sherpa-onnx TTS Unity 客户端 | `Assets/Scripts/Runtime/Voice/` |
| `AIManager.cs` | 离线 AI 编排器 | `Assets/Scripts/Runtime/Voice/` |
| `VoiceManager.cs` | 双模式（在线/离线）语音管线 | `Assets/Scripts/Runtime/Voice/` |
| `funasr_server.py` | FunASR Python HTTP 服务 | `Assets/StreamingAssets/funasr/` |
| `tts_server.py` | sherpa-onnx Python HTTP 服务 | `Assets/StreamingAssets/tts/` |
| `build_exe.bat` | PyInstaller 打包脚本 | 各 StreamingAssets 子目录 |

---

## 第一步：LLMUnity + Qwen2.5

### 1.1 安装 LLMUnity

1. 打开 Unity Package Manager → "Add package from git URL"
2. 输入: `https://github.com/undreamai/LLMUnity.git`
3. 等待导入完成

### 1.2 下载 Qwen2.5 量化模型

```
# 推荐: Qwen2.5-7B-Instruct-Q4_K_M.gguf (~4.7GB)
# 备选: Qwen2.5-1.5B-Instruct-Q4_K_M.gguf (~1GB, 低配机)
# 下载地址: https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF
```

下载后放入:
```
Assets/StreamingAssets/models/qwen2.5-7b-instruct-q4_k_m.gguf
```

### 1.3 启用编译

在 Unity → Edit → Project Settings → Player → Scripting Define Symbols 添加:
```
LLMUNITY_PRESENT
```

### 1.4 场景配置

在 VoiceManager 所在的 GameObject 上添加 `LLMService` 组件。

---

## 第二步：FunASR 语音识别

### 2.1 安装依赖

```bash
pip install funasr soundfile numpy modelscope pyinstaller
```

### 2.2 下载模型

```bash
cd Assets/StreamingAssets/funasr
mkdir -p models
python -c "from modelscope import snapshot_download; snapshot_download('iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch', cache_dir='models')"
```

模型约 1.2GB，下载到 `models/paraformer-large/`。

### 2.3 打包为 EXE

```bash
cd Assets/StreamingAssets/funasr
build_exe.bat
```

打包后的 `dist/funasr_server.exe` 约 200MB（含 Python 运行时 + 模型）。

### 2.4 放置文件

确保以下结构:
```
Assets/StreamingAssets/funasr/
├── funasr_server.exe
├── funasr_server.py
├── build_exe.bat
└── models/
    └── paraformer-large/
        ├── config.yaml
        ├── model.pt
        └── ...
```

---

## 第三步：sherpa-onnx 语音合成

### 3.1 安装依赖

```bash
pip install sherpa-onnx pyinstaller
```

### 3.2 下载模型

从 [sherpa-onnx releases](https://github.com/k2-fsa/sherpa-onnx/releases) 下载 VITS-Melo-ZH 模型:

```
# 下载 vits-melo-zh.tar.bz2 并解压到:
Assets/StreamingAssets/tts/models/vits-melo-zh/
├── model.onnx
├── tokens.txt
└── lexicon.txt
```

备选模型: `vits-zh-aishell3` (更清晰但情感较少)

### 3.3 打包为 EXE

```bash
cd Assets/StreamingAssets/tts
build_exe.bat
```

### 3.4 放置文件

```
Assets/StreamingAssets/tts/
├── tts_server.exe
├── tts_server.py
├── build_exe.bat
└── models/
    └── vits-melo-zh/
        ├── model.onnx
        ├── tokens.txt
        └── lexicon.txt
```

---

## 第四步：Unity 场景配置

### 4.1 组件挂载

在 VoiceManager 所在的 GameObject 上添加:

| 组件 | 用途 |
|------|------|
| `FunASRService` | 管理 FunASR 子进程 |
| `LLMService` | 本地 LLM 推理 |
| `TTSService` | 管理 TTS 子进程 |
| `AIManager` | 编排协调 |

VoiceManager 会自动检测这些组件。

### 4.2 Inspector 参数

**VoiceManager**:
- `Use Offline Mode`: ✅ 勾选
- `Verbose Logging`: ✅ 勾选（调试阶段）

**LLMService**:
- `Model Path`: `models/qwen2.5-7b-instruct-q4_k_m.gguf`
- `Num Threads`: 4
- `Context Size`: 2048
- `Temperature`: 0.7

**FunASRService / TTSService**:
- `Auto Start`: ✅ 勾选
- 端口默认即可

### 4.3 首次运行

1. 启动 Unity Play Mode
2. 查看 Console 日志:
   ```
   [AIManager] 全离线 AI 引擎就绪
   [VoiceManager] Running in OFFLINE mode (AIManager).
   ```
3. 如果缺少模型/EXE，AIManager 会输出启动向导日志

---

## 第五步：打包部署

### 5.1 Unity Build Settings

- Platform: Windows (Mono 或 IL2CPP)
- Architecture: x86_64
- Compression: LZ4

### 5.2 StreamingAssets 确认

构建前检查 `Assets/StreamingAssets/` 包含:

```
StreamingAssets/
├── funasr/
│   ├── funasr_server.exe       ← PyInstaller 产出
│   └── models/paraformer-large/ ← ASR 模型
├── tts/
│   ├── tts_server.exe          ← PyInstaller 产出
│   └── models/vits-melo-zh/    ← TTS 模型
├── models/
│   └── qwen2.5-7b-instruct-q4_k_m.gguf  ← LLM 模型
├── vosk-model/                 ← 已有（唤醒词检测）
└── settings.html               ← 已有（Web 设置页）
```

### 5.3 预计磁盘占用

| 组件 | 大小 |
|------|------|
| funasr_server.exe + 模型 | ~1.4 GB |
| tts_server.exe + 模型 | ~600 MB |
| Qwen2.5 GGUF | ~4.7 GB |
| Unity Player + Live2D | ~200 MB |
| **总计** | **~7 GB** |

低配方案（换用 1.5B 模型）: ~3 GB

---

## 模式切换

VoiceManager 支持运行时切换:

- **离线模式** (`_useOfflineMode = true`): 使用 AIManager → FunASR + LLMUnity + sherpa-onnx
- **在线模式** (`_useOfflineMode = false`): 使用 BackendClient → Python BFF WebSocket

---

## 降级策略

| 服务状态 | 行为 |
|----------|------|
| ASR 不可用 | AIManager 标记 Degraded，跳过语音识别，LLM 单独可用 |
| LLM 不可用 | 无对话能力，设置页提示安装 LLMUnity |
| TTS 不可用 | 纯文本回复，无语音播放 |
| 全部正常 | 完整离线 AI 体验 |

---

## 测试验证

### 功能测试清单

- [ ] Unity Play Mode 启动，Console 显示 AI 服务就绪
- [ ] 按 F12 模拟唤醒词 → 进入 Listening 状态
- [ ] 对着麦克风说话 → VAD 检测 → Recording → Processing
- [ ] AIManager 日志显示 transcript（语音识别结果）
- [ ] AIManager 日志显示 LLM 回复
- [ ] TTSPlayer 播放语音回复
- [ ] 停止 Python 子进程 → Console 显示降级警告 → 自动重启

### 压力测试

- [ ] 连续对话 10 轮 → 内存/GPU 正常
- [ ] TTS 播放时按 F12 打断 → 正常转入 Listening 状态
- [ ] 低配机型 (8GB RAM) → Qwen2.5-1.5B 模型正常运行

---

## 故障排查

### funasr_server.exe 闪退

检查: Python 环境、模型路径、端口占用
```bash
# 手动运行测试
cd %APPDATA%/../LocalLow/<Company>/AstralFox/funasr/
funasr_server.exe --port 8766 --preload
```

### LLMUnity 模型加载失败

- 确认 .gguf 文件路径正确
- 确认 LLMUNITY_PRESENT define 已添加
- 检查 LLMUnity 版本兼容性

### TTS 播放无声

- 检查 tts_server.exe 是否运行: `curl http://127.0.0.1:8767/health`
- 检查 models/vits-melo-zh/ 文件完整性
- TTSPlayer 的 AudioSource 设置: Volume > 0, Mute = false
