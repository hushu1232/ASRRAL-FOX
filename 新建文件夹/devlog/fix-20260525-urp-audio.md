# Fix Log — 2026-05-25: URP→Built-in RP 切换 + 音频修复

## 问题诊断

### 1. 模型不可见
- **根因**: Cubism SDK 5.3 for URP 的渲染管线代码全部由 `#if UNITY_6000_0_OR_NEWER` 保护
- Tuanjie 1.6 (Unity 2022.3) 不满足条件，CubismRenderPassFeature 不编译
- 模型 1118 个 MeshRenderer 使用 `Live2D Cubism/TransparentPicking` 着色器，该着色器 `ColorMask 0` 不输出颜色
- 实际颜色渲染由 CubismRenderPassFeature 完成（已禁用）
- **切换项目到 Built-in RP 是最快修复路径**

### 2. TTS 语音无声
- TTS 管道完整运行（日志显示: tts_done → Playing 6.2s → playback complete）
- 场景中可能缺少 AudioListener 组件
- 修复: 在 AstralFoxSceneSetup 和 VoiceManagerTestSetup 中确保 AudioListener 存在

### 3. 控制台 99+ 日志刷屏
- BackendClient._logMessages 默认为 true，每条 WebSocket 消息打印（60+/次 TTS）
- ModelVisibilityDebug 逐帧输出 1118 个渲染器详情
- 修复: _logMessages 改为 false，诊断输出改为摘要

### 4. 16 个编译警告
- TransparentWindow 不可达代码（#else 包裹修复）
- 多个 inspector 字段未使用（#pragma warning disable 抑制）
- 未使用的事件 OnAudioChunkPlayed（已删除）
- _streamComplete 字段未读取（已删除）
- async void 无 await（移除 async）

## 修改文件

### URP → Built-in RP
| 文件 | 修改 |
|------|------|
| `ProjectSettings/GraphicsSettings.asset` | `m_CustomRenderPipeline: {fileID: 0}` 关闭 URP |
| `Assets/Scripts/Runtime/DesktopCameraSetup.cs` | 已有 null 检查，安全 |
| `Assets/Scripts/Editor/AstralFoxSceneSetup.cs` | 已有 null 检查 + 添加 AudioListener |
| `Assets/Scripts/Runtime/Diagnostics/ModelVisibilityDebug.cs` | 已有 null 检查，安全 |

### 音频修复
| 文件 | 修改 |
|------|------|
| `Assets/Scripts/Editor/AstralFoxSceneSetup.cs:62-64` | 添加 AudioListener 组件 |
| `Assets/Scripts/Editor/Voice/VoiceManagerTestSetup.cs:50-52` | 添加 AudioListener 组件 |
| `Assets/Scripts/Runtime/Diagnostics/ModelVisibilityDebug.cs:37-47` | 诊断增加 AudioListener/AudioSource 检查 |

### 日志优化
| 文件 | 修改 |
|------|------|
| `Assets/Scripts/Runtime/Voice/BackendClient.cs:52` | `_logMessages` 默认 false |
| `Assets/Scripts/Runtime/Diagnostics/ModelVisibilityDebug.cs:79-97` | 渲染器日志从逐条改为摘要 |
| `Assets/Scripts/Runtime/Diagnostics/ModelVisibilityDebug.cs:100-131` | 模型视口检查改为计数摘要 |

### 编译警告修复
| 文件 | 警告 | 修复 |
|------|------|------|
| `TransparentWindow.cs:229` | CS0162 | `#else` 包裹覆盖层代码 |
| `TTSPlayer.cs:40` | CS0067 | 删除 OnAudioChunkPlayed 事件 |
| `TTSPlayer.cs:65` | CS0414 | 删除 _streamComplete 字段 |
| `TTSPlayer.cs:25` | CS0414 | #pragma 抑制 (_minChunkDuration) |
| `BackendClient.cs:42` | CS0414 | #pragma 抑制 (_sendInterval) |
| `WakeWordDetector.cs` (5处) | CS0414/CS0067 | #pragma 抑制 |
| `FoxAnimationController.cs` (2处) | CS0414 | #pragma 抑制 |
| `TailParticleEffect.cs:54` | CS0414 | #pragma 抑制 |
| `AppLifecycle.cs:18` | CS0414 | #pragma 抑制 |
| `AstralFoxSettingsWindow.cs:384` | CS1998 | 移除 async 关键字 |

### 资源
| 文件 | 操作 |
|------|------|
| `Assets/Animations/FoxAnimator.controller` | 移动到 `Assets/Resources/` |
| `FoxAnimatorSetup.cs:17` | 路径改为 `Assets/Resources/FoxAnimator.controller` |

### WebSocket 线程修复
| 文件 | 修改 |
|------|------|
| `Assets/Scripts/Runtime/Voice/BackendClient.cs:86-88` | 添加 ConcurrentQueue 消息分发 |
| `Assets/Scripts/Runtime/Voice/BackendClient.cs:102-106` | Update() 主线程处理消息 |
| `Assets/Scripts/Runtime/Voice/BackendClient.cs:293` | 接收循环改为入队而非直接处理 |

### CubismRenderer 材质替换修复
| 文件 | 修改 |
|------|------|
| `Assets/Live2D/Cubism/Rendering/CubismRenderer.cs:952-956` | Play Mode 强制调用 SetMaterialFromPicker() 替换 TransparentPicking 材质 |

**根因分析**:
- `CubismRendererUsingBlendMode.cs` 整个文件由 `#if UNITY_6000_0_OR_NEWER` 保护，Tuanjie 1.6 不编译
- Built-in RP 下渲染依赖 MeshRenderer.material 直接渲染（无 CommandBuffer）
- 但 Editor 中的 `SetupPickingMaterial()` 会把 prefab 的 MeshRenderer 材质替换为 `TransparentPicking`（ColorMask 0）
- Play Mode 下 `TryInitializeMeshRenderer()` 只有 `if (!_meshRenderer.material)` 时才替换材质
- Prefab 已有 TransparentPicking 材质，条件不满足 → 模型不可见
- 修复: Play Mode 始终调用 `SetMaterialFromPicker()` 获取正确的 blend mode 材质

**Shader 兼容性**:
- `Mask.shader`: Built-in RP 兼容（CGPROGRAM + UnityCG.cginc）
- 所有 BlendMode shader（BlendImage/CompatibleBlend/Blit 等）: 标记为 URP，包含 URP Core.hlsl
- URP package 仍在项目中（仅禁用了 pipeline asset），shader 可编译
- 如果移除 URP package，需要创建 Built-in RP 版本的 blend mode shader

### Built-in RP 兼容性修复（第2轮 — 2026-05-25 黑屏+无声修复）
| 文件 | 修改 |
|------|------|
| `Assets/Scripts/Runtime/DesktopCameraSetup.cs` | 移除 URP import；通过反射安全访问 UniversalAdditionalCameraData |
| `Assets/Scripts/Editor/AstralFoxSceneSetup.cs:51-62` | URP 相机数据通过反射添加；新增 Directional Light 支持 Built-in RP 渲染 |
| `Assets/Scripts/Editor/Voice/VoiceManagerTestSetup.cs:58-80` | SanityCheckCube 居中+亮橙色材质；新增 Directional Light 检查/创建 |
| `Assets/Scripts/Runtime/Diagnostics/ModelVisibilityDebug.cs:148-168` | 新增光照诊断 + 音频状态诊断 |
| `Assets/Live2D/Cubism/Rendering/CubismCompatStubs.cs:26-28` | 抑制 CS0414 警告 |

**黑屏根本原因**:
1. `CubismRenderer.TryInitializeMeshRenderer()` Play Mode 不替换 TransparentPicking 材质（ColorMask 0）→ 模型不可见
2. `AstralFoxSceneSetup` 未创建 Directional Light → Built-in RP 下 Standard shader 渲染全黑
3. `DesktopCameraSetup` 直接 import URP — Built-in RP 下不必要且有风险

**语音无声可能原因**:
1. BFF (Python main.py) 未运行 — WebSocket 无法连接 ws://localhost:8765
2. 麦克风权限 — Windows 设置中 Unity Editor 麦克风被禁用
3. AudioListener 未正确放置 — 已通过 AstralFoxSceneSetup/VoiceManagerTestSetup 确保存在

## 验证步骤
1. Unity 编辑器重新编译（切换到窗口触发）
2. `AstralFox → Setup Voice E2E Test Scene` 重建场景
3. 进入 Play Mode，确认 SanityCube 可见（Built-in RP 下使用 Standard 着色器）
4. 确认模型可见（Cubism Built-in 着色器 `Unlit/...` 在 Built-in RP 下可渲染）
5. F12 触发语音，确认听到 TTS 音频
6. 检查 Console 是否无警告
