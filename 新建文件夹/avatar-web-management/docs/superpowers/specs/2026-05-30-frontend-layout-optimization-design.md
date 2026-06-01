# Frontend Layout Optimization Design

> 2026-05-30 | AstralFox Market 前端布局优化
> 方案 C — 混合渐进方案：保留 Ant Design 体系，引入 react-admin 模式精华，白底暖调视觉改造

---

## 1. Design Goals

| 目标 | 含义 | 优先级 |
|------|------|--------|
| 易访问 (Accessible) | WCAG 2.1 AA 合规，axe-core 零 critical/serious 违规，全键盘可导航 | P0 |
| 响应迅速 (Responsive) | 4 断点完美适配 (Mobile/Tablet/Desktop/Wide)，移动端优先 | P1 |
| 安全 (Secure) | 输入消毒统一层、CSP 收紧、Trusted Types、XSRF 增强 | P0 |
| 快速 (Fast) | LCP < 1.5s, 首屏 JS < 300KB, 乐观更新感知零延迟 | P1 |
| 可测试 (Testable) | 5 层测试金字塔，行覆盖率 > 85%，a11y CI 自动检查 | P2 |

---

## 2. Key Decision: Visual Theme Migration

### 2.1 Problem

17 处硬编码深色值 (#09090F, #12122A, #0d0d24, #6d5df0) 分布在 6 个组件中，
与 `globals.css` 中已定义的浅色暖调 CSS 变量不一致，且无法支持主题切换。

### 2.2 Solution

将所有硬编码颜色替换为 CSS 变量引用，激活已有的 Design Token 体系：

| 用途 | 旧（硬编码） | 新（CSS 变量） | 实际色值 |
|------|-------------|---------------|---------|
| 页面背景 | `#09090F` | `var(--bg-deep)` | `#faf7f2` (温暖米白) |
| 卡片/侧栏/表头 | `#12122A` | `var(--bg-card)` | `#ffffff` (纯白) |
| 卡片悬停 | `rgba(109,93,240,0.05)` | `var(--bg-card-hover)` | `#f5f0e8` |
| 主文字 | `white` / `#e2e8f0` | `var(--text-primary)` | `#1c1917` (暖黑) |
| 次要文字 | `#a8a29e` | `var(--text-secondary)` | `#78716c` (暖灰) |
| 主色调 | `#6d5df0` (紫) | `var(--accent)` | `#d97706` (暖琥珀) |
| 边框 | `rgba(139,92,246,0.1)` | `var(--border-subtle)` | `rgba(0,0,0,0.06)` |
| 阴影 | 无 | `var(--shadow-card)` | 多层微阴影 |

### 2.3 Affected Files

1. `src/components/layout/AppLayout.tsx` — 移除 style 硬编码背景
2. `src/components/layout/Header.tsx` — 移除 backdrop 硬编码
3. `src/components/layout/Sidebar.tsx` — 移除渐变硬编码
4. `src/components/layout/SearchModal.tsx` — 移除 #12122A
5. `src/components/layout/NotificationDropdown.tsx` — 移除 #12122A
6. `src/components/common/ErrorBoundary.tsx` — 移除 #09090F

Replace pattern: `text-white` → `text-primary`, `text-gray-*` → `text-secondary`.

---

## 3. Icon Library Consolidation: better-icons

### 3.1 Problem

项目当前混用两套图标库：
- `@ant-design/icons` — Ant Design 组件内部使用 (Sidebar Menu, Button, Input prefix)
- `lucide-react` — 自定义组件使用 (PageTitle, EmptyState 等)

**问题：**
- 两套图标风格不统一（Ant Design Icons 偏实心，Lucide 偏线性）
- 重复打包 (~120KB combined gzip)
- 新增图标时需要在两个库之间选择，缺乏统一标准
- AI 编码时不确定哪些图标可用，容易产生幻觉

### 3.2 Solution: better-icons

[better-icons](https://github.com/better-auth/better-icons) (v1.0.5, 2026-03) — 200,000+ 图标，150+ 集合的统一图标工具。

**选型理由：**

| 特性 | 价值 |
|------|------|
| MCP 服务器 | AI 代理可直接搜索图标、写入项目文件，消除图标幻觉 |
| 200K+ 图标 | 覆盖 Lucide/Heroicons/Phosphor/Material/Tabler/FontAwesome 等 |
| 项目同步 | 将选中的 SVG/TSX 直接写入 `src/components/icons/`，而非放在聊天里 |
| 集合偏好学习 | 记住项目偏好，后续搜索优先推荐 |
| 多框架 | React TSX / Vue / Svelte / Solid / Raw SVG |

**集成策略：**

1. **设置 MCP 服务器** — `npx better-icons setup` 配置到 .claude/mcp.json
2. **选择主集合: Lucide** — 与白底简洁风格最匹配的线性图标
3. **保留 @ant-design/icons** — Ant Design 组件内部使用（Menu、Button 等），不做破坏性替换
4. **自定义组件统一用 better-icons** — 所有新建组件（PageTitle、EmptyState、FilterBar 等）通过 better-icons 获取图标
5. **逐步迁移 lucide-react** — 将现有 lucide-react 引用按需替换为 better-icons 提供的本地图标文件

**仓库结构：**
```
src/components/icons/       # better-icons 写入的本地图标
├── index.ts               # 统一导出
├── User.tsx               # lucide:user
├── Search.tsx             # lucide:search
├── ShoppingCart.tsx       # lucide:shopping-cart
├── Package.tsx            # lucide:package
├── Bell.tsx               # lucide:bell
├── Settings.tsx           # lucide:settings
├── Plus.tsx               # lucide:plus
├── ChevronDown.tsx        # lucide:chevron-down
├── TrendingUp.tsx         # lucide:trending-up
├── Filter.tsx             # lucide:filter
├── Moon.tsx               # lucide:moon (ThemeToggle)
├── Sun.tsx                # lucide:sun (ThemeToggle)
└── ...
```

**标准化图标映射（导航 + 通用操作）：**

| 用途 | 旧来源 | 新图标 | 集合 |
|------|--------|--------|------|
| 仪表盘 | @ant-design/DashboardOutlined | `LayoutDashboard` | lucide |
| 头像管理 | @ant-design/PictureOutlined | `Image` | lucide |
| 资产管理 | @ant-design/FolderOutlined | `FolderOpen` | lucide |
| 市场 | @ant-design/ShopOutlined | `Store` | lucide |
| 社区 | @ant-design/TeamOutlined | `Users` | lucide |
| 购买 | @ant-design/ShoppingCartOutlined | `ShoppingCart` | lucide |
| 消息 | @ant-design/MessageOutlined | `MessageCircle` | lucide |
| 通知 | @ant-design/BellOutlined | `Bell` | lucide |
| 卖家中心 | @ant-design/DollarOutlined | `BadgeDollarSign` | lucide |
| 设置 | @ant-design/SettingOutlined | `Settings` | lucide |
| 管理 | @ant-design/SafetyOutlined | `Shield` | lucide |
| API 文档 | @ant-design/ApiOutlined | `Code2` | lucide |
| 帮助 | @ant-design/QuestionCircleOutlined | `CircleHelp` | lucide |
| 搜索 | @ant-design/SearchOutlined | `Search` | lucide |
| 用户 | @ant-design/UserOutlined | `User` | lucide |
| 展开/收起 | @ant-design/MenuFoldOutlined etc. | `PanelLeftClose` / `PanelLeft` | lucide |

---

## 4. Design System Encoding: DESIGN.md

### 4.1 Problem

当前设计决策分散在多处：
- CSS 变量在 `globals.css`
- Ant Design token 在 `lib/design-system/`
- 组件样式硬编码在各组件中
- 布局约定隐式存在于代码中

AI 代理（Claude Code、Cursor 等）和人类开发者都缺乏**单一真实来源**来理解整体设计系统。

### 4.2 Solution: 项目根目录 DESIGN.md

借鉴 [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 的 **DESIGN.md 格式规范**（由 Google Stitch 提出），在项目根目录创建 `DESIGN.md`，作为 AI 可读的设计系统文档。

**不直接复制任何品牌** — 而是用 DESIGN.md 格式编码我们自己的设计决策：

| 模块 | 内容来源 |
|------|----------|
| Visual Theme & Atmosphere | 白底暖调简洁风格 — 本 spec 第 2 节 |
| Color Palette & Roles | CSS 变量映射表 — 本 spec 第 2.2 节 |
| Typography Rules | Geist + Geist Mono — 本 spec |
| Component Stylings | Ant Design 定制 + 新组件 — 本 spec 第 4 节 |
| Layout Principles | 间距刻度 + 网格 + 断点 — 本 spec 第 7 节 |
| Depth & Elevation | 阴影系统 — 本 spec 第 2.2 节 |
| Do's and Don'ts | 颜色硬编码禁止 + 图标使用规范 + a11y 要求 |
| Responsive Behavior | 4 断点策略 — 本 spec 第 7 节 |
| Agent Prompt Guide | 现成 prompt 片段供 AI 代理使用 |

### 4.3 DESIGN.md 核心内容

```markdown
# AstralFox Market — DESIGN.md

## Visual Theme & Atmosphere
温暖、简洁、专业的白底设计。采用暖米白背景 (#faf7f2) 搭配纯白卡片，
暖琥珀 (#d97706) 作为强调色。整体风格类似于 Notion/Linear 的简洁性，
但更温暖、更有人情味——适合创意市场 + AI 桌宠伴侣的定位。

## Color Palette
- bg-deep: #faf7f2 (温暖米白)
- bg-card: #ffffff (纯白卡片)
- accent: #d97706 (暖琥珀)
- text-primary: #1c1917 (暖黑)
- text-secondary: #78716c (暖灰)
- All colors accessed via CSS variables — NEVER hardcoded.

## Typography
- Primary: Geist (system: -apple-system, Noto Sans SC)
- Mono: Geist Mono
- Scale: xs(12) / sm(14) / base(16) / lg(18) / xl(20) / 2xl(24) / 3xl(30)

## Layout Principles
- 4 breakpoints: <640 / 640-1024 / 1024-1440 / >1440
- Spacing scale: 4/8/16/24/32/48/64px
- Cards: white bg, border-subtle, shadow-card, radius-lg

... (完整内容在 Phase 1 生成)
```

### 4.4 DESIGN.md 工作流

```
1. DESIGN.md (项目根目录) — 设计唯一真相源
   ├── AI 代理读取 → 生成符合规范的 UI 代码
   ├── 人类开发者读取 → 理解设计约定
   └── CI 可验证 → 检查硬编码颜色违规

2. globals.css — DESIGN.md 的 CSS 实现
3. antd-tokens.ts — DESIGN.md 的 Ant Design 映射
```

### 4.5 参考源

从 awesome-design-md 参考以下品牌的 DESIGN.md 结构和写法，但不照搬配色：
- **Notion** — 白底 + 极简 + 层级清晰（最接近我们的风格）
- **Linear** — 极简精准、Do's and Don'ts 写法优秀
- **Vercel** — 现代几何感、响应式描述清晰

---

## 5. Architecture: New Components

### 5.1 Component Tree (updated)

```
AppLayout
├── SkipToMain (焦点管理 + 跳过导航)
├── Sidebar (增强：移动端 Drawer + QuickActionGroup)
│   ├── Logo + Brand
│   ├── QuickActionGroup (新建/搜索/导出)
│   ├── Menu (现有)
│   └── CollapseToggle (现有)
├── Layout
│   ├── Header
│   │   ├── BreadcrumbNav (自动面包屑)
│   │   ├── AppBarActions (页面级操作按钮)
│   │   ├── SearchModal (现有，⌘K)
│   │   ├── ThemeToggle (浅色/深色/系统)
│   │   ├── NotificationDropdown (现有)
│   │   └── UserMenu (现有)
│   └── Content
│       ├── PageTitle (标题 + 副标题 + 操作)
│       ├── FilterBar (列表页筛选器 + 排序器)
│       ├── BulkActionBar (批量操作工具栏)
│       ├── ListView / EditView / ShowView (页面模式)
│       ├── EmptyState (空状态规范)
│       └── OptimisticFeedback (乐观更新反馈)
```

### 5.2 Six Core Patterns (from react-admin)

| Pattern | Description | Implementation |
|---------|-------------|----------------|
| **ListView/EditView/ShowView** | 统一数据驱动 CRUD 约定 | 透传 Ant Design 组件的容器组件，非侵入式 |
| **ThemeProvider** | 浅色/深色/系统三态 | Zustand store + ConfigProvider token 注入 + SSR cookie |
| **FilterBar** | 可复用筛选排序器 | URL query params 同步 + 移动端底部 Drawer |
| **Optimistic Updates** | 操作立即反映 UI + 撤销 | SWR optimisticData + Toast 撤销按钮 |
| **A11y Enhancement** | 焦点管理 + aria-live + 键盘导航 | axe-core CI + focus-manager.ts |
| **Dashboard Widgets** | 可配置仪表盘小部件 | WidgetRegistry + 拖拽排序 + 角色预设 |

### 5.3 New Files

```
src/components/layout/
├── BreadcrumbNav.tsx      # 自动面包屑
├── AppBarActions.tsx      # 页面级操作按钮
├── FilterBar.tsx          # 筛选器 + 排序器
├── BulkActionBar.tsx      # 批量操作工具栏

src/components/ui/
├── ListView.tsx           # 列表页面容器
├── EditView.tsx           # 编辑页面容器
├── ShowView.tsx           # 详情页面容器
├── PageTitle.tsx          # 页面标题
├── EmptyState.tsx         # 空状态组件
├── OptimisticFeedback.tsx # 乐观更新反馈
├── ThemeToggle.tsx        # 主题切换

src/components/providers/
├── ThemeProvider.tsx      # 主题引擎

src/stores/
├── themeStore.ts          # 主题状态 (Zustand)

src/lib/
├── sanitize.ts            # DOMPurify 输入消毒封装
├── focus-manager.ts       # 焦点陷阱 + 焦点恢复
```

---

## 6. Security Enhancements

| Item | Approach | Impact |
|------|----------|--------|
| 输入消毒 | `src/lib/sanitize.ts` — DOMPurify 封装，白名单标签+属性 | 全用户输入路径 |
| CSP 收紧 | Trusted Types + 移除 unsafe-inline 依赖 | next.config.ts |
| XSRF 增强 | 所有状态变更 API → X-CSRF-Token 校验 | Fetch 封装层 |
| 现有策略 | 保持不变 (bot检测/CORS/CSRF/rate-limit/JWT/RBAC/argon2/2FA/OAuth2.0) | — |

---

## 7. Performance Optimizations

| Pattern | Approach | Target |
|---------|----------|--------|
| 乐观更新 | SWR optimisticData + Toast 撤销 | 感知延迟 → 0ms |
| 路由预取 | router.prefetch (hover + visible)，已有 | 导航 < 100ms |
| 代码分割 | next/dynamic (图表、3D、编辑器)，已有 | 首屏 JS -30% |
| 图片优化 | next/image + 缩略图 + blurDataURL | LCP -40% |
| 数据缓存 | SWR dedup + Redis 服务端，已有 | 重复请求 → 0 |
| 虚拟列表 | 大数据集 (>100条) 虚拟滚动 | 列表渲染 FPS 稳定 |

### 目标指标

| Metric | Current | Target |
|--------|---------|--------|
| LCP | ~2.8s | < 1.5s |
| CLS | ~0.12 | < 0.05 |
| INP | ~180ms | < 100ms |
| 首屏 JS (gzip) | ~450KB | < 300KB |

---

## 8. Responsive Design

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Sidebar → 全屏 Drawer, 表格 → 卡片, FilterBar → 底部 Sheet, Header → 汉堡菜单 |
| Tablet | 640-1024px | Sidebar 折叠 64px + hover 展开, 表格 key 列 + 横向滚动 |
| Desktop | 1024-1440px | Sidebar 完整 220px, 表格完整, KPI 横排, 图表双列 |
| Wide | > 1440px | 内容最大宽度约束 (max-w-[1440px]) |

---

## 9. Testing Strategy

### 9.1 Five-layer Pyramid

| Layer | Tool | Target Count | Coverage |
|-------|------|-------------|----------|
| Unit | Jest + RTL | 200+ | 85% line |
| Visual Regression | jest-image-snapshot + Storybook | 30+ | Key components |
| Integration | Jest + supertest | 80+ (existing) | API full chain + auth |
| E2E | Playwright (cross-browser) | 25+ | Critical user flows |
| A11y | axe-core + @storybook/a11y | All pages | 0 critical/serious |

### 9.2 New Test Cases

- FilterBar: 筛选/排序/URL 同步/响应式折叠
- BulkActionBar: 多选/全选/批量操作/确认
- ThemeToggle: 三态切换/持久化/SSR 一致性
- EmptyState: 所有变体/图标/操作按钮
- 焦点管理: 跳转/模态框/抽屉/焦点恢复
- 响应式快照: 4 断点 × 5 页面
- 乐观更新回滚: 成功/失败/撤销/网络恢复

---

## 10. Implementation Plan

### Phase 1: 安全基座 + 可访问性 + 主题迁移 + DESIGN.md + 图标统一 (3 days)

- [ ] 编写 `DESIGN.md` — 项目根目录设计系统文档 (9 模块, 参考 Notion/Linear 写法) (0.3d)
- [ ] better-icons MCP 服务器设置 + 图标目录初始化 (0.2d)
- [ ] 16 个导航图标迁移：@ant-design/icons → better-icons (lucide) (0.3d)
- [ ] `src/lib/sanitize.ts` — DOMPurify 封装 + 全局输入消毒 (0.5d)
- [ ] CSP 审计 + Trusted Types + next.config.ts 收紧 (0.5d)
- [ ] 颜色变量化迁移 — 6 个组件硬编码替换为 CSS 变量 (0.5d)
- [ ] SkipToMain + focus-manager.ts + aria 补全 (0.3d)
- [ ] axe-core CI 集成 + 键盘导航标准化 (0.2d)
- [ ] 硬编码颜色 CI 检查 (禁止 `#` 颜色直接出现在 TSX 中) (0.2d)

### Phase 2: 布局增强 + 性能优化 (3 days)

- [ ] ThemeProvider + ThemeToggle + themeStore (1d)
- [ ] 移动端 Sidebar Drawer 模式 (0.5d)
- [ ] BreadcrumbNav + AppBarActions (0.3d)
- [ ] FilterBar 抽象组件 + 头像/市场列表页集成 (0.7d)
- [ ] 响应式断点系统 + 组件适配 (表格/仪表盘/ChatPanel) (0.5d)

### Phase 3: 体验深度 + 测试补齐 (2 days)

- [ ] ListView/EditView/ShowView 页面模式容器 (0.5d)
- [ ] BulkActionBar + OptimisticFeedback + EmptyState (0.5d)
- [ ] Dashboard 小部件系统 (0.5d)
- [ ] 新增 7 类测试用例补齐 (0.5d)

**Total: 8 days**

---

## 11. Success Criteria

| Dimension | Metric | Target |
|-----------|--------|--------|
| Security | CSP strictness | No unsafe-inline |
| Security | Input sanitization coverage | 100% user input paths |
| Accessibility | axe-core violations | 0 critical + 0 serious |
| Accessibility | Keyboard navigation | All core paths navigable |
| Performance | LCP (Lighthouse) | < 1.5s |
| Performance | First-load JS | < 300KB gzip |
| Responsive | Mobile UX score | 4 breakpoints adapted |
| Testability | Line coverage | > 85% |
| Visual | Color hardcoding | 0 occurrences |
| Icons | Icon source | Single source via better-icons (except antd internal) |
| Icons | lucide-react dependency | Removed (migrated to better-icons local files) |
| Design System | DESIGN.md at project root | Present, covers all 9 modules, AI agents follow it |
| Design System | Hardcoded colors in TSX | 0 occurrences (CI enforced) |

---

## 12. Exclusions

- Full react-admin rewrite (方案 B): too high risk, not suitable for marketplace/community features
- Ant Design → MUI migration: unnecessary, Ant Design v6 is mature and well-integrated
- Complete redesign: out of scope; focus on layout patterns + theme migration
