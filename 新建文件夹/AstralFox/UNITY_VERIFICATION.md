# AstralFox 星尘 — Unity 桌面 AI 宠物验证文档

## 项目概况

| 项目 | 值 |
|------|-----|
| Unity 版本 | 2022.3.61 (Tuanjie 1.6.10) |
| 渲染管线 | URP (Universal Render Pipeline) |
| Live2D SDK | Cubism SDK for Unity (已集成) |
| 模型 | CatTail (Live2D 模型) — 待替换为星尘少女模型 |
| 当前状态 | 模板工程 + 模型导入，无自定义脚本 |

## 已集成资源

### Live2D Cubism SDK
- `Assets/Live2D/Cubism/Core/` — 核心数学库、参数混合、模型导入
- `Assets/Live2D/Cubism/Framework/` — 表达式、物理模拟、Harmonic Motion
- `Assets/Live2D/Cubism/Rendering/` — 渲染管线 (URP兼容)、BlendMode材质
- `Assets/Live2D/Cubism/Plugins/Windows/x86/Live2DCubismCore.dll` — 原生插件

### CatTail 模型文件
- `cattail.model3.json` — 模型定义 (参数、部件、绘制顺序)
- `cattail.moc3` — 二进制网格/骨骼数据
- `cattail.cdi3.json` — 显示信息
- `cattail.physics3.json` — 物理参数 (头发摆动、发饰抖动)
- `cattail.1024/texture_00.png` — 纹理贴图 (1024x1024)
- `cattail.prefab` — 已生成的预制体 (可直接拖入场景)

## 验证步骤 (无需安装 Unity 即可执行)

### 步骤 1：确认所有模型文件完整性

在文件管理器中确认存在以下全部 6 类文件

- [ ] `cattail.model3.json` 存在且 > 1 KB
- [ ] `cattail.moc3` 存在且 > 10 KB
- [ ] `cattail.cdi3.json` 存在并包含 `Version: 3`
- [ ] `cattail.physics3.json` 存在 (物理参数，尾巴动画必需)
- [ ] `cattail.1024/texture_00.png` 是一张正常的 PNG (可双击打开预览)
- [ ] `cattail.prefab` 存在 > 2 KB

### 步骤 2：检查 Live2D SDK 脚本完整性

用文本编辑器或 IDE 检查以下关键文件目录存在且包含 `.cs` 文件：

- [ ] `Assets/Live2D/Cubism/Core/` — `CubismMoc.cs`, `CubismModel.cs`, `CubismParameter.cs` 等
- [ ] `Assets/Live2D/Cubism/Rendering/` — 包含 Materials 和 Shaders
- [ ] `Assets/Live2D/Cubism/Plugins/Windows/x86/` — `Live2DCubismCore.dll` 存在 (Win)
- [ ] `Assets/Live2D/Cubism/Plugins/Windows/x86_64/` — `Live2DCubismCore.dll` 存在 (Win64)

### 步骤 3：项目结构验证 (命令行)

```bash
cd "AstralFox 项目目录"
# 确认 ProjectVersion (Unity 版本可打开)
cat ProjectSettings/ProjectVersion.txt
# 应该输出: m_EditorVersion: 2022.3.61t11

# 确认 URP 配置存在
ls Assets/Settings/
# 应该看到文件列表: URP-Balanced-Renderer.asset 等
```

### 步骤 4：Unity Editor 验证 (需要安装 Unity)

1. **打开项目**
   - 启动 Unity Hub → 添加 → 选择 AstralFox 文件夹
   - 确保安装了 Unity 2022.3.61 (国际版可用 2022.3 LTS)
   - 如果是 Tuanjie 版，需要用团结引擎打开

2. **验证 Live2D 模型**
   - 在 Project 窗口双击 `cattail.prefab`
   - 确认模型在 Inspector 中显示且无报错
   - 检查 `CubismModel` 组件下的 Parameters 列表非空

3. **运行场景**
   - 打开 `Assets/Scenes/SampleScene`
   - 将 `cattail.prefab` 拖入 Hierarchy
   - 点击 Play → 模型应正常渲染
   - 在 Inspector 中调节 `CubismParameter` 可看到 BlendShape 变化

4. **物理模拟测试**
   - 选中 CatTail 模型 → 确认 `CubismPhysicsController` 已挂载
   - Play 模式下拖动/旋转模型 → 头发/裙摆应有摆动效果
   - 注意：初始姿态下物理效果可能不明显

## 桌面宠物核心功能 - 待实现

以下功能在项目模板中**尚未实现**，需编写 C# 脚本：

| 优先级 | 功能 | 需要的技术点 |
|--------|------|---------|
| P0 | 透明窗口 / 窗口置顶 | `Windows API` (SetWindowLong, DwmExtendFrameIntoClientArea) |
| P0 | 系统托盘图标 | `Application.runInBackground`, 托盘菜单 |
| P1 | 鼠标交互 (拖拽/点击反馈) | `Input.mousePosition`, Raycast (2D) |
| P1 | 边缘检测 & 自动吸附 | 屏幕边界检测, Mesh 碰撞计算 |
| P2 | 表情/动作自动切换 | CubismParameter 随机驱动, AnimationCurve |
| P2 | 从 Web 管理平台拉取配置 | `UnityWebRequest` + JWT 认证 |
| P3 | 动画播放列表 & 混合 | `CubismFadeController`, 动画权重 |
| P3 | 窗口边缘淡入淡出 | 动态调整 alpha/shader 属性 |

### 关键代码入口

桌面宠物脚本应挂载在一个空 `GameObject` 上作为启动管理器：

```csharp
// DesktopPet.cs — 示例入口脚本 (待创建)
public class DesktopPet : MonoBehaviour
{
    void Start()
    {
        // 1. 初始化 Live2D 模型
        // 2. 设置透明窗口
        // 3. 注册系统托盘
        // 4. 启动 API 心跳
    }

    void Update()
    {
        // 1. 处理鼠标交互
        // 2. 驱动自动表情切换
        // 3. 窗口边缘检测
    }
}
```

### API 接口对接

Unity 与 Web 管理平台通信的端点：

| 端点 | 用途 |
|------|------|
| `POST /api/auth/login` | 获取 JWT Token |
| `GET /api/avatars/:id` | 获取宠物配置 (模型、表情、行为) |
| `GET /api/assets` | 下载更新的纹理/模型文件 |
| `GET /uploads/:file` | 下载已上传的模型/贴图 |

## 当前评估

**项目骨架完整，但尚无桌面宠物核心逻辑。** Live2D 运行时和 CatTail 模型已正确导入且可用，接下来的工作应以编写桌面宠物 C# 脚本为主。

**启动优先顺序**:
1. 透明窗口 + Always-on-top → 宠物"浮在桌面上"
2. CatTail 模型渲染 → 可见的宠物形象
3. 物理 + 参数随机驱动 → 自然的表情和动作
4. 系统托盘 → 最小化/退出
