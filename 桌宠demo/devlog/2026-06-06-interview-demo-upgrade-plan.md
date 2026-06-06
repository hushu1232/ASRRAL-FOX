# AstralFox 面试演示升级计划任务书

> **日期**: 2026-06-06
> **目标**: 将项目从"能跑的技术 demo"升级为"面试桌上能打的王炸"
> **核心策略**: 用 AI rigging 管线生成新模型替换 Senko 占位品，让面试官看到完整的技术纵深
> **总工时**: ~11.5h，预计 1-2 个工作日

---

## 项目当前状态速查

| 维度 | 当前 | 目标 |
|------|------|------|
| 渲染模型 | Senko 仙狐 (版权不合规，3 motion) | AI 管线生成的原创 Live2D 模型 |
| 参数映射 | CatTail 约定 (与 Senko 错配) | 与模型真实参数一一对齐 |
| 动画验证 | 代码写了，未实测 | 6 状态 + 5 表情 + 12 空闲行为均可视化验证 |
| 演示可靠性 | 依赖网络/API/麦克风 | 有 Mock 降级 + 录屏视频双保险 |
| Q&A 准备 | checklist 3 个追问 | 完整 ADR + 叙事链条 + 追问预演 |

---

## Phase 0: 安全网验证 🛡️ (0.5h)

### 目标
确认当前代码在目标机器上从零启动全链路可用。

### 任务清单

#### 0.1 冷启动全链路验证
- [ ] Unity Editor Play Mode 启动 → FoxPlaceholder 出现
- [ ] Senko 模型正确渲染（CubismRenderer 18 drawables）
- [ ] 透明窗口无撕裂、无黑边
- [ ] 拖拽交互：弹性跟随 + 松手弹跳

#### 0.2 Mock 降级验证
- [ ] F12 键触发 Mock 模式
- [ ] VoiceManager 切换到 MockVoicePipeline
- [ ] 气泡显示模拟对话流程

#### 0.3 通知系统验证
- [ ] 启动时 VoiceManager 发送就绪通知气泡
- [ ] DiagnosticBus 错误 → UI 气泡可见
- [ ] WebSocket 断连 → 自动重连 → 通知气泡

#### 0.4 BFF + Web 端验证
- [ ] Python BFF 启动 (`python main.py`) 无报错
- [ ] WebSocket `/ws/chat` 可连接
- [ ] Web 管理平台 `localhost:3000` 可访问

**产出**: `phase0-checklist.md` 全部打勾或标记 ❌

---

## Phase 1A: AI 生成新模型 🤖 (4h)

### 前置条件检查

在开始之前，逐一验证环境：

- [ ] ComfyUI 已安装并可启动 (`http://127.0.0.1:8188`)
- [ ] AI checkpoints 已下载:
  - [ ] `models/u2net.onnx` (rembg 背景分离)
  - [ ] `models/mobile_sam.pt` (MobileSAM 图层分离, 38.8MB)
  - [ ] `models/sam2_vit_h/` (SAM2 可选, 2.4GB)
- [ ] Python 环境: `pip install -r requirements.txt` 已执行
- [ ] FastAPI 服务可启动 (`uvicorn api.main:app --port 8001`)

### 任务清单

#### 1A.1 准备输入素材 (0.5h)
- [ ] 准备一张高质量角色立绘作为输入图（二次元少女风格，正面站立姿势最佳）
  - 备选: 使用 ComfyUI 生成 (`POST /api/generate`)
  - 或从互联网获取无版权角色图用于 demo
- [ ] 输入图验证: 分辨率 ≥ 1024×1024, 白色/透明背景, 人物居中

#### 1A.2 启动服务 (0.5h)
- [ ] 启动 ComfyUI 服务，确认 `/prompt` 端点可达
- [ ] 加载 img2img workflow 模板 (`templates/comfyui_workflow_img2img.json`)
- [ ] 启动 rigging FastAPI (`python -m api.main` 或 `uvicorn`)
- [ ] 健康检查: `GET /api/health` 返回 200

#### 1A.3 执行 pipeline (1h)
- [ ] 上传立绘: `POST /api/upload`
- [ ] 运行全流程: `POST /api/pipeline/ {image_id, template: "human_female", auto_deploy: false}`
- [ ] 监控 SSE 进度: `GET /api/progress/{image_id}`
- [ ] 检查输出产物:
  - [ ] `output/{image_id}/layers/` — 各图层 PNG + mask
  - [ ] `output/{image_id}/cubism/model.moc3` — 运行时模型
  - [ ] `output/{image_id}/cubism/model.model3.json` — SDK 配置
  - [ ] `output/{image_id}/cubism/model.physics3.json` — 物理参数
  - [ ] 纹理图集 (texture_atlas.png)

#### 1A.4 部署到 Unity (0.5h)
- [ ] 复制 pipeline 产物到 `Assets/StreamingAssets/Models/generated/`
- [ ] 更新 `AppConfig.cs` 的 `model_path` 指向新模型
- [ ] Unity Editor Play Mode: 验证新模型可渲染
- [ ] 检查 Console 无红色 Error

#### 1A.5 参数映射对齐 (1h)
- [ ] 从 `model.model3.json` 的 `Parameters` 数组提取真实参数名
- [ ] 对比 `FoxParamId.cs` 的映射表，列出所有错配项
- [ ] 修复错配:
  - [ ] 如果新模型有 `ParamBodyAngleX/Y/Z` → 使用它们（当前 fallback 到 AngleX）
  - [ ] 如果新模型无 `ParamHairFront/Back` → 找到对应的耳朵/头发参数
  - [ ] 如果新模型无 `Param2/Param3` → 找到对应的尾巴参数
  - [ ] `ArmL/ArmR` 当前 fallback 到 `AngleX/AngleY` → 新模型有手臂参数则更新
- [ ] 在 Unity Editor 中逐项验证:
  - [ ] 眨眼 (EyeLOpen/EyeROpen)
  - [ ] 口型 (MouthOpenY)
  - [ ] 呼吸 (Breath)
  - [ ] 耳朵 (EarL/EarR)
  - [ ] 尾巴 (TailWag/TailSwing/TailCurl)
  - [ ] 身体旋转 (BodyAngleX/Y/Z)
  - [ ] 表情 (BrowLY/RY/LAngle/RAngle)

#### 1A.6 验证 6 状态机 + 12 空闲行为 (0.5h)
- [ ] Idle → 眨眼 + 呼吸 + 12 种随机行为均在新模型上可见
- [ ] Listening → 耳朵竖起 + 身体前倾
- [ ] Speaking → 口型随 TTS 音频变化
- [ ] Sleep → 眼睛闭合 + 身体后倾
- [ ] Dragging → 四肢垂摆 + 耳朵后贴
- [ ] Greeting → 耳朵竖起 + 尾巴摇动 + 眼睛眯起

**产出**:
- `devlog/2026-06-06-model-generation.md` — AI 模型生成工程日志
- `Assets/StreamingAssets/Models/generated/` — 新模型文件
- `FoxParamId.cs` — 更新后的参数映射（ALIGNED 注释）
- 更新 `AppConfig.cs` model_path

---

## Phase 1B: Senko 参数对齐 (降级方案, 2h)

> 仅在 Phase 1A 环境不可用时执行

### 任务清单

#### 1B.1 提取 Senko 真实参数 (0.5h)
- [ ] 使用 Live2D Cubism Viewer 或脚本从 `senko_normal.moc3` 提取参数列表
- [ ] 备选: 从 `senko.model3.json` 的 Groups 推断参数

#### 1B.2 重新映射 FoxParamId (0.5h)
- [ ] 将每个 FoxParamId 常量映射到 Senko 的真实参数名
- [ ] 无法映射的参数标记 `// FALLBACK: not available on Senko`

#### 1B.3 验证动画联动 (0.5h)
- [ ] 6 个状态在 Senko 上逐一切换验证
- [ ] 5 个表情在 Senko 上验证

#### 1B.4 录制 demo 视频 (0.5h)
- [ ] 用 OBS 录制 2 分钟完整演示
- [ ] 包含: 启动→唤醒→对话→拖拽→表情变化

**产出**:
- `FoxParamId.cs` — Senko 对齐版本
- `devlog/2026-06-06-senko-alignment.md`
- `demo-video-senko.mp4`

---

## Phase 2: 演示增强 ⚡ (3h)

### 任务清单

#### 2.1 Unity Editor 动画参数可视化面板 (1h)
- [ ] 创建 Editor Window `AnimationMonitorWindow.cs`
  - 实时显示 FoxAnimationController.CurrentState
  - 实时显示 FoxEmotionController.CurrentEmotion
  - 实时显示所有驱动参数值 (BodyAngleX, EyeLOpen, MouthOpenY, EarL, etc.)
  - 以滑动条 + 数值形式展示
- [ ] 菜单栏入口: `AstralFox → Animation Monitor`
- [ ] Verify: Unity Editor Play Mode 中面板实时刷新

#### 2.2 WebSocket 消息流监控面板 (1h)
- [ ] 创建 Editor Window `WebSocketMonitorWindow.cs`
  - 显示最近 50 条 WebSocket 消息（type + 时间戳 + 摘要）
  - 彩色编码: 绿色=发送, 蓝色=接收, 红色=错误
  - 暂停/继续滚动开关
- [ ] 菜单栏入口: `AstralFox → WebSocket Monitor`
- [ ] Verify: 语音对话时面板实时显示消息流

#### 2.3 README 架构图 + 技术栈总览 (0.5h)
- [ ] 在项目根 `README.md` 中加入:
  - ASCII 架构全景图 (来自 project-architecture-v2.md)
  - 技术栈速查表
  - 能力矩阵 (已实现 vs 计划中)
  - 快速启动指南 (3 行命令)
- [ ] GitHub 风格 markdown，含 emoji 和 badge

#### 2.4 录制 2 分钟演示视频 (0.5h)
- [ ] OBS 录制，含系统音频
- [ ] 内容:
  - 0:00-0:20 启动 + 狐狸出现 + 拖拽
  - 0:20-0:50 唤醒 + 语音对话 + 表情变化
  - 0:50-1:20 Unity Editor 面板展示 (动画参数 + WebSocket 消息流)
  - 1:20-1:50 代码亮点 (架构图 + IPetAnimator 接口)
  - 1:50-2:00 断连恢复
- [ ] 保存到 `docs/demo-video.mp4`

**产出**:
- `Assets/Scripts/Editor/AnimationMonitorWindow.cs`
- `Assets/Scripts/Editor/WebSocketMonitorWindow.cs`
- `README.md` (更新)
- `docs/demo-video.mp4`

---

## Phase 3: Q&A 弹药库 📚 (2h)

### 任务清单

#### 3.1 ADR 决策记录索引 (0.5h)
- [ ] 创建 `docs/ADR-INDEX.md`
  - 列出所有 ADR 的标题 + 一句话摘要 + 面试回答要点
  - 关键 ADR 重点标注:
    - ADR-??? AI 后端抽象层 (为什么选 WebSocket 而非 REST)
    - ADR-??? DPAPI 加密 (为什么不用 PlayerPrefs)
    - ADR-??? IPetAnimator 接口 (为什么抽象模型层)
    - ADR-??? CatTail → Senko → AI 生成 模型演变

#### 3.2 技术债务修复叙事 (0.5h)
- [ ] 创建 `docs/INTERVIEW-NARRATIVE.md`
  - "你做的最大技术决策" → 叙事脚本
  - "你遇到的最难 bug" → TickCount 49.7天溢出 的故事
  - "你的代码被 review 会挑出什么" → 自我批评 + 修复计划
  - "如果重来一次你会怎么做" → 先做模型再做基础设施

#### 3.3 模块 README 补全 (0.5h)
- [ ] `Assets/Scripts/Runtime/Animation/README.md` — 动画系统架构
- [ ] `Assets/Scripts/Runtime/Voice/README.md` — 语音管线架构
- [ ] `astralfox-rigging/README.md` — AI rigging 管线使用指南

#### 3.4 面试追问预演文档 (0.5h)
- [ ] 创建 `docs/INTERVIEW-QA.md`
  - 15 个最可能被问的问题 + 准备好的回答 + 代码证据路径
  - 覆盖: 架构/安全/性能/测试/工程管理/技术选型

**产出**:
- `docs/ADR-INDEX.md`
- `docs/INTERVIEW-NARRATIVE.md`
- `docs/INTERVIEW-QA.md`
- `Assets/Scripts/Runtime/Animation/README.md`
- `Assets/Scripts/Runtime/Voice/README.md`
- `astralfox-rigging/README.md`

---

## Phase 4: 锦上添花 ✨ (2h)

### 任务清单

#### 4.1 性能数据采集 (0.5h)
- [ ] 在 Unity Editor Profiler 中采集:
  - Idle 状态 FPS (目标: 60fps)
  - Speaking 状态 CPU 占用
  - 内存占用 (驻留集)
  - WebSocket 消息延迟 (往返时间)
- [ ] 在 README 中添加性能 badge

#### 4.2 关键路径单元测试补齐 (1h)
- [ ] `VoiceManagerTests.cs` — 状态机超时测试
- [ ] `DataStoreTests.cs` — 加密往返测试
- [ ] 如果已存在则验证可运行，不存在则创建
- [ ] Run: 全部通过

#### 4.3 端到端集成测试脚本 (0.5h)
- [ ] 创建 `scripts/e2e-demo-test.ps1`
  - 启动 BFF
  - 启动 Unity (headless)
  - 发送模拟 WebSocket 消息验证管线
  - 收集结果并输出报告
- [ ] 至少一次成功运行

**产出**:
- 性能数据 (README badge)
- 新增或验证通过的测试
- `scripts/e2e-demo-test.ps1`

---

## 执行顺序与依赖

```
Phase 0 (安全网)
    │
    ├─ 环境就绪 ──→ Phase 1A (AI 模型生成)
    │                    │
    └─ 环境不可用 ──→ Phase 1B (Senko 对齐)
                         │
                    ┌────┘
                    ▼
              Phase 2 (演示增强)
                    │
                    ▼
              Phase 3 (Q&A 弹药库)
                    │
                    ▼
              Phase 4 (锦上添花)
```

Phase 2/3/4 不依赖 Phase 1A 的产出（用 Senko 也能做面板和文档），可以部分并行。

---

## 验收标准

- [ ] Unity Play Mode 启动无 Error
- [ ] 角色模型正确渲染（Senko 或 AI 生成）
- [ ] 6 个动画状态全部可视验证通过
- [ ] 语音对话全链路贯通（云端或 Mock）
- [ ] Unity Editor 两个监控面板可用
- [ ] README 架构图完整
- [ ] 2 分钟 demo 视频可播放
- [ ] ADR 索引 + 叙事 + Q&A 文档齐全
- [ ] 所有测试通过

## 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| ComfyUI 环境不可用 | 中 | 降级到 Phase 1B |
| AI checkpoints 未下载 | 高 | MobileSAM 仅 38.8MB，rembg u2net 可自动下载 |
| 生成模型质量差 | 中 | 多次生成取最佳，或手动微调 |
| 新模型参数名不匹配 | 中 | Phase 1A.5 专门做映射对齐 |
| 面试现场网络不可用 | 中 | Mock 模式 + 录屏视频双保险 |
