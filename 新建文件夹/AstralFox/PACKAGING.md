# AstralFox 全离线 AI 引擎 — 打包与部署指南

> 星尘狐桌面宠物 Phase 3 最终形态：无需安装 Python、Unity Hub 或任何其他软件，运行单个 exe 即可使用全离线 AI。

---

## 架构概览

```
AstralFox.exe (Unity Build)
├── StreamingAssets/
│   ├── funasr/
│   │   ├── funasr_server.exe     # FunASR 语音识别 (PyInstaller)
│   │   └── models/               # paraformer-large 模型
│   ├── tts/
│   │   ├── tts_server.exe        # sherpa-onnx TTS (PyInstaller)
│   │   └── models/               # vits-melo-zh 模型
│   └── models/
│       └── qwen2.5-7b-instruct-q4_k_m.gguf  # Qwen2.5 量化模型
│
├── AstralFox_Data/
│   └── Managed/
│       └── LLMUnity.dll          # llama.cpp Unity 绑定
│
└── UnityPlayer.dll               # Unity 运行时
```

启动流程：
1. Unity 启动 → AIManager 检测服务状态
2. `funasr_server.exe` 启动 → 端口 8766 → 健康检查
3. `tts_server.exe` 启动 → 端口 8767 → 健康检查
4. LLMUnity 加载 GGUF 模型 → 内存中推理
5. 所有服务就绪 → `VoiceManager` 开始监听唤醒词

---

## 1. 构建 Python 服务 (PyInstaller)

### 1.1 FunASR (语音识别)

**环境准备：**
```bash
# 创建虚拟环境 (推荐)
python -m venv funasr_env
funasr_env\Scripts\activate  # Windows
source funasr_env/bin/activate  # macOS/Linux

# 安装依赖
pip install funasr soundfile numpy scipy pyinstaller modelscope
```

**下载模型：**
```bash
cd Assets/StreamingAssets/funasr
python -c "from modelscope import snapshot_download; snapshot_download('iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch', cache_dir='models')"
```

**构建 exe：**
```bash
# 运行构建脚本
build_exe.bat

# 或手动构建
pyinstaller --onefile \
    --name funasr_server \
    --add-data "models;models" \
    --hidden-import funasr \
    --hidden-import funasr.models \
    --hidden-import funasr.utils \
    --hidden-import soundfile \
    --hidden-import numpy \
    --hidden-import scipy \
    --hidden-import scipy.signal \
    --collect-all funasr \
    --clean \
    funasr_server.py

# 输出: dist/funasr_server.exe (~800MB with model)
```

### 1.2 TTS (语音合成)

**环境准备：**
```bash
pip install sherpa-onnx pyinstaller
```

**下载模型：**
```bash
cd Assets/StreamingAssets/tts

# 下载 vits-melo-zh 模型
# 从 https://github.com/k2-fsa/sherpa-onnx/releases 下载最新版本
# 解压到 models/vits-melo-zh/
# 确保包含: model.onnx, tokens.txt, lexicon.txt
```

**构建 exe：**
```bash
build_exe.bat

# 输出: dist/tts_server.exe (~400MB with model)
```

---

## 2. LLM 模型准备

### 2.1 下载 Qwen2.5 GGUF

```bash
cd Assets/StreamingAssets/models/

# 推荐: Qwen2.5-7B-Instruct Q4_K_M (4-bit 量化, ~4.4GB)
# 下载地址: https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF
# 文件名: qwen2.5-7b-instruct-q4_k_m.gguf

# 备选: Qwen2.5-1.5B-Instruct Q4_K_M (~1GB, 低配机型)
# 文件名: qwen2.5-1.5b-instruct-q4_k_m.gguf
```

### 2.2 安装 LLMUnity

1. 在 Unity 中打开 Package Manager
2. 添加包: `https://github.com/undreamai/LLMUnity.git`
3. 在 Player Settings → Scripting Define Symbols 添加: `LLMUNITY_PRESENT`
4. 将 AimManager GameObject 上的 LLMService 组件的 Model Path 指向 GGUF 文件

---

## 3. Unity 构建设置

### 3.1 Player Settings

| 设置 | 值 |
|------|-----|
| Scripting Backend | IL2CPP (推荐) 或 Mono |
| API Compatibility | .NET Framework 或 .NET Standard 2.1 |
| Scripting Define Symbols | `LLMUNITY_PRESENT` |
| Allow 'unsafe' code | ✓ (LLMUnity 需要) |

### 3.2 StreamingAssets 目录结构

```
Assets/StreamingAssets/
├── funasr/
│   ├── funasr_server.exe
│   └── models/
│       └── paraformer-large/
│           ├── config.yaml
│           ├── am.mvn
│           └── model.pt
├── tts/
│   ├── tts_server.exe
│   └── models/
│       └── vits-melo-zh/
│           ├── model.onnx
│           ├── tokens.txt
│           └── lexicon.txt
└── models/
    └── qwen2.5-7b-instruct-q4_k_m.gguf
```

### 3.3 构建步骤

1. **Build Settings** → Target: Windows/macOS/Linux
2. **Architecture**: x86_64 (Intel/AMD)
3. 确保所有 StreamingAssets 文件已就位
4. Build → 输出 `AstralFox.exe`

---

## 4. 部署测试

### 4.1 干净环境测试

在干净的 Windows 10/11 机器上测试：

1. **不需要**安装 Python
2. **不需要**安装 Unity Hub
3. **不需要**安装 CUDA 或任何 AI 框架
4. 只需复制构建输出文件夹到目标机器
5. 双击 `AstralFox.exe` 运行

### 4.2 验证清单

- [ ] 启动 AstralFox.exe
- [ ] AIManager 显示 "全离线 AI 引擎就绪"
- [ ] FunASR: 说"你好星尘" → 控制台显示转录文本
- [ ] LLM: 收到回复文本（带 [emotion] 标签）
- [ ] TTS: 听到星尘狐语音回复
- [ ] Wake Word: 说"星尘"触发唤醒
- [ ] 长对话: 10+ 轮对话无崩溃
- [ ] 内存: 总内存使用 < 8GB（7B 模型）
- [ ] CPU: 空闲时 CPU 使用率 < 5%

### 4.3 已知问题

| 问题 | 影响 | 解决 |
|------|------|------|
| 首次启动 Python exe 慢 | 可能 10-30s | 正常现象，PyInstaller 解压 |
| 7B 模型需要 8GB+ RAM | 低配机器 | 使用 1.5B 模型替代 |
| Windows Defender 可能拦截 exe | 误报 | 添加排除或签名 |
| CPU 推理较慢 (7B: 2-5 tok/s) | 回复延迟 | 使用 GPU 推理或 1.5B 模型 |

---

## 5. 性能参考

| 组件 | 启动时间 | 推理时间 | 内存占用 |
|------|---------|---------|---------|
| funasr_server.exe | 5-15s | 0.5-2s | ~1.5GB |
| tts_server.exe | 3-8s | 1-3s | ~500MB |
| LLMUnity (7B Q4) | 10-30s | 5-20s | ~5GB |
| LLMUnity (1.5B Q4) | 3-8s | 1-5s | ~1.5GB |
| Unity + Live2D | 即时 | N/A | ~800MB |

---

## 6. 降级策略

当某个服务不可用时，系统会自动降级：

| 场景 | 行为 |
|------|------|
| FunASR 不可用 | 使用文本输入模式，用户打字交流 |
| LLM 不可用 | 使用内置 fallback 回复（38 种模式匹配） |
| TTS 不可用 | 仅显示文字回复，不播放语音 |
| 所有服务不可用 | 显示设置向导，引导用户下载模型 |

---

## 7. 文件大小估算

| 组件 | 大小 |
|------|------|
| funasr_server.exe + 模型 | ~800MB |
| tts_server.exe + 模型 | ~400MB |
| Qwen2.5-7B Q4_K_M GGUF | ~4.4GB |
| Unity Build (IL2CPP) | ~300MB |
| Live2D 模型资源 | ~50MB |
| **总计** | **~6GB** |

使用 1.5B 模型可将总大小降至 ~3GB。
