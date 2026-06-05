# ADR-001: 选择 Next.js 作为全栈框架

| 属性 | 值 |
|---|---|
| **编号** | ADR-001 |
| **状态** | 已采纳 |
| **日期** | 2025-01-15 |
| **决策者** | 开发团队 |

## 背景

虚拟形象 Web 管理平台需要一个同时承载前端 3D 编辑器界面和后端 REST API 的 Web 框架。项目初期规模较小（2-3 名开发者），需要快速迭代交付 MVP。系统涉及实时 3D 渲染（Three.js）、文件上传、认证鉴权等复杂功能。评估范围包括：前后端分离架构（Vite + Express/NestJS）、全栈框架（Next.js / Remix）、以及纯后端 API + 独立 SPA。

## 决策

**采用 Next.js 16 App Router 作为全栈框架**，统一处理前端页面渲染和后端 API 路由。核心理由：

1. **单一仓库、统一部署**：前后端共享 TypeScript 类型定义、Zod 校验 schema、工具函数，消除类型不一致和重复代码
2. **App Router 的文件系统路由**：pages (`/avatars`, `/marketplace`) 和 API routes (`/api/avatars`, `/api/auth`) 共处同一目录结构，降低认知负担
3. **React Server Components + ISR**：模板市场等公开页面可享受服务端渲染和增量静态再生成，提升首屏加载速度和 SEO
4. **中间件体系**：`middleware.ts` 可统一处理 JWT 认证、CSRF 校验、速率限制，无需额外的 API Gateway
5. **Vercel 原生部署**：边缘函数、Edge Config、Analytics 等开箱即用

排除的方案：
- **Vite + Express**：需要两套构建配置、双端口开发、CORS 处理，维护成本随端点数增长而线性增加
- **Remix**：生态成熟度不及 Next.js，3D 编辑器相关的社区资源（R3F + Next.js 集成教程、模板）更少
- **纯 API + SPA**：缺乏 SSR/ISR 能力，模板市场等公开页面的首屏性能和 SEO 无法满足产品需求

## 后果

### 正面
- 一个 `npm run dev` 启动全栈开发环境，开发体验流畅
- 前端组件可直接 `import` 后端工具函数（如 `formatDate`），无需通过 NPM 包共享
- App Router 的 Streaming SSR 可渐进式加载 3D 编辑器页面
- `middleware.ts` 统一处理认证、限流、CSRF，减少样板代码

### 负面
- Next.js 16 的 App Router 有陡峭的学习曲线（Server/Client Component 边界、`'use client'` 指令）
- WebSocket 支持需要自定义 server（当前通过 `ws` 库在 instrumentation 中启动）
- Edge Runtime 限制（无法使用 `better-sqlite3`、`argon2` 等原生模块），需要区分 middleware 和 route handler 的运行时
- Vercel 锁定风险：ISR、Edge Config 等功能深度绑定 Vercel 平台

### 中性
- 需要持续关注 Next.js 大版本升级的 Breaking Changes（如 v15→v16 的 async params）
- 3D 编辑器中的大量状态管理组件必须标记为 `'use client'`，需权衡服务端渲染范围

## 参考资料

- [Next.js App Router 文档](https://nextjs.org/docs/app)
- [React Three Fiber + Next.js 集成指南](https://docs.pmnd.rs/react-three-fiber)
