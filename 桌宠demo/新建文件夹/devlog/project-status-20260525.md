# AstralFox 工程状态报告 — 2026-05-25

## 当前完成度: ~70%

### ✅ 已完成

#### 渲染系统
- [x] Built-in Render Pipeline 切换（从 URP）
- [x] Live2D Cubism 模型渲染可见（Akagi/chicheng_5, 1118 MeshRenderers）
- [x] 6个 BlendMode shader CGPROGRAM 转换（HLSL+CBUFFER→CG+直接声明）
- [x] CubismRenderer Play Mode 材质强制替换（TransparentPicking→CompatibleBlend）
- [x] CubismRenderController `[NonSerialized]` 防止序列化跳过初始化
- [x] Mask.shader Built-in RP 兼容（原本就是 CGPROGRAM）
- [x] 方向光自动创建（Built-in RP Standard shader 需要）
- [x] DesktopCameraSetup URP 安全反射访问
- [x] AstralFoxSceneSetup URP 安全反射 + 方向光
- [x] 0 编译错误，0 编译警告

#### 语音管线（全链路贯通）
- [x] 麦克风采集（MicrophoneCapture, 16000Hz mono）
- [x] VAD 语音活动检测
- [x] 唤醒词检测（F12 键盘 + 语音唤醒词）
- [x] WebSocket 连接 BFF（BackendClient, ws://localhost:8765）
- [x] Python BFF 运行正常（FastAPI, ASR mock, LLM mock, edge-tts TTS）
- [x] TTS 音频播放（PCM16→AudioClip→AudioSource.Play）
- [x] 完整状态机: Idle→Listening→Recording→Processing→Speaking→Idle
- [x] Windows 音频输出配置完成
- [x] 日志优化（BackendClient _logMessages=false, 摘要而非逐条）

#### 诊断工具
- [x] ModelVisibilityDebug: 渲染/光照/音频/材质属性全面诊断
- [x] 双音调测试音（440→880Hz, 1s, 验证音频硬件）
- [x] Voice E2E Test Scene 一键构建（AstralFox → Setup Voice E2E Test Scene）
- [x] SanityCheckCube 渲染测试

#### 动画系统
- [x] Live2DAnimator 适配器（参数驱动 + 表情控制 + 动画控制）
- [x] PetAnimationManager 状态机桥接
- [x] IPetAnimator 接口
- [x] FoxAnimator.controller 资源配置（Assets/Resources/）

#### Web 管理端
- [x] SettingsWebServer（内嵌 HTTP 设置页）
- [x] StreamingAssets/settings.html

### ⚠️ 待完成

#### 高优先级
- [ ] **更换桌宠模型**: 当前 Akagi 人形舰娘不适合桌宠（无法走/跳/骨架不匹配）
  - 建议: CatTail/cattail.prefab 或找 Q 版动物 Live2D 模型
  - 需要参数: ParamAngleX/Y/Z, ParamBodyAngleX/Y/Z, ParamBreath, ParamEyeLOpen 等
- [ ] **FoxSimpleMovement 与 Live2D 模型集成**: 桌面漫游需适配新模型
- [ ] **动画状态机完善**: idle/walk/sleep/greet 动画参数驱动

#### 中优先级
- [ ] **BFF 真实 API 接入**: 配置 Azure ASR/OpenAI Key（当前 mock 模式）
- [ ] **唤醒词精度提升**: 目前 VAD 假阳性较多
- [ ] **LipSync**: 口型同步已有代码框架，需参数调校
- [ ] **透明窗口穿透点击**: TransparentWindow 需要更多测试

#### 低优先级
- [ ] DragonBones 骨骼动画支持（备选方案，Assets/DragonBones.meta 已创建）
- [ ] 多模型切换 UI
- [ ] 独立构建测试（Build-Standalone.bat）
- [ ] Web 管理端完善（avatar-web-management Phase 2+）

### 📁 关键文件索引

| 用途 | 路径 |
|------|------|
| 场景构建 | `AstralFox/Assets/Scripts/Editor/AstralFoxSceneSetup.cs` |
| E2E测试场景 | `AstralFox/Assets/Scripts/Editor/Voice/VoiceManagerTestSetup.cs` |
| 渲染诊断 | `AstralFox/Assets/Scripts/Runtime/Diagnostics/ModelVisibilityDebug.cs` |
| 动画适配 | `AstralFox/Assets/Scripts/Runtime/Animation/Live2DAnimator.cs` |
| 语音主控 | `AstralFox/Assets/Scripts/Runtime/Voice/VoiceManager.cs` |
| BFF主入口 | `backend/main.py` |
| Shader修复 | `Assets/Live2D/Cubism/Rendering/Resources/.../BlendMode/*.shader` |
| Cubism渲染修复 | `Assets/Live2D/Cubism/Rendering/CubismRenderer.cs` (L952-955) |
| Cubism初始化修复 | `Assets/Live2D/Cubism/Rendering/CubismRenderController.cs` (L537) |

### 🚀 快速启动

```bash
# 1. 启动 BFF
cd backend && python main.py

# 2. Unity 中打开 AstralFox 项目
# 3. AstralFox → Setup Voice E2E Test Scene
# 4. 进入 Play Mode
# 5. F12 触发唤醒词，说话测试完整语音管线
```

### 📝 遗留注意事项

1. **Shader 标记**: 所有 BlendMode shader 已从 `HLSLPROGRAM + URP` 转为 `CGPROGRAM + Built-in`，`"RenderPipeline" = "UniversalPipeline"` tag 已移除
2. **URP Package**: 仍在项目中（仅禁用了 Pipeline Asset），shader include 路径有效，勿删除
3. **AudioListener**: AstralFoxSceneSetup 和 VoiceManagerTestSetup 都会自动创建
4. **Editor 材质泄漏**: 已在 VoiceManagerTestSetup 中改用 `sharedMaterial`
5. **Windows 音频**: 若无声，检查音量合成器中 Unity Editor 是否被静音
