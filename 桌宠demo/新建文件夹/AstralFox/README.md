# 🦊 AstralFox · 星尘

**AI 桌面宠伴侣 — 面试技术展示项目**

```
┌─────────────────────────────────────────────────────────┐
│  Unity (Tuanjie 2022.3)    │  FastAPI (Python 3.12)     │
│  Live2D Cubism 5.3         │  WebSocket /ws/chat        │
│  Windows 透明窗口渲染       │  Azure ASR → GPT-4o → TTS  │
│  AI Rigging Pipeline        │  Next.js 16 管理后台       │
└─────────────────────────────────────────────────────────┘
```

## 快速启动

```bash
# 1. 启动 Python BFF
cd astralfox-rigging/astralfox-rigging && python main.py

# 2. 启动 Web 管理平台 (可选)
cd avatar-web-management && npm run dev

# 3. 打开 Unity 项目并 Play
# 项目路径: 桌宠demo/新建文件夹/AstralFox
```

## 核心能力

| 能力 | 状态 | 技术栈 |
|------|------|--------|
| AI 语音对话 | ✅ | Azure ASR → GPT-4o streaming → Azure TTS → LipSync |
| 实时动画系统 | ✅ | 6 状态 FSM + 5 表情 + 12 空闲行为 + 数据驱动 ScriptableObject |
| AI 模型生成 | ✅ | MobileSAM 分离 → 模板骨骼 → Cubism 导出 (41s per model) |
| 桌面透明窗口 | ✅ | DWM 色键抠图 + 拖拽 + 边缘检测 |
| 安全加密 | ✅ | AES-256-CBC + HMAC + PBKDF2(100k iter) |
| WebSocket 协议 | ✅ | hello/welcome 握手 + streaming tokens + 断线重连 |
| 工具调用 | ✅ | 和风天气 + Bing Search + 异步定时提醒 |
| Web 管理平台 | ✅ | Next.js 16 + Prisma 7.8 + JWT RS256 + RBAC |

## 架构亮点

### 动画系统 (C#)
```
IPetAnimator → Live2DAnimator → FoxAnimationController → CubismParameterDriver
                     │                    │
              FoxEmotionController   IdleBehaviorDef (ScriptableObject × 12)
                     │
              PADEmotionEngine (愉悦度/唤醒度/支配度)
```

### AI 模型生成管线 (Python)
```
输入图片 → MobileSAM 图层分离 → 模板骨骼预测 → 自动蒙皮 → Cubism 导出 → 部署 Unity
   41s (CPU) / ~10s (GPU)
```

### 语音管线
```
麦克风 → PCM 16kHz → WebSocket → BFF → Azure ASR → LLM → TTS → WAV → Unity AudioSource → LipSync
```

## Unity Editor 工具

- `AstralFox → Animation Monitor` — 实时动画参数面板
- `AstralFox → WebSocket Monitor` — 消息流实时监控
- `AstralFox → Setup Wizard` — 一键场景搭建
- `AstralFox → Batch Build` — 命令行批量构建

## 性能

| 指标 | 值 |
|------|-----|
| Idle FPS | 60 (目标) |
| 模型生成 | 41.5s (CPU) |
| WebSocket 延迟 | < 50ms (局域网) |
| 内存占用 | < 500MB |

## 项目结构

```
桌宠demo/新建文件夹/AstralFox/
├── Assets/
│   ├── Scripts/Runtime/
│   │   ├── Animation/     # 动画状态机 + 参数驱动 + 情绪系统
│   │   ├── Voice/         # 语音管线 (ASR/LLM/TTS/唤醒词)
│   │   ├── Behavior/      # 上下文感知 + 主动聊天
│   │   ├── Config/        # 配置管理 + 加密存储
│   │   └── Diagnostics/   # 错误报告总线
│   ├── Scripts/Editor/    # 编辑器工具链
│   ├── StreamingAssets/
│   │   └── Models/
│   │       ├── generated/  # AI 生成模型 (默认)
│   │       └── Senko/      # 开发占位模型
│   └── Settings/
│       └── IdleBehaviors/  # 12 个 ScriptableObject 行为配置
│
astralfox-rigging/astralfox-rigging/
├── ai_engine/             # AI 图层分离 + 骨骼预测 + 蒙皮
├── cubism_bridge/         # .moc3 / .model3.json 导出
├── api/                   # FastAPI 路由
└── models/                # AI checkpoints
```

## 许可证

本项目为个人技术展示项目，非商业用途。
Senko 模型版权归原作者所有，仅用于开发测试。
