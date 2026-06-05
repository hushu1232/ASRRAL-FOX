# 阶段 2 开发日志：Live2D 动画状态机

> 日期：2026-05-23
> 项目：星尘狐（AstralFox）

---

## 1. 技术思路

### 1.1 架构分层

Live2D 模型的动画驱动采用**三层架构**：

```
┌──────────────────────────────────────────────┐
│  第 3 层：FoxAnimationController             │
│  - 状态机 (Idle/Listening/Speaking/Sleep/    │
│    Dragging)                                 │
│  - 转换逻辑 & 定时器                         │
│  - 对外 API (SetState/SetEmotion/            │
│    SetMouthOpen)                             │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│  第 2 层：FoxEmotionController              │
│  - 情绪参数映射 (Happy/Sad/Shy/Angry)       │
│  - 情绪渐变过渡                              │
│  - 待机程序动画 (呼吸/耳朵/尾巴/眨眼)       │
│  - 视线追踪                                  │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│  第 1 层：CubismParameterDriver             │
│  - IFoxParameterDriver 接口                  │
│  - Live2D Cubism SDK 集成                   │
│  - 参数平滑插值                              │
│  - 无 SDK 时的回退字典模式                   │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│  Live2D CubismModel                         │
│  - 25+ 参数 (AngleX/Y/Z, EyeLOpen,          │
│    MouthOpenY, Breath, 表情参数...)          │
└──────────────────────────────────────────────┘
```

### 1.2 动画状态机设计

```
                    ┌──────────┐
        wake word   │          │  timeout
      ┌────────────►│   IDLE   │──────────┐
      │             │          │          │
      │             └─────┬────┘          │
      │                   │               │
      │                   │ wake word     │
      │                   ▼               ▼
      │             ┌──────────┐    ┌──────────┐
      │             │ LISTENING│    │  SLEEP   │
      │             │          │    │          │
      │             └────┬─────┘    └────┬─────┘
      │                  │              │
      │    response      │              │ wake word
      │    start         ▼              │
      │             ┌──────────┐        │
      │             │ SPEAKING │        │
      │             │          │        │
      │             └────┬─────┘        │
      │                  │              │
      │    response end  │              │
      └──────────────────┘              │
                                        │
              DRAGGING ◄────────────────┘
              (any state → Dragging on drag start)
              (Dragging → Idle on drag end)
```

**状态说明**：

| 状态 | 触发条件 | 视觉特征 |
|------|---------|---------|
| **Idle** | 默认状态 | 呼吸起伏、尾巴慢摇、偶尔抖耳、眨眼 |
| **Listening** | 唤醒词检测 | 身体前倾、耳朵竖起、眼睛睁大 |
| **Speaking** | TTS 开始播放 | 嘴巴开合（口型同步）、头部微点 |
| **Sleep** | Idle 超时 | 眼睛闭合、呼吸放缓、身体微蜷 |
| **Dragging** | 鼠标拖拽 | 四肢下垂、惊讶表情、尾巴垂落 |

### 1.3 Animator Controller 混合树

创建了 `FoxAnimator.controller`，包含：
- **5 个状态**：Idle、Listening、Speaking、Sleep、Dragging
- **参数**：State (int)、EmotionWeight (float)、MouthOpen (float)、IsDragging (bool)、IsSleeping (bool)
- **过渡**：基于 State 参数值的条件过渡，无退出时间（即时切换）
- **BlendTree**：Idle 和 Listening 状态包含 EmotionWeight 驱动的 1D 混合树，在 Neutral(0) 和 FullEmotion(1) 之间混合

> **注意**：Animator 负责状态管理，实际的 Live2D 参数值由 FoxAnimationController 在代码中驱动。混合树的 AnimationClip 是占位的，真实的表情混合在 FoxEmotionController 中完成。

### 1.4 Live2D 参数映射

模型至少需要以下 25+ 个参数（通过 FoxParamId 常量类定义）：

| 类别 | 参数名 | 范围 | 说明 |
|------|--------|------|------|
| 头部 | ParamAngleX/Y/Z | -30~30 | 头部旋转 |
| 身体 | ParamBodyAngleX/Y/Z | -20~20 | 身体旋转 |
| 眼睛 | ParamEyeLOpen/ROpen | 0~1 | 眼睛开合 |
| | ParamEyeBallX/Y | -1~1 | 视线方向 |
| | ParamEyeSmileL/R | 0~1 | 笑眼弧度 |
| 眉毛 | ParamBrowLY/RY | -1~1 | 眉毛高低 |
| | ParamBrowLAngle/RAngle | -1~1 | 眉毛角度 |
| 嘴巴 | ParamMouthOpenY | 0~1 | 嘴巴张开 |
| | ParamMouthForm | -1~1 | 嘴型 (-1=下弯 +1=上翘) |
| 耳朵 | ParamEarL/R | -1~1 | 耳朵角度 |
| | ParamEarLRotate/RRotate | -1~1 | 耳朵旋转 |
| 尾巴 | ParamTailSwing | -1~1 | 尾巴左右摆 |
| | ParamTailCurl | 0~1 | 尾巴卷曲 |
| | ParamTailWag | 0~1 | 尾巴摇动强度 |
| 手臂 | ParamArmL/R | -1~1 | 手臂位置 |
| 呼吸 | ParamBreath | 0~1 | 呼吸周期 |
| 情绪 | ParamEmotionHappy/Sad/Shy/Angry | 0~1 | 情绪混合 |
| 腮红 | ParamBlush | 0~1 | 腮红强度 |

### 1.5 情绪参数快照

4 种情绪的 Live2D 参数预设值：

| 参数 | Neutral | Happy | Sad | Shy | Angry |
|------|---------|-------|-----|-----|-------|
| EyeSmileL/R | 0 | 0.8 | 0 | 0.4 | 0 |
| BrowLY/RY | 0 | 0.3 | -0.6 | 0.1 | -0.5 |
| BrowLAngle/RAngle | 0 | 0.1 | -0.3 | -0.1 | -0.6 |
| MouthForm | 0 | 1.0 | -0.7 | 0.2 | -0.4 |
| EarL | 0 | 0.4 | -0.6 | -0.2 | -0.8 |
| EarR | 0 | 0.4 | -0.6 | -0.2 | 0.5 |
| TailSwingBase | 0 | 0.6 | 0 | 0 | -0.3 |
| TailCurl | 0.5 | 0.7 | 0.2 | 0.6 | 0.8 |
| Blush | 0 | 0.15 | 0 | 0.7 | 0.1 |

---

## 2. 文件清单

| 文件 | 位置 | 职责 |
|------|------|------|
| `FoxParamId.cs` | `Runtime/Animation/` | Live2D 参数名常量 |
| `IFoxParameterDriver.cs` | `Runtime/Animation/` | 参数驱动抽象接口 |
| `CubismParameterDriver.cs` | `Runtime/Animation/` | Live2D / 回退双模式参数驱动 |
| `FoxEmotionController.cs` | `Runtime/Animation/` | 情绪映射 + 待机动画 + 视线 |
| `FoxAnimationController.cs` | `Runtime/Animation/` | 核心状态机 |
| `FoxAnimatorSetup.cs` | `Editor/Animation/` | 创建 Animator Controller 资源 |

---

## 3. 配置步骤

### 3.1 导入 Live2D Cubism SDK

1. 从 [Live2D 官网](https://www.live2d.com/download/cubism-sdk/) 下载 Cubism SDK for Unity
2. 导入 `.unitypackage` 到项目
3. `PlayerSettings → Scripting Define Symbols` 添加 `CUBISM_SDK_PRESENT`
4. 将星尘狐模型文件夹拖入 `Assets/Models/AstralFox/`

### 3.2 配置 Animator Controller

1. Unity 菜单 `AstralFox > Setup Animator Controller`
2. 自动生成 `Assets/Animations/FoxAnimator.controller`
3. 自动生成占位 `Assets/Animations/AstralFox_DefaultPose.anim`

### 3.3 搭建场景

1. 运行 `AstralFox > Setup Desktop Pet Scene`
2. 自动挂载所有动画组件到 AstralFoxRoot
3. 若 Live2D 模型已导入：将模型 GameObject 设为 AstralFoxRoot 的子物体，CubismParameterDriver 会自动检测

### 3.4 不使用 Live2D SDK 时的回退模式

CubismParameterDriver 自带字典回退模式（`_useFallbackOnMissingSDK = true`）：
- 注册所有 30+ 参数到内存字典
- 支持完整的参数读写和动画状态机
- 参数变化仅在内存中，无视觉输出
- 适合开发动画逻辑和状态机，后续接入 Live2D 模型即可看到效果
