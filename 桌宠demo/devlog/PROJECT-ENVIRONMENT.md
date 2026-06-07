# AstralFox 项目完整环境与依赖文档

> 生成日期: 2026-06-07
> 项目: FOXD Monorepo — AstralFox AI 桌面宠物
> 引擎: Unity 6000.4.10f1 · Cubism SDK 5-r.5 · URP 17.4.0

---

## 目录

1. [Unity 引擎与包依赖](#1-unity-引擎与包依赖)
2. [Python BFF 后端依赖](#2-python-bff-后端依赖)
3. [AI/ML 模型文件](#3-aiml-模型文件)
4. [外部 API 服务与密钥](#4-外部-api-服务与密钥)
5. [Docker 容器编排](#5-docker-容器编排)
6. [Claude Code 开发环境配置](#6-claude-code-开发环境配置)
7. [MCP 服务器配置](#7-mcp-服务器配置)
8. [Skills 技能配置](#8-skills-技能配置)
9. [环境搭建清单](#9-环境搭建清单)

---

## 1. Unity 引擎与包依赖

### 1.1 引擎版本

```
Unity 6000.4.10f1 (feeafc12a938)
模板: cn.tuanjie.template.urp-blank@3.0.3
渲染管线: URP 17.4.0 (UniversalRenderPipeline)
颜色空间: Linear
API 兼容级别: .NET Standard 2.1
```

### 1.2 Package Manager 依赖 (Packages/manifest.json)

| 包名 | 版本 | 说明 |
|------|------|------|
| `com.unity.render-pipelines.universal` | 17.0.4 | URP 渲染管线 |
| `com.unity.nuget.newtonsoft-json` | 3.0.2 | JSON 序列化 |
| `com.unity.ai.navigation` | 1.1.5 | AI 导航 |
| `com.unity.2d.sprite` | 1.0.0 | 2D Sprite |
| `com.unity.ugui` | 1.0.0 | UI 系统 |
| `com.unity.test-framework` | 1.1.33 | 测试框架 |
| `com.unity.burst` | 1.8.29 | (传递) Burst 编译器 |
| `com.unity.collections` | 6.4.0 | (传递) 高性能集合 |
| `com.unity.mathematics` | 1.3.3 | (传递) 数学库 |

### 1.3 外部包 (不在 UPM registry)

| 包名 | 来源 | 版本 | 说明 |
|------|------|------|------|
| **LLMUnity** | `https://github.com/undreamai/LLMUnity.git` (git URL) | latest | 进程内 LLM 推理 |
| **Live2D Cubism SDK** | 原始 Assets (`Assets/Live2D/Cubism/`) | 5-r.5 (2026-04-02) | Live2D 模型渲染 |

### 1.4 必须的 Scripting Define Symbols

在 `Project Settings > Player > Scripting Define Symbols` 中添加：

```
CUBISM_SDK_PRESENT
LLMUNITY_PRESENT
```

### 1.5 必须的 Player Settings

| 设置 | 值 | 原因 |
|------|-----|------|
| `Allow 'unsafe' code` | ✅ true | LLMUnity 需要 |
| `Run In Background` | ✅ true | 桌宠后台运行 |
| `Visible In Background` | ✅ true | 桌面叠加可见 |
| `Fullscreen Mode` | Windowed | 窗口化桌面宠物 |
| `Resizable Window` | false | 固定窗口尺寸 |

---

## 2. Python BFF 后端依赖

### 2.1 核心 API 服务器 (backend/requirements.txt)

**文件位置**: `D:/FOXD/桌宠demo/新建文件夹/backend/requirements.txt`

| 包名 | 版本 | 用途 |
|------|------|------|
| `fastapi` | >=0.110.0 | WebSocket/HTTP 服务器 |
| `uvicorn[standard]` | >=0.27.0 | ASGI 服务器 |
| `websockets` | >=12.0 | WebSocket 协议 |
| `azure-cognitiveservices-speech` | >=1.35.0 | Azure 语音 ASR + TTS |
| `openai` | >=1.12.0 | GPT-4o LLM 调用 |
| `edge-tts` | >=6.1.0 | 免费 Edge TTS (无需 API Key) |
| `python-dotenv` | >=1.0.0 | 环境变量加载 |
| `vosk` | >=0.3.45 (可选) | 服务端唤醒词验证 |
| `ffmpeg-python` | >=0.2.0 (可选) | 替代 subprocess ffmpeg |

### 2.2 AI 装配管线 (astralfox-rigging/requirements.txt)

**文件位置**: `D:/FOXD/astralfox-rigging/astralfox-rigging/requirements.txt`

| 包名 | 版本 | 用途 |
|------|------|------|
| `fastapi` | >=0.110.0 | API 路由 |
| `uvicorn[standard]` | >=0.29.0 | ASGI 服务器 |
| `torch` | >=2.2.0 | PyTorch 运行时 |
| `torchvision` | >=0.17.0 | 图像变换 |
| `numpy` | >=1.26.0 | 数组操作 |
| `opencv-python` | >=4.9.0 | 图像处理 |
| `Pillow` | >=10.2.0 | 图像 I/O |
| `scipy` | >=1.12.0 | Delaunay 三角剖分 |
| `rembg` | >=2.0.50 | 背景移除 |
| `gradio` | >=4.20.0 (可选) | Web UI |
| `pytest` | >=8.0.0 (dev) | 测试 |
| `ruff` | >=0.3.0 (dev) | Linter |

**额外手动安装 (不在 requirements.txt 中):**

| 包名 | 安装方式 | 用途 |
|------|---------|------|
| `ultralytics` | `pip install ultralytics` | MobileSAM 分割 |
| `sam2` | `pip install git+https://github.com/facebookresearch/sam2.git` | SAM2 分割 |
| `requests` | (隐式依赖，需确认已安装) | ComfyUI HTTP 调用 |

### 2.3 系统包依赖 (Docker/Linux)

```
libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender1 ffmpeg
```

### 2.4 Python 版本

> Docker: `python:3.11-slim` · 开发环境: Python 3.12

---

## 3. AI/ML 模型文件

### 3.1 LLM 模型 (本地推理)

| 模型 | 路径 | 大小 | 下载 |
|------|------|------|------|
| Qwen2.5-7B-Instruct-Q4_K_M.gguf | `Assets/StreamingAssets/models/qwen2.5-7b-instruct-q4_k_m.gguf` | ~4.4 GB | [Hugging Face](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF) |
| Qwen2.5-1.5B-Instruct-Q4_K_M.gguf | `Assets/StreamingAssets/models/llm/qwen2.5-1.5b-instruct-q4_k_m.gguf` | ~1 GB | (备选轻量模型) |

### 3.2 ASR 模型 (本地语音识别)

| 模型 | 路径 | 大小 |
|------|------|------|
| FunASR Paraformer | `Assets/StreamingAssets/funasr/models/` | ~800 MB |
| FunASR Server | `Assets/StreamingAssets/funasr/funasr_server.exe` | PyInstaller 打包 |

### 3.3 TTS 模型 (本地语音合成)

| 模型 | 路径 | 大小 |
|------|------|------|
| sherpa-onnx VITS-Melo-ZH | `Assets/StreamingAssets/tts/models/` | ~400 MB |
| TTS Server | `Assets/StreamingAssets/tts/tts_server.exe` | PyInstaller 打包 |

### 3.4 AI 装配模型 (Live2D 生成)

| 模型 | 路径 | 大小 | 下载 |
|------|------|------|------|
| MobileSAM | `models/mobile_sam.pt` | 38.8 MB | Ultralytics |
| SAM2 ViT-H | `models/sam2_vit_h/sam2_vit_h.pt` | ~2.4 GB | [Meta](https://github.com/facebookresearch/sam2) |
| U2Net (rembg) | `models/u2net.onnx` | ~50 MB | 自动下载 |
| ControlNet OpenPose | `models/controlnet_openpose/` | ~1.4 GB | ComfyUI 模型 |
| IP-Adapter | `models/ip_adapter/` | ~400 MB | ComfyUI 模型 |
| Bone Predictor CNN | `models/bone_predictor/best.pt` | ❌ 未训练 | TODO |

---

## 4. 外部 API 服务与密钥

### 4.1 离线模式 (当前默认，无需密钥)

```
ASR: FunASR (本地进程, port 8766)
LLM: LLMUnity (进程内 GGUF 推理)
TTS: sherpa-onnx (本地进程, port 8767)
```

### 4.2 在线模式 (BFF 后端，可选)

| 服务 | 端点 | 环境变量 | 说明 |
|------|------|---------|------|
| **Azure Speech** | `[region].api.cognitive.microsoft.com` | `AZURE_SPEECH_KEY` `AZURE_SPEECH_REGION` | ASR + TTS |
| **OpenAI** | `https://api.openai.com/v1` | `OPENAI_API_KEY` `OPENAI_MODEL=gpt-4o` | LLM |
| **Edge TTS** | 微软 Edge 公开接口 | 无 (免费) | 默认 TTS |
| **和风天气** | `https://devapi.qweather.com/v7/weather/now` | `QWEATHER_API_KEY` | 天气查询功能 |
| **Bing Search** | `https://api.bing.microsoft.com/v7.0/search` | `BING_SEARCH_API_KEY` | 网页搜索功能 |

### 4.3 本地服务端点汇总

| 服务 | 地址 | 协议 |
|------|------|------|
| BFF WebSocket | `ws://localhost:8765/ws/chat` | WebSocket v4 |
| FunASR Server | `http://127.0.0.1:8766` | HTTP REST |
| sherpa-onnx TTS | `http://127.0.0.1:8767` | HTTP REST |
| GPT-SoVITS (可选) | `http://127.0.0.1:9881` | HTTP REST |
| ComfyUI | `http://127.0.0.1:8188` | HTTP REST |
| AI Rigging Pipeline | `http://localhost:8001` | FastAPI |
| Unity MCP | `http://localhost:8080/mcp` | MCP over HTTP |
| Web 管理面板 | `http://localhost:3000` | Next.js |

---

## 5. Docker 容器编排

### 5.1 主服务 (桌宠demo/docker-compose.yml)

```yaml
services:
  postgres:    postgres:16-alpine    :5432    # 主数据库
  web:         ./avatar-web-management :3000  # Next.js 管理面板
  bff:         ./backend              :8765   # Python FastAPI BFF
```

数据库默认凭据: `astralfox` / `astralfox_dev`

### 5.2 AI 装配管线 (astralfox-rigging/docker-compose.yml)

```yaml
services:
  api:         Dockerfile   :8001   # FastAPI + PyTorch (需 NVIDIA GPU)
  ui:          Dockerfile   :7860   # Gradio Web UI
```

### 5.3 Unity MCP (桌宠demo/新建文件夹/unity-mcp/docker-compose.yml)

```yaml
services:
  unity-mcp-server:  Dockerfile  :8080   # MCP for Unity 协议桥接
```

---

## 6. Claude Code 开发环境配置

### 6.1 API 后端

| 配置 | 值 |
|------|-----|
| 当前后端 | **DeepSeek** (`api.deepseek.com/anthropic`) |
| 默认模型 | `deepseek-v4-pro` |
| Opus 模型 | `deepseek-v4-flash[1M]` |
| Sonnet 模型 | `deepseek-v4-pro[1M]` |
| Haiku 模型 | `deepseek-v4-flash` |
| 备用后端 1 | **Claude Official** (anthropic.com) |
| 备用后端 2 | **Xiaomi Mimo** (`api.xiaomimimo.com/anthropic`, model: `mimo-v2.5-pro`) |

配置文件: `C:/Users/hu shu/.claude/ccsc-{provider}.settings.json`

### 6.2 已安装插件

| 插件 | 版本 | 来源 |
|------|------|------|
| `superpowers@claude-plugins-official` | 5.1.0 | `anthropics/claude-plugins-official` (GitHub) |

### 6.3 权限配置

**项目级** (`D:/FOXD/.claude/settings.local.json`):
- 247 条 allowlist 条目
- 覆盖: Bash (npm, git, python, pip, curl, ffmpeg, winget, gh, nvidia-smi...), WebSearch, WebFetch, CodeGraph MCP, 文件读写全路径

**用户级** (`C:/Users/hu shu/.claude/settings.json`):
- CodeGraph MCP 工具全权限
- 禁用: `keybindings-help`, `dispatching-parallel-agents`, `subagent-driven-development`

### 6.4 Hooks (Clawd-on-Desk 集成)

14 个生命周期 Hook，全部异步调用 `clawd-hook.js`:
```
SessionStart → SessionEnd → UserPromptSubmit → PreToolUse → PostToolUse
→ PostToolUseFailure → Stop → SubagentStart → SubagentStop → Notification
→ Elicitation → PreCompact → PostCompact → StopFailure
```

HTTP Permission Hook: `http://127.0.0.1:23333/permission` (timeout 600s)

### 6.5 环境变量

```bash
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_AUTH_TOKEN=sk-944ebae93a564cb39f8333a885136b24
ANTHROPIC_MODEL=deepseek-v4-pro
DISABLE_AUTOUPDATER=1
DISABLE_UPDATES=1
```

---

## 7. MCP 服务器配置

### 7.1 当前会话

| MCP Server | 类型 | 说明 |
|-----------|------|------|
| **CodeGraph** | 嵌入式 (tree-sitter 索引) | 代码知识图谱 — 符号搜索、调用链跟踪、影响分析 |

### 7.2 项目配置的 MCP

| MCP Server | 端点/命令 | 位置 |
|-----------|----------|------|
| **UnityMCP** | `http://localhost:8080/mcp` (HTTP) | `桌宠demo/新建文件夹/AstralFox/.claude/mcp.json` |
| **UnityMCP** | `http://localhost:8080/mcp` (HTTP) | `桌宠demo/新建文件夹/unity-mcp/.claude/mcp.json` |
| **better-icons** | `npx -y better-icons` (stdio) | `桌宠demo/新建文件夹/avatar-web-management/.mcp.json` |

---

## 8. Skills 技能配置

### 8.1 Superpowers 插件内置技能 (已启用)

```
superpowers:brainstorming        — 创意工作前的需求探索
superpowers:writing-plans        — 编写实现计划
superpowers:executing-plans      — 分阶段执行计划
superpowers:test-driven-development  — TDD 工作流
superpowers:systematic-debugging    — 系统化调试
superpowers:verification-before-completion — 完成前验证
superpowers:requesting-code-review   — 请求代码审查
superpowers:receiving-code-review    — 接收代码审查
superpowers:finishing-a-development-branch — 完成开发分支
superpowers:using-git-worktrees     — Git Worktree 管理
superpowers:using-superpowers       — 技能使用指南
superpowers:writing-skills          — 编写技能
```

### 8.2 Superpowers 插件内置技能 (已禁用)

```
superpowers:dispatching-parallel-agents
superpowers:subagent-driven-development
```

### 8.3 项目 Skills

| 技能 | 路径 | 说明 |
|------|------|------|
| **ui-ux-pro-max** | `桌宠demo/新建文件夹/AstralFox/.claude/skills/ui-ux-pro-max/` | UI/UX 设计 (50+ styles, 161 色板, 57 字体) |

### 8.4 用户全局 Skills

| 技能 | 路径 |
|------|------|
| **gsap-skills** (8 子技能) | `C:/Users/hu shu/.claude/skills/gsap-skills/` |
| **taste-skill** (13 子技能) | `C:/Users/hu shu/.claude/skills/taste-skill/` |

### 8.5 会话可用技能

```
deep-research, update-config, verify, code-review, simplify,
fewer-permission-prompts, loop, claude-api, run, init, review,
security-review, mcp-source, unity-mcp-skill, ui-ux-pro-max
```

---

## 9. 环境搭建清单

### 步骤 1: Unity 项目

```
1. 安装 Unity 6000.4.10f1 (团结引擎)
2. 打开项目: D:\FOXD\桌宠demo\新建文件夹\AstralFox
3. Project Settings > Player > Scripting Define Symbols:
   添加 CUBISM_SDK_PRESENT
4. (如需本地 LLM) 添加 LLMUNITY_PRESENT
5. Player Settings > Allow 'unsafe' code: ✅
6. 安装 LLMUnity 包 (git URL):
   https://github.com/undreamai/LLMUnity.git
```

### 步骤 2: Python BFF (可选,仅在线模式需要)

```
cd D:\FOXD\桌宠demo\新建文件夹\backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env: 填入 AZURE_SPEECH_KEY, OPENAI_API_KEY 等
```

### 步骤 3: AI 装配管线 (可选,仅 Live2D 生成需要)

```
cd D:\FOXD\astralfox-rigging\astralfox-rigging
pip install -r requirements.txt
pip install ultralytics
pip install git+https://github.com/facebookresearch/sam2.git
# 下载模型文件到 models/ 目录
```

### 步骤 4: 本地 AI 模型 (离线模式)

```
□ Qwen2.5-7B Q4_K_M GGUF → Assets/StreamingAssets/models/    (~4.4 GB)
□ FunASR Paraformer 模型    → Assets/StreamingAssets/funasr/models/  (~800 MB)
□ FunASR Server .exe        → Assets/StreamingAssets/funasr/         (PyInstaller)
□ sherpa-onnx VITS 模型     → Assets/StreamingAssets/tts/models/     (~400 MB)
□ TTS Server .exe           → Assets/StreamingAssets/tts/            (PyInstaller)
```

### 步骤 5: 外部服务 (可选)

```
□ FFmpeg: 安装并配置 FFMPEG_PATH
□ Docker Desktop: 用于 postgres + web + bff 服务
□ ComfyUI: 用于 AI 装配管线的姿态生成
```

### 步骤 6: MCP 服务器

```
□ Unity MCP: cd unity-mcp && docker-compose up -d  (port 8080)
□ CodeGraph: 在项目根目录运行 codegraph init -i
```

### 步骤 7: 验证

```
□ Unity Editor: 打开项目, 0 编译错误
□ Game View: 悠小喵 Live2D 模型正常渲染
□ 透明窗口: 绿色背景正确抠除
□ Console: [ChromaKey] ✓ Registered
□ BFF: curl http://localhost:8765/health → 200
□ Rigging: curl http://localhost:8001/api/health → 200
□ MCP: curl http://localhost:8080/mcp → 200
```
