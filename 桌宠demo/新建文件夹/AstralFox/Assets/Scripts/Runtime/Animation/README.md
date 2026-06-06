# 动画系统

## 架构

```
PetAnimationManager (单例)
    └── IPetAnimator (接口)
            └── Live2DAnimator (适配器)
                    ├── FoxAnimationController (状态机)
                    │       ├── 6 状态: Idle / Listen / Speak / Sleep / Drag / Greet
                    │       ├── 12 空闲行为 (ScriptableObject 数据驱动)
                    │       ├── 眨眼 + 呼吸 + 头部微动
                    │       └── 状态转场: Sleep→Any 统一恢复眼睛/姿态
                    ├── FoxEmotionController (表情)
                    │       ├── 5 情绪: Neutral / Happy / Sad / Shy / Angry
                    │       ├── AnimationCurve 控制转场
                    │       ├── 耳朵随机抽动
                    │       └── 眼球追踪鼠标
                    ├── CubismParameterDriver (SDK 桥接)
                    │       ├── #if CUBISM_SDK_PRESENT 条件编译
                    │       └── fallback 字典 (无 SDK 也能跑)
                    └── PADEmotionEngine (PAD 情绪模型)
```

## 参数映射

参数名定义在 `FoxParamId.cs`，当前对齐 AI 生成模型的标准命名。
CubismParameterDriver 在初始化时自动检测参数可用性。
不存在的参数会优雅降级（例如 AI 模型无专用手臂参数，fallback 到 head angles）。

## 空闲行为

12 种空闲行为通过 `IdleBehaviorDef` ScriptableObject 配置。
每个行为定义多组 AnimationCurve，在 normalized time 0→1 上求值。
权重随机选择。没有 ScriptableObject 时自动用 hardcode 实现。

Asset 位置: `Assets/Settings/IdleBehaviors/Idle_*.asset`

## 可视化调试

Unity Editor 菜单: `AstralFox → Animation Monitor`
- 实时状态机面板（6 状态按钮，可手动切换）
- 情绪切换按钮
- 全部驱动参数实时滑动条
