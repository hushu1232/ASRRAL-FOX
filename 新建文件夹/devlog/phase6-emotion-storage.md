# Phase 6 实现文档 — PAD 情感系统与本地存储

> 日期：2026-05-23
> 实现：Claude Code
> 状态：代码完成，待运行测试

---

## 技术思路简述

Phase 6 实现 PAD 三维情感模型和本地数据持久化：

### PAD 情感模型
- **P (Pleasure/愉悦度)**: -1 ~ +1，从厌恶到愉悦
- **A (Arousal/唤醒度)**: -1 ~ +1，从困倦到兴奋
- **D (Dominance/支配度)**: -1 ~ +1，从顺从到自信

PAD 值随时间衰减至基线，受互动事件影响，并反向驱动动画表情。

### PAD → 情绪映射
使用欧几里得距离最近匹配：
- Happy: (+0.7P, +0.5A, +0.4D)
- Sad:   (-0.7P, -0.4A, -0.5D)
- Shy:   (+0.1P, -0.3A, -0.5D)
- Angry: (-0.6P, +0.5A, +0.5D)
- Neutral: 加权(×1.2)偏向

### 数据存储
使用 JSON 文件存储（`Application.persistentDataPath/astralfox_data.json`），易于调试，无需外部 DLL。可后续平滑迁移到 SQLite。

---

## 新增文件

### 1. PADEmotionEngine.cs
**路径**: `Assets/Scripts/Runtime/Animation/PADEmotionEngine.cs`

**职责**: PAD 三维情感计算引擎

**关键特性**:
- 12 种预定义情感事件（被摸头、被冷落、正面对话、负面对话、醒来、入睡、被拖拽、喂食、受惊、被夸奖、被骂、久别重逢）
- 每种事件有预设的 PAD 变化量
- P/A 约 3-5 分钟衰减回基线，D 约 30 分钟（性格稳定）
- 平滑过渡（0.15s SmoothDamp）
- 情绪切换有 2 秒稳定期（防止闪烁）
- 生成 LLM 提示词用的情绪描述文本
- 每 30 秒自动持久化当前 PAD 值

### 2. DataStore.cs
**路径**: `Assets/Scripts/Runtime/Data/DataStore.cs`

**职责**: JSON 文件数据存储（可替换为 SQLite）

**存储内容**:
- 对话历史（最近 500 条，内存缓存 20 条）
- 情感记录（最近 200 条 PAD 快照）
- 好感度（0-100，含上次互动时间、总互动次数）
- 自定义设置（键值对）
- 当前 PAD 值

**关键特性**:
- 单例模式，全局访问 `DataStore.Instance`
- 原子写入（写临时文件后重命名）
- `Application.persistentDataPath` 持久化路径
- 好感度衰减：每 24 小时不互动 -1 点
- 对话摘要生成（用于 LLM 提示词注入）

### 3. AppLifecycle.cs
**路径**: `Assets/Scripts/Runtime/AppLifecycle.cs`

**职责**: 应用生命周期管理（数据持久化触发）

**关键特性**:
- `OnApplicationQuit()` 保存数据
- `OnApplicationPause()` 保存数据
- 启动时应用好感度衰减

---

## 修改文件

### FoxInteraction.cs
- 添加 `_padEngine` 引用
- `OnFoxClicked()` 触发 `Petted` 事件 + 好感度 +0.5

### FoxAnimationController.cs
- 添加 `_padEngine` 引用
- `OnDragStart()` 触发 `Dragged` 事件
- `OnWakeWord()` 触发 `WakeUp` 事件
- `Idle→Sleep` 触发 `FallAsleep` 事件

### VoiceManager.cs
- `EndRecording()` 发送包含情绪上下文和对话历史的 JSON 消息
- `BuildContextMessage()` 方法构建上下文 JSON

### AstralFoxSceneSetup.cs
- 添加 PADEmotionEngine 和 AppLifecycle 组件
- 更新调试日志

### backend/main.py
- `end_of_speech` 处理中提取 `emotion_context` 和 `chat_history`
- 传递给 LLM 服务

### backend/llm.py
- `chat()` 方法接受 `emotion_context` 和 `chat_history` 参数
- 动态注入系统提示词
- `_mock_chat()` 也支持上下文响应

---

## 情感事件定义

| 事件 | P 变化 | A 变化 | D 变化 | 触发条件 |
|------|--------|--------|--------|----------|
| Petted | +0.3 | +0.2 | +0.1 | 点击狐狸身体 |
| Ignored | -0.1 | -0.15 | -0.05 | 长时间不互动（待实现） |
| PositiveChat | +0.2 | +0.15 | +0.1 | 对话情绪正面 |
| NegativeChat | -0.2 | +0.05 | +0.1 | 对话情绪负面 |
| WakeUp | +0.05 | +0.5 | +0.05 | 唤醒词检测 |
| FallAsleep | 0 | -0.4 | -0.1 | 空闲超时进入睡眠 |
| Dragged | -0.1 | +0.3 | -0.2 | 拖拽狐狸 |
| Fed | +0.35 | +0.25 | +0.05 | 喂食功能（待实现） |
| Scared | -0.4 | +0.5 | -0.4 | 惊吓（待实现） |
| Complimented | +0.4 | +0.1 | +0.2 | LLM 判定夸奖 |
| Insulted | -0.3 | +0.2 | +0.15 | LLM 判定负面 |
| PlayedWith | +0.3 | +0.3 | +0.15 | 游戏功能（待实现） |
| LongAbsence | -0.25 | -0.3 | -0.15 | 好感度衰减触发 |

---

## 数据流路径

```
用户互动 → PADEmotionEngine.ApplyEvent()
  ├── → 修改 raw P/A/D 值
  ├── → DataStore.AddEmotionRecord()
  └── → Update(): 衰减 + 平滑
       └── → PADToEmotion() → FoxEmotionController.SetEmotion()
          └── → Live2D 参数混合

对话交互 → VoiceManager
  ├── → BuildContextMessage()
  │    └── → PADEmotionEngine.GetEmotionPromptContext()
  │    └── → DataStore.GetRecentChatSummary()
  └── → BackendClient.SendTextAsync(contextJson)
       └── → FastAPI BFF → LLM prompt injection
            └── → LLM 回复包含情感一致性

应用生命周期 → AppLifecycle
  ├── → OnApplicationQuit → DataStore.Save()
  └── → OnApplicationPause → DataStore.Save()
```

---

## Unity 配置步骤

1. 运行 `AstralFox > Setup Desktop Pet Scene` 一键配置
2. PADEmotionEngine Inspector 配置:
   - Initial Pleasure: 0.2, Arousal: 0.3, Dominance: 0.1
   - Decay Rates 使用默认值即可
3. 数据文件位置: `%APPDATA%/../LocalLow/DefaultCompany/AstralFox/astralfox_data.json`
4. 清除数据: 删除上述 JSON 文件重新启动即可

---

## 测试要点

| 测试项 | 方法 | 预期结果 |
|--------|------|----------|
| PAD 初始值 | 启动应用查看日志 | P≈0.2, A≈0.3, D≈0.1 |
| 点击触发事件 | 点击狐狸身体 | Petted 事件, PAD 上升, 好感度 +0.5 |
| 情绪衰减 | 等待 5 分钟无互动 | P/A 趋近基线 0 |
| 情绪切换 | 连续触发不同事件 | FoxEmotion 平滑切换，至少 2s 稳定 |
| 数据持久化 | 退出再重启 | PAD 值和好感度恢复 |
| LLM 上下文注入 | 查看后端日志 | emotion_context 包含当前情绪描述 |
| 好感度衰减 | 修改时间戳模拟 | 24h 不互动 -1 点 |
