# AstralFox 模块化架构升级计划

> **灵感来源**: Alife 项目的分层架构（Basic → Framework → Function → Implement）
> **原则**: 不改 Unity 本质，只强化代码组织 + 关键模块
> **目标**: 面试中展示"我懂模块化架构设计"

---

## 当前 vs 目标

```
当前 (一体式):                       目标 (分层式):
Assets/Scripts/Runtime/              Assets/Scripts/Runtime/
├── Animation/    (动画)             ├── Core/          ← 核心抽象层
├── Audio/        (音频)             │   ├── IPetAnimator.cs
├── Behavior/     (行为)             │   ├── IVoicePipeline.cs
├── Config/       (配置)             │   └── DiagnosticBus.cs
├── Data/         (数据)             ├── Platform/      ← 平台抽象层
├── Diagnostics/  (诊断)             │   ├── TransparentWindow.cs
├── UI/           (界面)             │   ├── NativeWindowInterop.cs
├── Voice/        (语音)             │   ├── GlobalHotkeyManager.cs
└── *.cs          (散落)             │   └── TrayIconManager.cs
                                     ├── Animation/    ← 动画引擎层 (不变)
                                     ├── Voice/        ← 语音管线层 (不变)
                                     ├── Behavior/     ← 行为决策层
                                     ├── Data/         ← 数据持久层
                                     ├── AI/           ← 🆕 AI 模块 (借鉴 QChat)
                                     │   ├── Memory/   ← 🆕 长期记忆
                                     │   ├── Context/  ← 🆕 上下文感知
                                     │   └── Pipeline/ ← 🆕 管线抽象
                                     └── Editor/       ← 编辑器工具 (不变)
```

---

## Phase 1: 平台抽象层整合 (1h)

借鉴 Alife.Basic 的 Windows 原生 API 集中管理思路。

### 1.1 创建 Platform/ 命名空间
- [ ] 移动 `TransparentWindow.cs` → `Platform/`
- [ ] 移动 `NativeWindowInterop.cs` → `Platform/`
- [ ] 移动 `GlobalHotkeyManager.cs` → `Platform/`
- [ ] 移动 `TrayIconManager.cs` → `Platform/`
- [ ] 移动 `DesktopCameraSetup.cs` → `Platform/`
- [ ] 移动 `FoxSimpleMovement.cs` → `Platform/` (桌面漫游)
- [ ] 移动 `FoxInteraction.cs` → `Platform/` (拖拽交互)
- [ ] 统一 namespace: `AstralFox.Platform`

### 1.2 创建 IPlatformProvider 接口
```csharp
namespace AstralFox.Platform
{
    public interface IPlatformProvider
    {
        bool IsTransparentWindowSupported { get; }
        void SetTransparent(IntPtr hwnd);
        Vector2 GetCursorPosition();
        float GetIdleSeconds();
    }
}
```

---

## Phase 2: AI 模块独立 (2h)

借鉴 Alife 的 QChat/Memory/Vision 三分结构。

### 2.1 语音管线抽象 (已完成 80%)
- [x] `IVoicePipeline` 接口已存在
- [x] `BackendClient` (云端) + `AIManager` (本地) + `MockVoicePipeline` (测试)
- [ ] 移到 `AI/` 命名空间下，统一管理

### 2.2 长期记忆系统 🆕 (借鉴 Alife.Memory)
```csharp
namespace AstralFox.AI.Memory
{
    public interface IMemoryStore
    {
        void Remember(string key, string value);
        string Recall(string key);
        List<MemoryEntry> SearchRelevant(string query, int topK = 5);
        void Forget(string key);
        void Summarize(); // 定期摘要压缩
    }
    
    public class MemoryEntry
    {
        public string Key;
        public string Value;
        public DateTime CreatedAt;
        public DateTime LastAccessedAt;
        public float Importance; // 0-1
    }
}
```
- [ ] 实现 `VectorMemoryStore` — 用简单的关键词向量做相似度搜索
- [ ] 集成到 LLM prompt 构造中（`ContextBuilder.cs`）
- [ ] 面试展示: "长期记忆让 AI 记得用户说过什么"

### 2.3 上下文感知增强 (借鉴 Alife.Function)
- [ ] 将 `ContextAwareness.cs` + `TimeAwareness.cs` 移到 `AI/Context/`
- [ ] 新增 `WindowContextProvider` — 检测当前活跃窗口标题
- [ ] 面试展示: "狐狸知道你正在用 VS Code 写代码"

---

## Phase 3: 插件系统基础 (1.5h)

借鉴 Alife.Framework/Models/Plugin。

### 3.1 简单的 Function 注册机制
```csharp
namespace AstralFox.Core
{
    public interface IFoxFunction
    {
        string Name { get; }
        string Description { get; }
        Task<string> Execute(string input);
    }
    
    public static class FunctionRegistry
    {
        private static List<IFoxFunction> _functions = new();
        public static void Register(IFoxFunction fn) => _functions.Add(fn);
        public static IReadOnlyList<IFoxFunction> GetAll() => _functions;
    }
}
```
- [ ] 将现有的 3 个 Function Tool (天气/搜索/提醒) 改为 `IFoxFunction` 实现
- [ ] 面试展示: "新功能通过注册接口即可扩展，符合开闭原则"

---

## Phase 4: 代码重组 (0.5h)

- [ ] 更新所有 `using` 语句
- [ ] 更新所有 `namespace` 声明
- [ ] 验证编译 0 错误
- [ ] 更新 README 架构图

---

## 执行策略

| Phase | 工时 | 面试价值 | 风险 |
|-------|------|---------|------|
| P1 平台抽象 | 1h | ⭐⭐⭐ | 低——只是移动文件 |
| P2 AI 模块 | 2h | ⭐⭐⭐⭐⭐ | 中——新代码需要测试 |
| P3 插件系统 | 1.5h | ⭐⭐⭐⭐ | 低——接口简单 |
| P4 代码重组 | 0.5h | ⭐⭐ | 低 |
| **总计** | **5h** | | |

## 不做的

- ❌ 不改成 WPF——保持 Unity
- ❌ 不改 Web 渲染——保持 Live2D
- ❌ 不加 Python 桥接——已有 FastAPI BFF
- ❌ 不改模块物理分离（.asmdef）——避免编译复杂度

## 验收

- [ ] 0 编译错误
- [ ] Play Mode 正常运行
- [ ] Animation Monitor 可用
- [ ] 新 `AI/Memory/` 目录含 `IMemoryStore` 接口 + `VectorMemoryStore` 实现
- [ ] 新 `Core/` 目录含 `IFoxFunction` 接口 + `FunctionRegistry`
- [ ] `Platform/` 命名空间统一
- [ ] README 架构图更新
