# 面试追问预演文档

> 15 个最可能被问的问题 + 准备好的回答 + 代码证据路径
> 每条回答控制在 60 秒以内

---

## 架构与设计

### Q1: 这个项目的整体架构是什么？

**回答**: 三条线并行。Unity C# 做桌面客户端渲染和交互，Python FastAPI 做 WebSocket 实时语音管线，Next.js 做 Web 管理。三条线通过 JWT 统一认证，WebSocket 做流式数据传输。

**代码证据**: `project-architecture-v2.md`，`Assets/Scripts/Runtime/Voice/BackendClient.cs:208`

---

### Q2: 为什么选 Live2D 而不是 Spine/DragonBones？

**回答**: Live2D 的 keyform 混合非常适合程序化参数驱动。更关键的是我做了接口隔离——`IPetAnimator` 定义了统一的动画接口，`Live2DAnimator` 只是一个实现。切换模型引擎只需要实现新的适配器。

**代码证据**: `Assets/Scripts/Runtime/Animation/IPetAnimator.cs`

---

### Q3: 如果你要加一个 Spine 模型支持，需要改多少代码？

**回答**: 改 0 行业务代码。只需要写一个 `SpineAnimator : MonoBehaviour, IPetAnimator`，实现 15 个接口方法，然后在 `PetAnimationManager` 的 Inspector 里把引用从 `Live2DAnimator` 换成 `SpineAnimator`。所有调用方只依赖 `IPetAnimator` 接口。

**代码证据**: `Assets/Scripts/Runtime/Animation/Live2DAnimator.cs` — 展示适配器模式

---

## 实时系统

### Q4: 语音对话的延迟是多少？怎么优化的？

**回答**: 端到端延迟 3-10 秒，瓶颈在 LLM。优化方向：ASR 拿到 final transcript 后立刻启动 LLM streaming，不等全文；TTS 按句分段合成。Python 端已经实现了 streaming pipeline，不是全串行阻塞。

**代码证据**: `astralfox-rigging/astralfox-rigging/backend/main.py`

---

### Q5: 语音管线断了会怎样？

**回答**: 不会静默挂掉。VoiceManager 有 4 级超时保护：Listening 超时、Processing 超时、Speaking 超时都会触发 `OnUserNotification` 事件，通知气泡告诉用户"超时了，请再说一次"。WebSocket 断连后自动重连，重连成功会通知上层复位状态。

**代码证据**: `Assets/Scripts/Runtime/Voice/VoiceManager.cs`，`Assets/Scripts/Runtime/UI/UINotificationBubble.cs`

---

### Q6: 并发安全怎么做的？

**回答**: BackendClient 有连接状态机（Disconnected → Connecting → Connected → Disconnecting），所有状态转换通过 `lock(_stateLock)` 保护。VoiceManager 的 streaming token 和完整响应之间有 `_streamLock` 保护竞态。音频队列用 `SemaphoreSlim` 做背压。

**代码证据**: `Assets/Scripts/Runtime/Voice/BackendClient.cs`

---

## AI 模型生成

### Q7: 这个 AI 模型生成管线是怎么回事？

**回答**: 这是我最引以为傲的部分。从一张角色立绘出发——MobileSAM 自动做 10 层语义分割（body/face/hair/eyes/eyebrows/mouth），然后模板骨骼预测器根据图层 bounding box 自动适配骨骼位置，再做自动蒙皮权重绘制，最后 Cubism Bridge 导出 `.moc3` + `.model3.json` + `.physics3.json`。整个流程 41 秒，不需要人工介入。

**代码证据**: `astralfox-rigging/astralfox-rigging/api/routes/pipeline.py`，`ai_engine/layer_separator.py`，`ai_engine/bone_predictor.py`

---

### Q8: 为什么不用商业 Live2D Editor 手动绑定？

**回答**: 商业 Editor 当然精度更高，但这个管线的价值在于**零人工介入**——创造者上传一张角色图，41 秒后就能在桌面上动起来。这是为创作者市场（UGC）设计的底层能力。而且管线的每个环节都是可插拔的：MobileSAM 可以换 SAM2，模板骨骼可以换 CNN 预测器。

---

## 性能

### Q9: 你做过的性能优化？

**回答**: 两个值得一提的。TTS 播放器原本每段音频分配 ~4MB 临时内存，30 句话就是 240MB。改用 `AudioClip.Create(stream:true)` 后变成增量 `SetData`，零拷贝。另外 Chroma Key 透明窗口的色键检测原本在 CPU 上逐像素处理，已经写好了 Compute Shader 方案待 GPU 化。

**代码证据**: `Assets/Scripts/Runtime/Voice/TTSPlayer.cs`，`TransparentWindow.cs`

---

### Q10: 内存占用多少？

**回答**: 运行时 < 500MB。大头是 Live2D 纹理（4096×4096）和 FunASR 语音模型（启用时 +2GB）。所以本地 AI 模式默认关闭，云端模式内存可控。

---

## 安全

### Q11: 安全怎么做的？

**回答**: 三个层面。传输层：HTTPS/WSS (TLS 1.3) + JWT RS256 + refresh 轮转。存储层：Auth Token 和 API Key 全部 AES-256-CBC + HMAC-SHA256 加密存储，PBKDF2 100,000 次迭代。应用层：CSRF Double Cookie + CORS 白名单 + Rate Limiting。

**代码证据**: `Assets/Scripts/Runtime/Data/CryptoHelper.cs`，`avatar-web-management/src/middleware/`

---

### Q12: 如果有人拿到加密文件能解密吗？

**回答**: 不能。密钥派生需要 deviceUniqueIdentifier + 随机 salt，salt 不随密文存储。即使拿到了 `.enc` 文件和 device ID，还需要经过 100,000 次 PBKDF2 迭代才能暴力破解。而且用了 HMAC 做密文完整性校验，篡改即失效。

**代码证据**: `Assets/Scripts/Runtime/Data/CryptoHelper.cs:34-120`

---

## 工程管理

### Q13: 你遇到的最难 bug 是什么？

**回答**: `Environment.TickCount` 在 Windows 上每 24.9 天溢出回零。空闲检测用 `TickCount - lastInputTime`，溢出后减法结果是错的，导致狐狸在没人操作时频繁触发回访问候。用一行无符号减法修复了——`uint tickNow = (uint)Environment.TickCount`，无符号环绕自动处理溢出。但找到 root cause 花了两天，因为复现需要系统运行超过 24 天。

**代码证据**: `Assets/Scripts/Runtime/Behavior/TimeAwareness.cs:196-198`，`ContextAwareness.cs:153-155`

---

### Q14: 如果重来一次你会怎么做？

**回答**: 先做角色模型再做基础设施。现在回头看，我在 Next.js/Prisma/Docker/K8s 这些基础设施上花了太多时间，而核心体验——角色模型——用的是 GitHub 上找的占位品。正确顺序应该是：搞定一个版权清晰的模型 → 跑通动画系统的参数映射 → 然后才考虑要不要做 Web 管理后台。

---

### Q15: 你的测试策略？

**回答**: 分层。Unity 端：Editor 测试验证模型完整性（12 passed），计划补 PlayMode 测试覆盖状态机超时和加密往返。Python 端：pytest 覆盖 WebSocket 协议握手和工具注册表。Web 端：455 单元测试全部通过 + Playwright E2E 测试通知功能。整体覆盖率约 15%，关键路径优先。

**代码证据**: `Assets/Scripts/Editor/AstralFoxTestRunner.cs`，`astralfox-rigging/astralfox-rigging/test_ws.py`
