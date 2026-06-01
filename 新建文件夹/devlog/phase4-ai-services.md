# 阶段 4 后端 AI 服务集成开发日志

> 日期：2026-05-23
> 目标：将 Phase 3 的 Mock 后端升级为真实 AI 服务
> 新增文件：5 个 Python 模块 + 2 个配置文件

---

## 一、架构概览

```
Unity Client (Phase 3)
  │  WebSocket: binary PCM + JSON text
  ▼
FastAPI BFF (main.py)  ← 本阶段重写
  │
  ├──→ ASR Service (asr.py)
  │      Azure Speech-to-Text (PushAudioInputStream streaming)
  │      Fallback: 随机中文 mock 转录
  │
  ├──→ LLM Service (llm.py)
  │      OpenAI GPT-4o with Function Calling
  │      System prompt: 星尘狐角色扮演
  │      Function tools: get_weather, search_web, set_reminder
  │      Fallback: 关键词匹配的 mock 回复
  │
  └──→ TTS Service (tts.py)
         edge-tts (免费, 默认) → MP3 → ffmpeg → PCM16
         Azure TTS (需 API key) → 原生 PCM16 输出
         Fallback: 静默 PCM 帧
```

## 二、新增文件

| # | 文件 | 说明 |
|---|------|------|
| 1 | `config.py` | 环境变量配置（API keys, 服务开关） |
| 2 | `asr.py` | Azure ASR 服务 + Mock 降级 |
| 3 | `llm.py` | OpenAI GPT-4o 对话 + 角色扮演 prompt |
| 4 | `tts.py` | edge-tts / Azure TTS 双后端 |
| 5 | `tools.py` | GPT Function Calling 工具定义 |
| 6 | `.env.example` | 配置模板 |
| 7 | `requirements.txt` | 已更新依赖 |

## 三、核心设计决策

### 3.1 渐进式服务降级

每种服务都有 Mock 降级路径，确保无 API key 也能运行：

| 服务 | 需要什么 | 降级行为 |
|------|---------|---------|
| ASR | AZURE_SPEECH_KEY + SDK | 随机中文 mock 转录 |
| LLM | OPENAI_API_KEY | 关键词匹配 mock 回复 |
| TTS | edge-tts + ffmpeg | 静默 PCM 帧 |

服务状态通过 `/health` 端点暴露。

### 3.2 LLM 角色扮演 Prompt

System prompt 定义星尘狐的性格：
- 活泼可爱、好奇心强、偶尔撒娇的桌面宠物
- 回复格式要求：`[情绪]可选[动作]对话内容`
- 回复长度限制 1-3 句话
- 支持对话历史（最近 10 轮 = 20 条消息）

### 3.3 Function Calling 流程

```
User: "今天北京天气怎么样？"
  → GPT returns: tool_call(get_weather, {"city": "北京"})
  → Server executes get_weather → returns mock data
  → GPT sees result → returns: "[happy]北京今天晴天，25°C～很适合出门散步呢！"
```

### 3.4 TTS 音频管道

```
edge-tts (MP3 stream) → 累积为完整 MP3 → ffmpeg pipe → PCM16 16kHz mono
                                                              │
                                                 split into 100ms chunks
                                                              │
                                              WebSocket JSON frames (base64)
```

Azure TTS 直接输出 PCM16，跳过 MP3 转换步骤。

## 四、Unity 端变更

**无变更**。Phase 3 的 WebSocket 协议保持不变：
- `BackendClient.cs` 无需修改
- `VoiceManager.cs` 无需修改
- 所有消息类型（partial_transcript, final_transcript, llm_response, tts_audio, tts_done, error）格式一致

## 五、部署步骤

```bash
cd backend
cp .env.example .env       # 编辑填写 API keys
pip install -r requirements.txt
# 需要安装 ffmpeg (edge-tts 依赖)
python main.py
```

无需 API key 也可启动（使用 mock 降级）：
```bash
python main.py
# → ASR: mock, LLM: mock, TTS: silence
```

## 六、健康检查

```bash
curl http://localhost:8765/health
# {
#   "status": "ok",
#   "version": "0.2.0",
#   "phase": 4,
#   "services": {
#     "asr": "azure" | "mock",
#     "llm": "openai" | "mock",
#     "tts": "edge-tts" | "mock"
#   },
#   "warnings": [...]
# }
```

## 七、已知限制

| 限制 | 说明 | 计划 |
|------|------|------|
| Function tools 为 mock | 天气/搜索/提醒返回假数据 | Phase 6 接入真实 API |
| TTS 非真流式 | edge-tts 需完整 MP3 后再转码 | 可接受（回复短） |
| ffmpeg 依赖 | edge-tts 需要系统安装 ffmpeg | 文档说明 |
| Azure ASR 并发 | 单会话设计，未做连接池 | 后续优化 |
