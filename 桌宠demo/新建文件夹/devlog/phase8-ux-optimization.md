# Phase 8 实现文档 — 用户体验优化

> 日期：2026-05-24
> 实现：Claude Code
> 状态：代码完成

---

## 目标

解决四个用户体验问题：
1. **免 Tuanjie Hub 运行** — 用户无需安装 Hub 即可使用桌宠和控制面板
2. **美化控制面板** — 程序化生成的玻璃态 (glassmorphism) 现代化 UI
3. **全局 Windows 快捷键** — 通过 Win32 RegisterHotKey 注册系统级热键
4. **桌面快捷方式** — 自动创建 .lnk 快捷方式（桌宠 + 配置面板）

---

## 新增文件

### 1. SettingsUIBuilder.cs
**路径**: `Assets/Scripts/Runtime/Config/SettingsUIBuilder.cs`

**职责**: 运行时程序化构建完整的玻璃态控制面板 UI

**设计风格**:
- 玻璃态 (Glassmorphism): 半透明深色背景 + 蓝紫调和微光边框
- 配色: 深色底 rgb(20,20,30) 透明度 0.85, 蓝色强调 rgb(92,140,232)
- 微软雅黑字体, 层级分明的标题/正文/辅助文字
- 圆角面板 (9-slice sprite 模拟), 阴影效果

**结构**:
```
SettingsCanvas (Canvas, Sort Order 100, 1920x1080 ref)
  └── Panel (680x540, 居中, 可拖拽, 背景半透明)
        ├── TitleBar ("星尘狐 · 系统设置" + 关闭按钮)
        ├── ScrollRect (遮罩滚动区域)
        │     └── Content (VerticalLayout)
        │           ├── Azure 语音服务 Section (Key + 显示/隐藏 + 区域选择)
        │           ├── OpenAI 对话服务 Section (Key + Base URL)
        │           ├── 角色设定 Section (名字 + 性格 + 背景 + 补充 + 恢复默认)
        │           ├── ffmpeg 工具 Section (路径 + 浏览)
        │           └── 帮助链接 (获取 Azure Key / OpenAI Key / 下载 ffmpeg)
        └── BottomBar (测试连接 + 保存 + 取消 + 状态消息)
```

**关键实现**:
- 所有 UI 元素通过代码创建 (Canvas / Image / Text / InputField / Button / Toggle / ScrollRect)
- 使用 VerticalLayoutGroup + ContentSizeFitter 自动调整高度
- 使用反射将 UI 控件注入 SettingsPanel 的序列化字段
- `CreateRoundedRectSprite()` 生成 9-slice 圆角矩形 Sprite

### 2. DraggablePanel.cs
**路径**: `Assets/Scripts/Runtime/Config/DraggablePanel.cs`

**职责**: 让 UI 面板可以通过鼠标拖拽移动
- 实现 `IBeginDragHandler` + `IDragHandler`
- 通过 `RectTransformUtility.ScreenPointToLocalPointInRectangle` 坐标转换
- 支持指定目标 `RectTransform`（面板本身或父级）

### 3. GlobalHotkeyManager.cs
**路径**: `Assets/Scripts/Runtime/Config/GlobalHotkeyManager.cs`

**职责**: Windows 全局热键注册（应用不在焦点也能响应）

**技术方案**:
- `RegisterHotKey()` Win32 API 注册 Ctrl+Alt+S (设置) 和 Ctrl+Alt+F (显示/隐藏)
- 独立 `PeekMessage` 轮询线程（`PM_REMOVE` 消费 WM_HOTKEY 消息）
- 通过主线程 `Update()` 中的 `Poll()` 方法驱动
- `IDisposable` 模式，退出时 `UnregisterHotKey`

**热键配置**:
| 组合键 | 功能 |
|--------|------|
| Ctrl+Alt+S | 打开/关闭系统设置面板 |
| Ctrl+Alt+F | 显示/隐藏桌面狐狸 |

### 4. CommandLineArgs.cs
**路径**: `Assets/Scripts/Runtime/Config/CommandLineArgs.cs`

**职责**: 解析启动时的命令行参数

**支持的参数**:
| 参数 | 简写 | 功能 |
|------|------|------|
| `--settings` | `-s` | 启动时打开配置面板 |
| `--minimized` | `-m` | 启动时最小化到托盘 |
| `--help` | `-h`, `/?` | 显示帮助信息 |

**用法示例**:
```
AstralFox.exe --settings              # 直接打开设置
AstralFox.exe -s -m                   # 打开设置 + 最小化
桌宠 系统设置.lnk → Target: "...\AstralFox.exe" --settings
```

### 5. BatchBuild.cs
**路径**: `Assets/Scripts/Editor/BatchBuild.cs`

**职责**: 命令行无头构建入口

**Unity 命令行调用**:
```bash
Tuanjie.exe -quit -batchmode -nographics \
  -projectPath "AstralFox" \
  -buildWindows64Player "Build/AstralFox.exe" \
  -executeMethod AstralFox.Editor.BatchBuild.Build
```

### 6. CreateDesktopShortcuts.ps1
**路径**: `CreateDesktopShortcuts.ps1` (项目根目录)

**功能**:
- 自动搜索 Build 目录中的 `AstralFox.exe`
- 创建两个桌面快捷方式:
  - `星尘狐.lnk` — 启动桌宠
  - `星尘狐 系统设置.lnk` — 启动桌宠并直接打开配置面板 (带 `--settings` 参数)

### 7. Build-Standalone.bat
**路径**: `Build-Standalone.bat` (项目根目录)

**功能**:
- 自动检测 Tuanjie/Unity 编辑器路径
- 无头构建 Windows 64 位独立版本
- 自动复制 backend/ 目录到构建输出
- 自动复制 .env.example 模板

### 8. Start-AstralFox.bat
**路径**: `Start-AstralFox.bat` (项目根目录)

**功能**:
- 一键启动 Python 后端 + AstralFox
- 传递命令行参数给桌宠（如 `--settings`）

---

## 修改文件

### AppLifecycle.cs
**变更内容**:
- 添加 `_enableGlobalHotkeys` 开关
- 添加 `_buildSettingsPanelOnStart` — 启动时自动用 `SettingsUIBuilder.Build()` 创建面板
- `Start()` 中调用 `SetupHotkeys()` 注册全局热键
- `Update()` 中调用 `GlobalHotkeyManager.Instance.Poll()` 轮询热键消息
- 处理 `CommandLineArgs` — `--settings` 参数在 Start 时自动打开面板
- `OpenSettingsPanel()` 增强 — 如果面板不存在则自动创建

---

## 构建与分发流程

1. **构建**: 运行 `Build-Standalone.bat` → 输出到 `AstralFox\Build\`
2. **快捷方式**: 运行 `CreateDesktopShortcuts.ps1` → 桌面生成两个 .lnk
3. **配置**: 用户在 `backend\.env` 中填入 API Key
4. **启动**: 双击桌面快捷方式 或 运行 `Start-AstralFox.bat`
5. **日常使用**: Ctrl+Alt+S 随时打开设置，Ctrl+Alt+F 显示/隐藏狐狸

用户无需安装 Tuanjie Hub，只需下载 Build 文件夹即可使用。

---

## 全局热键技术细节

```
RegisterHotKey(hWnd, 9001, MOD_CONTROL | MOD_ALT, VK_S)  →  Ctrl+Alt+S
RegisterHotKey(hWnd, 9002, MOD_CONTROL | MOD_ALT, VK_F)  →  Ctrl+Alt+F
                ↓
Windows 消息队列 → WM_HOTKEY (0x0312)
                ↓
PeekMessage(PM_REMOVE) 轮询 → 回调 Action
                ↓
UnityMainThreadDispatcher.Enqueue → 主线程执行
```

如果热键注册失败（被其他应用占用），会输出警告但不会崩溃。

---

## 测试要点

| 测试项 | 方法 | 预期结果 |
|--------|------|----------|
| 面板拖拽 | 拖拽控制面板标题栏 | 面板跟随鼠标移动 |
| 面板样式 | 启动应用（Editor 或 Build） | 玻璃态深色 UI，蓝色强调色 |
| 快捷键打开设置 | 按 Ctrl+Alt+S | 控制面板弹出 |
| 快捷键切换狐狸 | 按 Ctrl+Alt+F | 狐狸显示/隐藏 |
| 命令行 --settings | `AstralFox.exe --settings` | 启动即打开设置面板 |
| 命令行 --help | `AstralFox.exe --help` | 日志输出帮助信息 |
| 托盘图标 | 查看任务栏通知区域 | 显示橙色圆形图标 |
| 托盘右键菜单 | 右键点击托盘图标 | 显示/系统设置/退出 |
| 桌面快捷方式 | 双击"星尘狐"快捷方式 | 正常启动桌宠 |
| 桌面快捷方式(设置) | 双击"星尘狐 系统设置"快捷方式 | 启动并直接打开设置 |
| 免 Hub 运行 | 在未安装 Hub 的机器上运行 Build | 正常启动，无依赖错误 |

---

## 资产依赖

Phase 8 使用 Unity 内置 uGUI 系统，无外部 UI 资产：
- `Canvas`, `CanvasScaler`, `GraphicRaycaster` (built-in)
- `Image`, `Text`, `InputField`, `Button`, `Toggle`, `ScrollRect` (built-in)
- `Shadow` effect (built-in)
- 字体: 运行时通过 `Font.CreateDynamicFontFromOSFont` 加载系统字体
- 所有 UI 元素程序化生成，无需预制体
