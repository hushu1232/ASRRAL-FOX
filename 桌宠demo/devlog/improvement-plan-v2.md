# AstralFox 提升计划 v2 — 从"能跑"到"能打"

> **基线**: remediation-plan.md Phase 0-4 已实施 (2026-06-03)
> **目标**: 逐条加固，每条完成打 ✅，完成后反馈
> **原则**: 先补用户可感知的，再补架构深层的；每条可独立验收

---

## 前置总结：我们做了什么 & 还剩什么

### 已完成 (remediation-plan Phase 0-4)

| # | 改动 | 文件 |
|---|------|------|
| ✅ | DPAPI 加密 Auth Token + 随机盐 AES fallback | CryptoHelper.cs (新), DataStore.cs |
| ✅ | ConfigManager v2 DPAPI 格式 + v1 向后兼容 | ConfigManager.cs |
| ✅ | docker-compose 移除硬编码默认密钥 | docker-compose.yml |
| ✅ | TickCount 49.7 天溢出修复 | TimeAwareness.cs |
| ✅ | BackendClient 连接状态机 + lock + SemaphoreSlim | BackendClient.cs |
| ✅ | VoiceManager token 竞态保护 (_streamLock) | VoiceManager.cs |
| ✅ | 4 个超时触发 OnUserNotification 用户反馈 | VoiceManager.cs |
| ✅ | Sleep→任意状态 统一恢复眼睛/身体姿态 | FoxAnimationController.cs |
| ✅ | DiagnosticBus 结构化错误报告 | DiagnosticBus.cs (新) |
| ✅ | WebSocket hello/welcome 协议版本握手 | BackendClient.cs, main.py |
| ✅ | TTSPlayer streaming AudioClip (消除 ~4MB/段 内存分配) | TTSPlayer.cs |
| ✅ | WAV dataSize 合法性校验 | TTSPlayer.cs |
| ✅ | mock_recognize 不返回随机假转录 | asr.py |

### 本次要做的 (提升计划)

| 阶段 | 内容 | 预估工时 |
|------|------|----------|
| **R1** 补刀 | 上次遗漏的关键项 | 2h |
| **R2** 用户感知 | 用户可见的体验改进 | 4h |
| **R3** 架构深层 | 接口抽象 + 管线统一 | 4h |
| **R4** 质量防线 | 关键路径测试 | 3h |
| **R5** 产品完善 | 记忆系统 + 导出/导入 | 3h |

---

## R1: 补刀 — 上次遗漏的关键修复 (2h)

### R1-1: CryptoHelper salt 丢失风险 [P1]

**问题**: AES fallback 用 `PlayerPrefs` 存 salt。重装系统/清理注册表 → salt 丢失 → 数据永久无法解密。
**修复**: 在 `SaveAuthTokens` 和 `SaveConfig` 成功后，将 salt 同时写入加密配置文件旁边的一个 `.salt` 文件。恢复时优先读 PlayerPrefs，fallback 读文件。

**文件**: `CryptoHelper.cs`
**状态**: ✅

### R1-2: WebSocket 重连后通知上层 [P1]

**问题**: 断连后自动重连成功，`VoiceManager` 不知道 → 可能卡在 Processing/Speaking 状态直到超时。
**修复**: `BackendClient` 成功重连后发送 `OnConnectionChanged(true)` 时，附加一个 `isReconnect` 标记。`VoiceManager` 监听后，如果在非 Idle 状态则强制复位。

**文件**: `BackendClient.cs`, `VoiceManager.cs`
**状态**: ✅

### R1-3: VoiceManager.SetState 重入保护 [P1]

**问题**: `OnStateChanged` 事件在 `SetState` 内部触发，监听者回调可能触发二次状态变更。
**修复**: 加 `_isTransitioning` 标志位，转换期间排队后续请求。

**文件**: `VoiceManager.cs`
**状态**: ✅

---

## R2: 用户感知 — 用户可见的体验改进 (4h)

### R2-1: 气泡 UI 联动 OnUserNotification [P1]

**问题**: `VoiceManager.OnUserNotification` 事件已触发，但没有 UI 层订阅 → 用户还是看不到。
**修复**: 在 `FoxInteraction` 或 App 层的 MonoBehaviour 中监听 `OnUserNotification`，用 Unity `GUI.Label` 或简单的世界空间气泡显示提示文字（3 秒淡出）。

**文件**: `VoiceManager.cs`, 新建 `UINotificationBubble.cs`
**状态**: ✅

### R2-2: PAD 情绪衰减曲线修正 [P2]

**问题**: 线性衰减太快，用户偶尔互动 → 狐狸永远"不够开心"。
**修复**: `PleasureDecayRate` 从常数改为随好感度 scale 的变量：`decayRate = baseRate * (1f - affectionLevel/200f)`。好感度越高，衰减越慢。

**文件**: `PADEmotionEngine.cs`
**状态**: ✅

### R2-3: DataStore 写入节流 [P2]

**问题**: 每条聊天记录触发一次全量 JSON 写盘。
**修复**: `MarkDirty()` + `Update()` 中每 5 秒检查 `_dirty` 标志才写入。

**文件**: `DataStore.cs`
**状态**: ✅

---

## R3: 架构深层 — 接口抽象与管线统一 (4h)

### R3-1: IVoicePipeline 接口 [P2]

**问题**: 三种 AI 后端（云端/离线/Mock）零抽象，集成方式各不相同。
**修复**: 创建 `IVoicePipeline` 接口，`BackendClient`、`AIManager`、`MockVoicePipeline` 全部实现。`VoiceManager` 只依赖接口。

**文件**: 新建 `IVoicePipeline.cs`, 修改 `VoiceManager.cs`
**状态**: ✅

### R3-2: Python BFF streaming 管线 [P2]

**问题**: ASR → LLM → TTS 全串行阻塞，感知延迟 3-10 秒。
**修复**: 在 ASR 得到 final transcript 后，立即启动 LLM streaming + TTS per-sentence 合成，不等 LLM 全文完成。

**文件**: `main.py`
**状态**: ✅

---

## R4: 质量防线 — 关键路径测试 (3h)

### R4-1: VoiceManager 状态机超时测试 [P2]

**问题**: 零测试，状态机是核心逻辑。
**修复**: Unity Test Runner PlayMode 测试：模拟 Processing 超时 → 验证 OnUserNotification 被触发 → 验证状态回到 Idle。

**文件**: 新建 `Tests/Runtime/Voice/VoiceManagerTests.cs`
**状态**: ✅

### R4-2: DataStore 加密往返测试 [P2]

**问题**: Auth Token 加密/解密逻辑从未被自动化验证。
**修复**: 写入 token → 存盘 → 读回 → 验证明文一致。

**文件**: 新建 `Tests/Runtime/Data/DataStoreTests.cs`
**状态**: ✅

### R4-3: Python BFF WebSocket 协议测试 [P2]

**问题**: 握手协议只在人肉测试中验证。
**修复**: pytest: 模拟 hello 握手 → 验证 welcome 响应 → 版本不匹配 → 验证 error + close。

**文件**: 新建 `backend/tests/test_ws_protocol.py`
**状态**: ✅

---

## R5: 产品完善 — 让狐狸"值得留下" (3h)

### R5-1: 长期记忆摘要 [P2]

**问题**: 20 条消息后就忘了，狐狸不知道你是谁。
**修复**: 在 `DataStore` 中添加简单的关键词提取：每次对话结束后，从 LLM 响应中提取 `[memory:...]` 标签之外的**隐式记忆**——保存用户提到的事实（如"我叫小明""我在学编程""我不喜欢吃辣"）到 `_data.userFacts` 列表。注入 LLM prompt 时作为 `user_profile` 字段。

**文件**: `DataStore.cs`, `VoiceManager.cs`
**状态**: ✅

### R5-2: 数据导出/导入 [P2]

**问题**: 加密数据绑定设备+用户，无法迁移到新电脑。
**修复**: 在 `ConfigManager` 加 `ExportEncryptedBackup(string password)` 和 `ImportEncryptedBackup(string password, byte[] data)`，用用户提供的密码做 PBKDF2 密钥派生。

**文件**: `ConfigManager.cs`, `DataStore.cs`
**状态**: ✅

---

## 执行进度总览

| 编号 | 任务 | 工时 | 状态 |
|------|------|------|------|
| R1-1 | CryptoHelper salt 持久化 | 1h | ✅ |
| R1-2 | WebSocket 重连通知 | 0.5h | ✅ |
| R1-3 | SetState 重入保护 | 0.5h | ✅ |
| R2-1 | 气泡 UI 联动通知 | 1.5h | ✅ |
| R2-2 | PAD 衰减曲线修正 | 1h | ✅ |
| R2-3 | DataStore 写入节流 | 0.5h | ✅ |
| R3-1 | IVoicePipeline 接口 | 3h | ✅ |
| R3-2 | Python BFF streaming | 2h | ✅ |
| R4-1 | VoiceManager 状态机测试 | 1h | ✅ |
| R4-2 | DataStore 加密往返测试 | 1h | ✅ |
| R4-3 | Python WS 协议测试 | 1h | ✅ |
| R5-1 | 长期记忆摘要 | 2h | ✅ |
| R5-2 | 数据导出/导入 | 1h | ✅ |

**总计**: ~16h，预计 2-3 个工作日。
