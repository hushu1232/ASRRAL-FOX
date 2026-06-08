# 原生表情接入 + 快捷键 + 画质提升规划

> 日期: 2026-06-08

---

## 一、接入 18 个原生表情

### 现状

- 18 个 `.exp3.json` → 已由 SDK 导入为 `.exp3.asset`（CubismExpressionData）
- `YouXiaoMiao.expressionList.asset` → 已生成（CubismExpressionList，引用 16 个表情）⚠️ 仅 16 个
- `CubismExpressionController` → SDK 已提供，**未挂载到任何 GameObject**
- 表情播放 API: `CubismExpressionController` 通过 `CurrentExpressionIndex` 索引播放

### 实施计划

#### Step 1: 挂载 CubismExpressionController（1 行代码）

在 `AstralFoxSceneSetup.SetupLive2DModelComponents()` 中添加：

```csharp
// 文件: Assets/Scripts/Editor/AstralFoxSceneSetup.cs
// 位置: SetupLive2DModelComponents() 方法末尾

var expController = live2DGo.GetComponent<CubismExpressionController>();
if (expController == null) expController = live2DGo.AddComponent<CubismExpressionController>();
expController.ExpressionsList = AssetDatabase.LoadAssetAtPath<CubismExpressionList>(
    "Assets/Live2D/Models/YouXiaoMiao/YouXiaoMiao.expressionList.asset");
```

#### Step 2: 创建快捷键测试脚本

```csharp
// 新文件: Assets/Scripts/Runtime/ExpressionHotkeys.cs
// 功能: 数字键 0-9 + F1-F8 触发 18 个表情

[RequireComponent(typeof(CubismExpressionController))]
public class ExpressionHotkeys : MonoBehaviour
{
    private CubismExpressionController _expCtrl;

    // 快捷键 → 表情名 映射
    private static readonly KeyCode[] Hotkeys = {
        KeyCode.Alpha0, KeyCode.Alpha1, KeyCode.Alpha2, KeyCode.Alpha3,
        KeyCode.Alpha4, KeyCode.Alpha5, KeyCode.Alpha6, KeyCode.Alpha7,
        KeyCode.Alpha8, KeyCode.Alpha9,
        KeyCode.F1, KeyCode.F2, KeyCode.F3, KeyCode.F4,
        KeyCode.F5, KeyCode.F6, KeyCode.F7, KeyCode.F8,
    };

    void Awake() { _expCtrl = GetComponent<CubismExpressionController>(); }

    void Update()
    {
        for (int i = 0; i < Hotkeys.Length; i++)
        {
            if (Input.GetKeyDown(Hotkeys[i]))
            {
                if (i < _expCtrl.ExpressionsList.CubismExpressionObjects.Length)
                {
                    _expCtrl.CurrentExpressionIndex = i;
                    Debug.Log($"[Expression] {_expCtrl.ExpressionsList.CubismExpressionObjects[i].name}");
                }
            }
        }
        // ESC 清除表情
        if (Input.GetKeyDown(KeyCode.Escape))
            _expCtrl.CurrentExpressionIndex = -1;
    }
}
```

#### Step 3: 表情→情绪联动（可选升级）

将表情接入现有情绪系统，让 PAD 情绪自动触发对应表情：

```csharp
// FoxEmotionController.BuildEmotionMap() 中添加原生表情索引
private static readonly Dictionary<FoxEmotion, int> EmotionToExpressionIndex = new()
{
    [FoxEmotion.Happy]  = 3,  // 星星眼
    [FoxEmotion.Sad]    = 1,  // 哭哭
    [FoxEmotion.Shy]    = 8,  // 脸红
    [FoxEmotion.Angry]  = 15, // 黑脸
    [FoxEmotion.Neutral] = -1, // 清除表情
};

// SetEmotion() 中:
_expController.CurrentExpressionIndex = EmotionToExpressionIndex[emotion];
```

### 表情索引映射表

表情在 `expressionList.asset` 中的顺序（按字母序）：

| 键位 | 索引 | 表情 | 效果 |
|------|------|------|------|
| 0 | 0 | 前倾 | 身体前倾 |
| 1 | 1 | 哭哭 | 眼泪 |
| 2 | 2 | 常规 | — (motion, 非 expression) |
| 3 | 3 | 扶脸 | 手扶脸颊 |
| 4 | 4 | 星星眼 | 星形瞳孔 |
| 5 | 5 | 晕晕眼 | 螺旋眼 |
| 6 | 6 | 水印开关 | 显示水印 |
| 7 | 7 | 流泪 | 泪珠 |
| 8 | 8 | 看手机 | 低头看手机 |
| F1 | 9 | 脸红 | 腮红 |
| F2 | 10 | 记笔记 | 低头写字 |
| F3 | 11 | 隐藏发夹 | 发夹可见性 |
| F4 | 12 | 隐藏外套 | 外套可见性 |
| F5 | 13 | 隐藏帽子 | 帽子可见性 |
| F6 | 14 | 隐藏耳朵 | 兽耳可见性 |
| F7 | 15 | 飞头 | 头部浮空 |
| F8 | 16 | 黑脸 | 脸变黑 |

---

## 二、快捷键系统总览

整合所有快捷键：

| 快捷键 | 功能 | 文件 |
|--------|------|------|
| F2 | 打开 Web 设置面板 | FoxInteraction.cs（已有） |
| F3 | 切换诊断覆盖层 | DebugOverlay.cs（已有） |
| F12 | 模拟唤醒词 | WakeWordDetector.cs（已有） |
| Ctrl+Alt+S | 打开设置 | GlobalHotkeyManager.cs（已有） |
| Ctrl+Alt+F | 切换宠物显示 | GlobalHotkeyManager.cs（已有） |
| **0-9, F1-F8** | **触发原生表情** | **ExpressionHotkeys.cs（新增）** |
| **ESC** | **清除表情** | **ExpressionHotkeys.cs（新增）** |

---

## 三、对齐 Live2D 预览画质

### Live2D Cubism Viewer vs Unity 差异分析

| 维度 | Live2D 预览 | 当前 Unity | 差距 |
|------|-----------|-----------|------|
| 渲染分辨率 | 原生窗口分辨率 | 800×900 RenderTexture | Unity 需要更大的 RT |
| 纹理大小 | 8192 原始 | 8192（已修复） | ✅ |
| 纹理过滤 | Anisotropic | Bilinear（已修复） | 可升级到 Trilinear |
| 抗锯齿 | 内置 MSAA | MSAA 4× + FXAA | ✅ |
| 蒙版渲染 | 原生混合 | Cubism 中间纹理链 | Point→Bilinear 已修复 |
| 色彩空间 | sRGB | Linear（Unity 设置） | ✅ |
| 混合模式 | GPU 直接混合 | CommandBuffer.DrawMesh | 相同 |
| 帧率 | 60fps vsync | 60fps | ✅ |
| 物理模拟 | 30fps 物理步进 | 与帧率同步 | 可能不一致 |

### 提升方案（按投入产出比排序）

#### P0: 增加 RenderTexture 分辨率（1 行代码）

当前 800×900 → 目标 **1200×1600** 或更高：

```csharp
// TransparentWindow.cs
_windowWidth = 1200;
_windowHeight = 1600;
```

窗口在桌面上可以缩小显示（UpdateLayeredWindow 的 dst size 可以小于 RT size → DWM 自动降采样，免费获得超采样抗锯齿）。

#### P1: 纹理各向异性过滤

Cubism SDK 中间纹理描述符添加：

```csharp
descriptor.anisoLevel = 4; // 或 8/16
```

#### P2: 超采样渲染

创建 2× 大小的 RenderTexture（如 1600×1800），UpdateLayeredWindow 时缩小到 800×900 → 等效 2× SSAA。

```csharp
// SetupPerPixelAlpha():
_renderTex = new RenderTexture(1600, 1800, 32); // 2× oversampling
// PerPixelAlphaLoop: UpdateLayeredWindow 仍用 800×900 窗口尺寸
```

#### P3: 升级到 Trilinear 过滤

```csharp
descriptor.filterMode = FilterMode.Trilinear; // Bilinear → Trilinear
```

### 预期效果

```
方案        │ 投入 │ 画质提升 │ 性能开销
────────────┼──────┼─────────┼─────────
RT 1200+   │ 1行  │ ★★★☆☆  │ GPU 1.5× 像素
2× 超采样   │ 5行  │ ★★★★★  │ GPU 4× 像素
各向异性    │ 1行  │ ★★★☆☆  │ 几乎为零
三线性过滤  │ 1行  │ ★★☆☆☆  │ 几乎为零
```

**推荐**: P0 + P1 先做（零风险），P2 可选（桌面 GPU 完全能承受）。

---

## 四、实施顺序

```
Phase A (30min) — 立即可做
├── 1. 挂载 CubismExpressionController 到场景
├── 2. 创建 ExpressionHotkeys.cs
├── 3. 测试 18 个表情
└── 4. 可选：接入情绪联动

Phase B (15min) — 画质提升
├── 5. RT 分辨率 800×900 → 1200×1600
├── 6. 中间纹理 anisoLevel = 4
└── 7. FilterMode Bilinear → Trilinear

Phase C (可选, 1h) — 深度优化
├── 8. 2× 超采样
├── 9. 表情过渡参数调优
└── 10. 表情→情绪自动映射
```
