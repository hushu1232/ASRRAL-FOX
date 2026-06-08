# 悠小喵资源审计 & 情绪系统分析

> 日期: 2026-06-08
> 模型: 悠小喵 (Cubism 3, 236 Drawables, 168 Parameters)

---

## 一、原生资源使用状态

### ✅ 已使用（核心渲染链）

| 资源 | 使用位置 | 说明 |
|------|---------|------|
| `悠小喵.moc3` | CubismModel.Revive() | 二进制网格+参数表，整个模型的数据源 |
| `悠小喵.model3.json` | CubismModel3Json.LoadAtPath() | 模型入口文件 |
| `texture_00.png` | CubismBuiltinPickers.TexturePicker() | 8192 主纹理 |
| `texture_01.png` | CubismBuiltinPickers.TexturePicker() | 8192 副纹理 |
| `悠小喵.physics3.json` | CubismPhysicsController (SDK 自动) | 头发/耳朵/尾巴物理模拟 |
| `悠小喵.prefab` | AstralFoxSceneSetup.InstantiatePrefab() | Unity 预制体 |
| `悠小喵.asset` | CubismModel.Moc | Moc 资产引用 |
| `Materials/texture_*.mat` | CubismBuiltinPickers | 自动生成的混合模式材质 |
| `悠小喵.controller` | 未使用（代码绕过 Animator） | — |
| `常规.anim` | 未使用 | — |
| `常规.motion3.json` | 未使用 | — |
| 16 个 `.exp3.json` | 未使用 | — |

### ⚠️ 未使用但可用

| 资源 | 当前状态 | 未来可做什么 |
|------|---------|------------|
| **18 个表情 (.exp3.json)** | 已导入为 .exp3.asset，未调用 | 只需 `CubismExpressionController.PlayExpression()` 即可触发 |
| **常规.motion3.json** | 3 条参数曲线，未调用 | 可挂到 Animator 作为默认 Idle 动画 |
| **悠小喵.controller** | Unity Animator Controller，未激活 | 如果用 Animator 驱动，可替代 FoxAnimationController 的部分逻辑 |
| **items_pinned_to_model.json** | 空配置 | 可配置饰品（眼镜/帽子/徽章）挂点 |
| **悠小喵.vtube.json** | VTube Studio 配置 | Unity 项目不需要，可删除 |

### ❌ 不可用

| 资源 | 原因 |
|------|------|
| `常规.fade.asset` | 需要和 motion 配对使用，当前 motion 未播放 |
| `YouXiaoMiao.fadeMotionList.asset` | 同上 |

---

## 二、情绪参数定义机制

### 架构分层

```
外部事件（点击/拖拽/唤醒/睡觉）
  │
  ▼
PADEmotionEngine  ← 三维情绪（Pleasure/Arousal/Dominance）
  │  ApplyEvent(deltaP, deltaA, deltaD)
  │  ApplyDecay() → 每帧向基线衰减
  │
  ▼
PADToEmotion(p, a, d)  ← 5 维欧氏距离 → 最近情绪
  │
  ▼
FoxEmotionController.SetEmotion(Neutral/Happy/Sad/Shy/Angry)
  │  BuildEmotionMap() → 5 组 EmotionParamSnapshot
  │  LerpSnapshots() → 动画曲线插值过渡
  │
  ▼
CubismParameterDriver.SetParameter() ×12 参数
  │
  ▼
Live2D 原生层渲染
```

### 五组情绪快照 (EmotionParamSnapshot)

```
参数           │ Neutral │ Happy │ Sad   │ Shy   │ Angry
───────────────┼─────────┼───────┼───────┼───────┼───────
eyeSmile       │   0.0   │  0.8  │  0.0  │  0.4  │  0.0
browLY/RY      │   0.0   │  0.3  │ -0.6  │  0.1  │ -0.5
browLAngle     │   0.0   │  0.1  │ -0.3  │ -0.1  │ -0.6
mouthForm      │   0.0   │  1.0  │ -0.7  │  0.2  │ -0.4
earL/R         │   0.0   │  0.4  │ -0.6  │ -0.2  │ -0.3
tailSwingBase  │   0.0   │  0.6  │  0.0  │  0.0  │  0.5
tailCurl       │   0.5   │  0.7  │  0.2  │  0.6  │  0.4
blush          │   0.0   │  0.15 │  0.0  │  0.7  │  0.3
```

### 过渡机制

- 过渡时长: `_transitionDuration = 1s`（可在 Inspector 调整）
- 过渡曲线: `AnimationCurve.EaseInOut`
- 抑制抖动: 情绪稳定 2 秒后才真正切换（防止 PAD 值在边界来回跳）

---

## 三、情绪变化规则：不是随机的

### 核心规则：事件驱动 + 自然衰减

情绪 **不是随机变化的**。它遵循两条规则：

#### 规则 1：事件驱动（突然变化）

| 触发事件 | PAD 增量 | 触发位置 |
|---------|---------|---------|
| 🖱️ 点击抚摸 | +P +A | `FoxInteraction.OnFoxClicked()` |
| 🖱️ 拖拽 | -P +A | `FoxAnimationController.OnDragStart()` |
| 🔔 唤醒词触发 | +A | `FoxAnimationController.OnWakeWord()` |
| 😴 进入睡眠 | -A | `FoxAnimationController.UpdateIdleTimer()` → 空闲超时 |
| 🗣️ 用户说话 | +P +A +D | `VoiceManager` → `ResponseParser` 解析 LLM 情感标签 |

#### 规则 2：自然衰减（缓慢回归基线）

每帧 `ApplyDecay()` 工作：

```
Pleasure:  每秒衰减 0.003 → 约 5 分钟从 +1 衰减到 0
Arousal:   每秒衰减 0.005 → 约 3 分钟从 +1 衰减到 0
Dominance: 每秒衰减 0.0005 → 约 30 分钟从 +1 衰减到 0
```

衰减到**基线值**（而非 0）：
```
PleasureBaseline = 0.0
ArousalBaseline  = 0.0
DominanceBaseline = 0.1（角色天生微自信）
```

**好感度影响衰减速度**：好感度越高，愉悦度衰减越慢。`affectionScale = 1 - affection/200`，即满好感(100)时衰减速度减半。

### 完整情绪生命周期示例

```
初始状态: Neutral (P=0.2, A=0.3, D=0.1)

→ 用户点击抚摸: +0.3P +0.2A → P=0.5, A=0.5 → 进入 Happy
→ 每帧衰减: P→0.003/s, A→0.005/s
→ 3 分钟后: P≈0.0, A≈0.0 → 衰减回 Neutral
→ 用户拖拽: -0.1P +0.3A -0.2D → P=-0.1, A=0.3, D=-0.1
→ 被拖的不开心但很震惊 → 进入 Sad/Shy 边界
→ 5 分钟后衰减回 Neutral
→ 长时间无互动(>2min 空闲) → FoxAnimationController 进入 Sleep
→ Sleep 事件触发: -0.4A → A=-0.4 → 情绪显低迷
```

---

## 四、当前缺口与可做的事

### 缺口 1：18 个原生表情未接线

当前所有表情通过修改参数值实现（如 Happy 时 `mouthForm=1.0`）。但 18 个 `.exp3.json` 可以提供**更丰富、更细腻、设计师预设**的表情：

```csharp
// 未来代码示例：触发原生表情
var expController = model.GetComponent<CubismExpressionController>();
expController.PlayExpression(expressionAsset); // 如星星眼
```

**推荐优先接线**:
| 表情 | 触发场景 |
|------|---------|
| 星星眼 | 用户送礼物/好感度里程碑 |
| 哭哭 | 被骂/长时间不理 |
| 脸红 | 害羞情绪触发 |
| 黑脸 | 极度愤怒 |
| 流泪 | 感人对话后 |
| 前倾 | 语音对话中 (Speaking 状态) |
| 看手机 | 空闲行为之一 |
| 记笔记 | 空闲行为之一 |
| 隐藏配件系列 | 设置页面换装功能 |

### 缺口 2：motion 未使用

`常规.motion3.json` 有 3 条参数曲线可用于待机动画。可配合 Animator Controller 使用或代码手动播放。

### 缺口 3：配件系统未实现

`items_pinned_to_model.json` 定义了饰品挂点。可扩展为换装系统。

### 缺口 4：情绪输出单向

当前情绪只能从 PAD 映射到 FoxEmotion。没有**情绪反馈循环**——比如，Happy 状态下做特定动作、Sad 状态下拒绝交互等。

### 缺口 5：好感度只增不减基本

好感度仅在点击时 +0.5，在长时间离线时每秒衰减 1/24。缺乏**负反馈**机制（如用户骂角色会降好感度，目前 LLM 情感标签未接线到好感度变化）。
