# AstralFox 上下限提升计划 — 精细操作步骤

> 基于面试视角上下限分析 (2026-06-03)
> 原则: 先修下限(防翻车) → 再提上限(拉高分) → 每个步骤独立可验收

---

## P0: 下限修复 — 防止面试演示翻车 (1.5h)

### P0-1: 恢复 globals.css 导入 [20min]

**问题**: layout.tsx 删除了 `import './globals.css'`, 38 个未迁移组件丢失 Tailwind + CSS 变量 + Ant Design 覆盖
**修复**: 重新导入 globals.css, global.scss 作为补充(不冲突)

**步骤**:
- [x] 1.1 读取 globals.css 完整内容, 确认 @import "tailwindcss" 和所有 CSS 变量
- [x] 1.2 修改 global.scss: 移除与 globals.css 重复的 :root 变量声明, 仅保留新增变量(--accent-light, --bg-surface, --bg-input, --shadow-*) 放在独立选择器
- [x] 1.3 重新添加 `import './globals.css'` 到 layout.tsx (在 global.scss 之前)
- [x] 1.4 验证: 两个文件不再有同名变量冲突

### P0-2: 恢复 LoginForm/RegisterForm 卡片容器 [20min]

**问题**: BEM 迁移丢失了 `.backdrop-blur-xl rounded-2xl p-8` 卡片背景
**修复**: 在 __auth-form.scss mixin 中添加 `&__card` 元素

**步骤**:
- [x] 2.1 在 _auth-form.scss 添加 `&__card` BEM 元素(模糊背景 + 圆角 + 内边距 + 边框)
- [x] 2.2 更新 LoginForm/index.tsx 和 RegisterForm/index.tsx: 表单内容包裹在 `<div className="...__card">` 中

### P0-3: 验证主题一致性 [20min]

**步骤**:
- [x] 3.1 确认 globals.css 的 CSS 变量(--ds-colors-*) 仍然生效(通过 import 链)
- [x] 3.2 确认 Ant Design 全局覆盖(.ant-btn-primary 等)仍然生效
- [x] 3.3 确认 BEM 组件的 SCSS 使用 var(--*) 引用正确

### P0-4: 补回 Sidebar Drawer styles prop [10min]

**问题**: 简化 agent 删除了 Sidebar Drawer 的 `styles` prop, 但 :global() SCSS 可能覆盖不全
**修复**: 恢复 Drawer 的 `styles` prop 作为双重保险

---

## P1: 上限提升 — 用户可感知的改进 (3h)

### P1-1: DiagnosticBus → UINotificationBubble 联调 [1h]

**问题**: DiagnosticBus 写好了, UINotificationBubble 写好了, 但没有连接
**修复**: 在 UINotificationBubble 中订阅 DiagnosticBus.OnDiagnostic

**步骤**:
- [x] 1.1 UINotificationBubble.Start() 中: `DiagnosticBus.Instance.OnDiagnostic += HandleDiagnostic;`
- [x] 1.2 HandleDiagnostic: Severity.Error/Warning → ShowMessage, Severity.Info → 忽略
- [x] 1.3 BackendClient 改为使用 DiagnosticBus.Report 而非 Debug.LogError

### P1-2: VoiceManager 启动时自动检测服务状态 [1h]

**问题**: 启动后用户不知道 AI 服务是否就绪
**修复**: VoiceManager.Start() 结束时通过 OnUserNotification 报告状态

**步骤**:
- [x] 2.1 在 VoiceManager.Start() 中检查 BackendClient.IsConnected
- [x] 2.2 已连接 → "星尘已就绪，叫我小星小星唤醒我~"
- [x] 2.3 未连接 → "正在连接 AI 服务…" (等待 OnConnectionChanged 后再报告)

### P1-3: 创建一个操作演示 checklist [1h]

**步骤**:
- [x] 3.1 编写 `devlog/demo-checklist.md`: 从启动到首次对话的完整操作步骤
- [x] 3.2 每个步骤标注预期结果和观察要点
- [x] 3.3 标注已知问题和 workaround

---

## 执行进度总览

| 编号 | 任务 | 状态 |
|------|------|------|
| P0-1 | 恢复 globals.css 导入 | ✅ |
| P0-2 | 恢复 LoginForm/RegisterForm 卡片容器 | ✅ |
| P0-3 | 验证主题一致性 | ✅ |
| P0-4 | 补回 Sidebar Drawer styles | ✅ |
| P1-1 | DiagnosticBus → UINotificationBubble 联调 | ✅ |
| P1-2 | VoiceManager 启动服务状态通知 | ✅ |
| P1-3 | 操作演示 checklist | ✅ |
