# Phase 1 修改日志 — 2026-05-27

## 范围

此修改日志覆盖从 Phase 1 开始（2026-05-24）到 Phase 1 完成（2026-05-27）的所有文件变更。

---

## Web 管理平台 (avatar-web-management)

### 新建文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/app/api/pet/sync/route.ts` | API 路由 | JWT 认证，返回解密后的完整宠物配置（含 API Key） |
| `src/app/(auth)/notifications/page.tsx` | 页面 | 通知列表页：分页、类型彩色标签、标记已读、全部已读 |
| `src/app/(auth)/marketplace/[id]/page.tsx` | 页面 | 市场商品详情页 |
| `src/app/(auth)/marketplace/new/page.tsx` | 页面 | 上架新商品 |
| `src/app/(auth)/marketplace/seller/page.tsx` | 页面 | 卖家仪表盘 |
| `src/app/(auth)/seller/page.tsx` | 页面 | 卖家管理中心 |
| `src/app/(auth)/purchases/page.tsx` | 页面 | 购买历史 |
| `src/app/(auth)/dashboard/pet/page.tsx` | 页面 | 宠物配置页（含首次设置向导） |
| `src/app/(auth)/admin/MarketReviewTab.tsx` | 组件 | 管理后台市场审核 Tab |
| `src/app/api/market/items/route.ts` | API 路由 | 市场商品列表/创建 |
| `src/app/api/market/items/[id]/route.ts` | API 路由 | 市场商品 CRUD |
| `src/app/api/market/items/[id]/purchase/route.ts` | API 路由 | 购买商品 |
| `src/app/api/market/items/[id]/reviews/route.ts` | API 路由 | 商品评价 |
| `src/app/api/admin/market/items/route.ts` | API 路由 | 管理员市场审核 |
| `src/app/api/admin/market/items/[id]/route.ts` | API 路由 | 管理员单个商品操作 |
| `src/app/api/pet/set-avatar/route.ts` | API 路由 | 设置桌宠形象 |
| `src/app/api/pet/session/route.ts` | API 路由 | 桌宠会话日志 |
| `src/app/api/pet/export/route.ts` | API 路由 | 导出宠物配置 |
| `src/app/api/pet/assets/route.ts` | API 路由 | 宠物关联资产列表 |
| `src/app/api/pet/config/test/route.ts` | API 路由 | 测试配置端点 |
| `src/components/live2d/Live2DViewer.tsx` | 组件 | Cubism 5 WebGL2 渲染器（React 封装） |
| `src/components/market/AssetPickerModal.tsx` | 组件 | 资产选择弹窗 |
| `src/lib/live2d/cubism5.js` | 库 | Cubism 5 SDK WebAssembly 运行时 |
| `src/lib/services/market.service.ts` | 服务 | 市场服务层（商品CRUD、购买、评价、卖家仪表盘） |
| `src/lib/services/petService.ts` | 服务 | 宠物服务层（配置CRUD、加密、资产映射、导出） |
| `src/lib/pet-encryption.ts` | 工具 | AES-256-GCM 加密工具（用于 API Key 存储） |
| `src/lib/circuit-breaker.ts` | 工具 | 熔断器模式实现 |
| `e2e/notifications.spec.ts` | 测试 | 通知功能 E2E 测试（9 个用例） |
| `tests/contract/pet-api-contract.test.ts` | 测试 | 宠物 API 契约测试 |
| `tests/contract/pet-export-schema.test.ts` | 测试 | 宠物导出资架构测试 |
| `tests/unit/pet-service.test.ts` | 测试 | 宠物服务单元测试 |
| `tests/unit/pet-service-fault.test.ts` | 测试 | 宠物服务故障注入测试 |
| `Dockerfile` | 部署 | Next.js 多阶段构建 |
| `.github/workflows/fuzz.yml` | CI | Schemathesis API 模糊测试 |
| `.gitleaks.toml` | 安全 | GitLeaks 密钥扫描配置 |
| `CHANGELOG.md` | 文档 | 项目变更日志 |
| `CONTRIBUTING.md` | 文档 | 贡献指南 |
| `SECURITY.md` | 文档 | 安全策略 |
| `public/models/cattail/` | 静态资源 | CatTail Live2D Web 模型文件 |
| `public/vendor/` | 静态资源 | Cubism 5 SDK 框架文件 |
| `docs/adr/adr-007~012/` | 文档 | 6 个架构决策记录 |

### 修改文件

| 文件 | 变更说明 |
|------|---------|
| `src/components/layout/Sidebar.tsx` | 新增铃铛图标"通知"菜单项 |
| `src/components/layout/NotificationDropdown.tsx` | 优化下拉通知交互 |
| `src/app/(auth)/dashboard/page.tsx` | 新增宠物配置卡片入口 |
| `src/app/(auth)/marketplace/page.tsx` | 市场首页（含搜索/筛选/分页） |
| `src/app/layout.tsx` | 根布局优化 |
| `next.config.ts` | 更新 Next.js 配置 |
| `package.json` | 新增依赖 |
| `prisma/schema.prisma` | 新增 MarketItem/Order/Review/PetConfig 等模型 |
| `.gitignore` | 新增排除规则 |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src/app/(auth)/avatars/[id]/edit/page.tsx` | 编辑器页面移除（功能不在 MVP 范围） |
| `src/components/editor/*` (12 个文件) | 3D 编辑器组件移除 |
| `src/components/three/*` (14 个文件) | Three.js 3D 渲染组件移除 |
| `src/lib/screenshot/*` (4 个文件) | 截图服务移除 |
| `src/lib/morph-targets.ts` | 形变目标逻辑移除 |
| `src/stores/editorStore.ts` | 编辑器状态管理移除 |
| `src/middleware.ts` | 中间件迁移到 next.config.ts |
| 旧 Prisma migration 文件 (3 个) | 合并为单一初始化 migration |

---

## Python BFF (backend)

### 新建文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `Dockerfile` | 部署 | Python 3.12-slim + ffmpeg + EXPOSE 8765 + healthcheck |
| `test_ws.py` | 测试 | WebSocket 全场景测试（chat + commands + tools） |

### 修改文件

| 文件 | 变更说明 |
|------|---------|
| `tools.py` | 完全重写：mock stubs → 真实 API（和风天气 + Bing Search + 定时提醒），回调注册系统 |
| `config.py` | 新增 QWEATHER_API_KEY, BING_SEARCH_API_KEY |
| `main.py` | 每 WebSocket 注册/注销提醒回调，协议文档更新，health 端点增强 |
| `.env.example` | 新增天气/搜索 API Key 示例和获取地址 |

---

## Unity 桌宠客户端 (AstralFox)

### 修改文件

| 文件 | 变更说明 |
|------|---------|
| `Assets/Scripts/Runtime/Config/AppConfig.cs` | 默认模型路径改为 CatTail，角色名"星尘"，猫耳精灵性格/背景 |
| `Assets/Scripts/Runtime/Animation/FoxAnimationController.cs` | 新增 Greeting 状态（耳朵竖起+尾巴猛摇+前倾+眯眼），2.5s 自动回 Idle |
| `Assets/Scripts/Runtime/Animation/FoxParamId.cs` | 参数注释更新为 CatTail 特定映射（Hair→耳朵，Param2/3→尾巴） |
| `Assets/Scripts/Runtime/Animation/IPetAnimator.cs` | PetAnimationState 枚举新增 Greeting |
| `Assets/Scripts/Runtime/Animation/Live2DAnimator.cs` | 双向 ConvertState 映射新增 Greeting↔FoxState |
| `Assets/Scripts/Runtime/FoxSimpleMovement.cs` | Greeting 状态期间暂停桌面移动 |
| `Assets/Scripts/Runtime/Config/PetApiClient.cs` | 新增 FetchSyncConfig() — 从 /api/pet/sync 拉取解密 API Key |
| `Assets/Scripts/Runtime/Voice/BackendClient.cs` | 新增 OnReminder 事件 + WsMessage reminder_id/reminder_title 字段 |

---

## 项目根

### 新建文件

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | postgres + web + bff 三服务编排 |
| `devlog/2026-05-27-phase1-completion.md` | Phase 1 完成工程日志 |
| `devlog/2026-05-27-phase1-changelog.md` | 本修改日志 |

---

## 统计数据

| 指标 | 数值 |
|------|------|
| 新建文件 | ~60 |
| 修改文件 | ~50 |
| 删除文件 | ~35 |
| 新增代码行（估算） | ~8,000 |
| 删除代码行（估算） | ~4,500 |
| 净增代码行 | ~3,500 |
| 新增测试用例 | ~80 |
| TypeScript 编译 | 0 errors |
| 单元测试通过 | 455/455 |
