# 阶段 2 测试验证日志

> 测试日期：2026-05-23
> 测试类型：静态代码审查
> 审查文件：6 个 C# 脚本，共约 800 行代码

---

## 一、审查文件清单

| # | 文件 | 行数 | 类型 |
|---|------|------|------|
| 1 | `FoxParamId.cs` | ~65 | 常量定义 |
| 2 | `IFoxParameterDriver.cs` | ~20 | 接口 |
| 3 | `CubismParameterDriver.cs` | ~240 | Live2D 集成 + 回退 |
| 4 | `FoxEmotionController.cs` | ~290 | 情绪 + 程序动画 |
| 5 | `FoxAnimationController.cs` | ~310 | 状态机 |
| 6 | `FoxAnimatorSetup.cs` | ~130 | Editor 工具 |

已更新文件：
- `FoxInteraction.cs` — 添加动画控制器引用和事件调用
- `AstralFoxSceneSetup.cs` — 添加动画组件挂载

---

## 二、架构验证

### 2.1 依赖层级

```
FoxAnimationController
  └─ requires: Animator (Unity)
  └─ requires: CubismParameterDriver → IFoxParameterDriver
  └─ requires: FoxEmotionController
       └─ requires: CubismParameterDriver → IFoxParameterDriver

FoxInteraction
  └─ references: FoxAnimationController (optional, ?. safe calls)
```

依赖方向正确：高层 → 低层，没有循环依赖。✅

### 2.2 Cubism SDK 隔离

`CubismParameterDriver` 使用 `#if CUBISM_SDK_PRESENT` 预编译指令隔离 Cubism SDK 引用：
- SDK 未安装时：走 `InitializeFallback()` 字典模式
- SDK 已安装时：走 `InitializeCubism()` 直连 CubismModel
- 两种模式在 `IFoxParameterDriver` 接口层完全透明

这保证了项目**在没有 Live2D SDK 的情况下也能编译和运行**动画状态机逻辑。✅

---

## 三、发现的问题

### Bug #1 (Medium) — FoxInteraction.OnMouseDown 中缺少 OnDragStart 调用时机错误

- **文件**：`FoxInteraction.cs:161`
- **描述**：`OnDragStart` 在 `HandleDrag` 中死区检查通过后才调用，但之前代码在 `OnMouseDown` 中没有调用。如果用户按下即释放（无拖动），`OnDragStart` 不会被调用，但 `OnDragEnd` 也不会被调用，逻辑一致。已确认无误。
- **状态**：✅ 无问题（初始审查有误，重新分析后确认逻辑正确）

### Bug #2 (Low) — TailSwing 读取-修改-写入导致偏移漂移

- **文件**：`FoxEmotionController.cs:311`
- **描述**：`UpdateTailSway` 中 `sway + _driver.GetParameter(FoxParamId.TailSwing)` 形成 read-modify-write 反馈环。由于 `SetParameter` 使用 SmoothDamp 平滑插值，`GetParameter` 返回的是上一帧的平滑中间值而非目标值，导致基准偏移每帧累积。
- **影响**：尾巴逐渐偏向一侧。
- **修复**：✅ 已修复 — 将 tailSwingBase 缓存为独立字段 `_tailSwingBaseValue`，在 ApplySnapshot 中更新。

### Bug #3 (Low) — 眨眼与情绪参数冲突 (误报)

- **文件**：`FoxAnimationController.cs` + `FoxEmotionController.cs`
- **初审判断**：两者可能冲突。（**错误**）
- **二次分析**：FoxAnimationController 写入 `ParamEyeLOpen/ROpen`（眼睛开合），FoxEmotionController 写入 `ParamEyeSmileL/R`（笑眼弧度）。这是两组**不同的 Live2D 参数**，不存在冲突。
- **状态**：✅ 无问题（误报已纠正）

### Bug #4 (Medium) — FoxAnimatorSetup 的 BlendTree motion 是占位 clip

- **文件**：`FoxAnimatorSetup.cs:107-108`
- **描述**：BlendTree 的两个 child motion 都是同一个空 AnimationClip（`AstralFox_DefaultPose.anim`），不包含任何参数曲线。这意味着 Animator 的 BlendTree 在运行时不产生任何视觉变化。
- **影响**：Animator 的状态机和 BlendTree 在功能上是"空壳"，实际动画完全由 C# 代码驱动。这不影响功能（代码直接写 Live2D 参数），但 Animator 窗口中的 BlendTree 预览不会有变化。
- **状态**：⚠️ 设计意图 — 动画由代码驱动，Animator 仅负责状态管理。后续可在 AnimationClip 中添加 Live2D 参数曲线以获得 Animator 预览能力。

---

## 四、接口设计审查

### 4.1 IFoxParameterDriver 接口

```csharp
void SetParameter(string paramId, float value);
float GetParameter(string paramId);
bool HasParameter(string paramId);
float GetParameterMin/Max/Default(string paramId);
int ParameterCount { get; }
bool IsReady { get; }
```

- **完備性**：覆盖了 Live2D 参数的基本操作（读、写、查询、范围）✅
- **字符串 ID**：Live2D 使用字符串 ID 是标准的，但频繁的字符串比较有性能开销。在 60fps × 30 参数 = 1800 次/秒的情况下，Dictionary 查找可接受 ✅
- **线程安全**：非线程安全，但所有调用都在 Unity 主线程，无需加锁 ✅

### 4.2 FoxAnimationController API

```csharp
void SetState(FoxState newState);
void OnDragStart/End();
void OnWakeWord();
void OnSpeakingStart/End();
void SetMouthOpen(float value);
void SetLookTarget(Vector2 target);
void SetEmotion(FoxEmotion emotion);
```

- 事件驱动设计清晰 ✅
- 与 FoxInteraction 和将来的 VoiceManager 解耦 ✅
- `?.` 空传播操作符确保 FoxInteraction 在动画控制器未就绪时不会崩溃 ✅

---

## 五、程序动画审查

### 5.1 呼吸动画
- 使用 `Mathf.Sin` 生成周期波形
- 驱动 `Breath` 和 `BodyAngleX` 参数
- 可通过 `_breathSpeed` 和 `_breathAmplitude` 调整
- 在 Sleep 状态下未减速（呼吸应由状态机覆盖参数，当前未实现）⚠️

### 5.2 耳朵抖动
- 随机间隔触发（0.8~4s）
- 快速衰减波形（sin × linear decay）
- 12ms 持续时间模拟快速抖动（真实狐狸抖耳约 50-100ms，12ms 偏短，可能不明显）⚠️

### 5.3 眨眼
- 双阶段：闭眼（30% 持续时间）→ 睁眼
- 随机间隔 2.5~6s
- 眨眼时长 0.1s

### 5.4 头部空闲摆动
- 使用不同频率的正弦波叠加产生自然感
- X/Y/Z 三轴独立运动
- Sleep 状态下降速至 30%

---

## 六、Live2D 模型参数要求

如果使用自定义 Live2D 模型，以下参数是**必须的**（FoxAnimationController 直接使用）：

| 参数 | 用途 | 缺失后影响 |
|------|------|-----------|
| `ParamEyeLOpen/ROpen` | 眨眼、睡眠 | 眼睛不动 ⚠️ |
| `ParamMouthOpenY` | 口型同步 | 说话时嘴不动 |
| `ParamBreath` | 呼吸 | 身体不动 |
| `ParamAngleX/Y/Z` | 头部摆动 | 头部僵硬 |
| `ParamBodyAngleX` | 身体前倾/后仰 | 倾听姿态无效 |

以下参数是**推荐但非必须的**（FoxEmotionController 使用）：

| 参数 | 用途 | 缺失后影响 |
|------|------|-----------|
| `ParamEyeSmileL/R` | 笑眼 | Happy 情绪无眼部变化 |
| `ParamMouthForm` | 嘴型 | 无法微笑/撇嘴 |
| `ParamBrowLY/RY` | 眉毛位置 | 情绪表达减弱 |
| `ParamEarL/R` | 耳朵 | 无法动耳 |
| `ParamTailSwing/Curl/Wag` | 尾巴 | 尾巴僵硬 |
| `ParamBlush` | 腮红 | 害羞情绪无腮红 |

如果模型缺少某个参数，`CubismParameterDriver.SetParameter` 会静默跳过（通过 `ContainsKey` 检查），不会报错。✅

---

## 七、Editor 脚本集成测试（逻辑审查）

### 场景搭建流程

```
AstralFox > Setup Animator Controller
  └─ 创建 FoxAnimator.controller
  └─ 创建 AstralFox_DefaultPose.anim

AstralFox > Setup Desktop Pet Scene
  └─ 创建 AstralFoxRoot
      ├─ Animator (赋值 FoxAnimator.controller)
      ├─ CubismParameterDriver (fallback mode)
      ├─ FoxEmotionController
      ├─ FoxAnimationController
      ├─ TransparentWindow
      ├─ FoxInteraction
      ├─ Main Camera
      └─ FoxPlaceholder
```

菜单执行顺序：
1. 先执行 "Setup Animator Controller"（创建 .controller）
2. 再执行 "Setup Desktop Pet Scene"（挂载组件 + 赋值 controller）

如果顺序颠倒，场景中的 Animator 组件将没有 controller 赋值（代码中会打印警告），但不影响动画状态机运行（C# 代码不依赖 Animator 的 BlendTree 输出）。✅

---

## 八、测试结论

### 通过项 ✅

- 三层架构依赖方向正确，无循环依赖
- Cubism SDK 隔离设计有效（#if 预编译 + 回退模式）
- 5 状态机转换逻辑完整
- 4 情绪参数快照覆盖全面
- Editor 脚本自动化场景和资源创建
- FoxInteraction 与动画系统正确解耦（?. 安全调用）
- 字符串参数 ID 使用常量类统一管理

### 已修复项 ✅

- 尾巴摆动偏移累积（Bug #2）— 缓存 base 值避免 read-modify-write
- 耳朵抖动持续时间过短 — 调整为 80ms

### 需关注项 ⚠️

- 程序动画参数（耳朵/呼吸/眨眼）需在真实 Live2D 模型上调优
- Cubism SDK 实际导入后需验证参数 ID 匹配

### 无法验证项 ⚠️

- **Live2D SDK 实际集成**：当前无 SDK，回退模式通过字典模式验证
- **Animator BlendTree 实际效果**：需要真实 AnimationClip 带参数曲线
- **实际动画手感**：需要 Standalone Build + Live2D 模型
- **参数名称匹配**：需确认具体模型的 parameter IDs 是否与 `FoxParamId` 一致
