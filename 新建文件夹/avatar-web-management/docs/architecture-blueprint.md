# 工程图谱 — AstralFox Market

> 架构全景快照 2026-05-28 | 供重架构参考

---

## 1. 目录总览

```
avatar-web-management/
├── middleware.ts              # Edge: bot防护/i18n/鉴权/安全头
├── next.config.ts             # standalone + CSP + 图片域名 + Sentry
├── jest.config.js             # node环境, ts-jest, 30s超时
├── tsconfig.json              # strict:true, ES2022
├── prisma/schema.prisma       # PostgreSQL 数据模型 (20 models)
├── database/
│   ├── schema.sql             # SQLite DDL (遗留，与PG并存)
│   └── data.db                # SQLite 运行时数据
├── keys/                      # JWT RS256 密钥对
├── messages/                  # i18n 翻译文件
│   ├── en.json                # 469行
│   ├── zh-CN.json             # 469行
│   └── ja.json                # 1032行 (异常)
├── src/
│   ├── app/
│   │   ├── (auth)/            # 需登录的页面路由
│   │   │   ├── dashboard/ avatars/ assets/ marketplace/
│   │   │   ├── seller/ settings/ notifications/ admin/
│   │   │   └── layout.tsx     # AppLayout + ErrorBoundary
│   │   ├── login/ register/ forgot-password/  # 公开页面
│   │   ├── api/               # 75个API路由文件
│   │   │   ├── auth/          # login/register/refresh/logout/reset/sso
│   │   │   ├── admin/         # users/reviews/audit-logs/stats/market/oauth/experiments
│   │   │   ├── avatars/       # CRUD + versions + export + batch
│   │   │   ├── assets/        # CRUD + upload(init/chunk/complete) + proxy + batch
│   │   │   ├── market/        # items/purchases/downloads/seller
│   │   │   ├── pet/           # config/session/sync/export/assets/set-avatar
│   │   │   ├── settings/      # profile/2fa/api-keys/login-history
│   │   │   ├── notifications/ # CRUD + read-all + unread-count
│   │   │   ├── oauth/         # authorize/token/userinfo
│   │   │   ├── parts/         # CRUD + rules + validate
│   │   │   ├── dashboard/     # stats
│   │   │   ├── search/ templates/
│   │   │   ├── health/ metrics/ docs/ csp-report/ revalidate/
│   │   │   └── v2/            # 空目录 (ADR-006 预留)
│   │   └── globals.css
│   ├── components/
│   │   ├── auth/              # LoginForm, RegisterForm
│   │   ├── common/            # ErrorBoundary, AvatarCard, PlaceholderImage
│   │   ├── dashboard/         # KpiCards, CreationTrendChart, PartUsageChart, RecentAvatars
│   │   ├── layout/            # AppLayout, Header, Sidebar, NotificationDropdown, SearchModal
│   │   ├── live2d/            # Live2DViewer
│   │   ├── market/            # AssetPickerModal
│   │   ├── monitoring/        # PerformanceMonitor
│   │   ├── providers/         # AntdProvider
│   │   ├── __tests__/         # 12 组件测试文件 (112 tests)
│   │   ├── admin/ assets/ avatars/ marketplace/ settings/ shared/
│   │   │   └── # 7个空目录
│   │   └── stories/           # Storybook
│   ├── lib/
│   │   ├── auth/              # jwt.ts, keys.ts, middleware.ts, oauth-provider.ts, oidc.ts, password.ts, pkce-store.ts, roles.ts, totp.ts
│   │   ├── db/                # index.ts (SQLite+PG), pg.ts, pool.ts, seed.ts, seed-market.ts
│   │   ├── design-system/     # antd-tokens.ts, css-vars.ts, tokens.ts
│   │   ├── experiments/       # store.ts, useExperiment.ts
│   │   ├── export/            # glb-exporter.ts, vrm-exporter.ts
│   │   ├── metrics/           # Prometheus 指标采集
│   │   ├── performance/       # webVitals.ts
│   │   ├── rate-limit/        # index.ts (Upstash), memory.ts (降级)
│   │   ├── redis/             # client.ts, cache.ts, cache-middleware.ts, rate-limiter.ts
│   │   ├── services/          # 8 业务服务
│   │   │   ├── asset.service.ts
│   │   │   ├── avatar.service.ts   # CRUD + 版本管理 (Prisma)
│   │   │   ├── export.service.ts
│   │   │   ├── market.service.ts
│   │   │   ├── notification.service.ts
│   │   │   ├── petService.ts       # 桌宠配置 (Prisma)
│   │   │   └── search.service.ts
│   │   ├── storage/           # chunked-upload.ts, fs.ts, minio.ts, pipeline.ts
│   │   ├── telemetry/         # OpenTelemetry 初始化
│   │   ├── ws/                # WebSocket server (端口3001)
│   │   ├── api-client.ts      # 前端 API 调用封装
│   │   ├── api-contracts.ts   # 响应类型契约
│   │   ├── api-response.ts    # success()/error()/paginated() 统一包装
│   │   ├── audit.ts           # logAudit()
│   │   ├── cache.ts           # 应用层缓存 (tryCacheHit/cacheResponse)
│   │   ├── cdn.ts             # CDN URL 解析
│   │   ├── circuit-breaker.ts # 熔断器
│   │   ├── constants.ts       # ROLE_HIERARCHY, AVATAR_STYLES, AVATAR_STATUS_MAP
│   │   ├── cors.ts            # CORS 动态白名单
│   │   ├── csrf.ts            # Double Submit Cookie
│   │   ├── errors.ts          # AppError/NotFound/Unauthorized/Forbidden/Validation/Conflict
│   │   ├── feature-flags.ts   # GrowthBook
│   │   ├── logger.ts          # Pino 结构化日志
│   │   ├── openapi.json       # OpenAPI 3.1.0 规范 (1191行)
│   │   ├── prisma.ts          # Prisma client 单例
│   │   ├── request-context.ts # AsyncLocalStorage 请求上下文
│   │   ├── use-api.ts         # 前端 useApi hook
│   │   └── validators.ts      # Zod schema (login/register/avatar/version/asset/profile)
│   ├── i18n/                  # request.ts, routing.ts
│   ├── instrumentation.ts     # register(): OTel+DB+WS 初始化
│   ├── proxy.ts               # WebSocket 代理
│   ├── stores/                # authStore.ts, uiStore.ts (Zustand)
│   └── types/                 # API/Avatar/Asset/Editor/Part/User/Workspace 类型
├── tests/
│   ├── helpers.ts             # HTTP 请求封装 (get/post/put/del/loginAs/loginAndGetCookies)
│   ├── jest.setup.ts          # polyfill + mock
│   ├── globalSetup.ts         # Testcontainers (可选)
│   ├── auth.test.ts           # 登录 + JWT 鉴权 (6)
│   ├── auth-flow.test.ts      # 刷新令牌流程 (8)
│   ├── avatars.test.ts        # 头像列表 + 创建 (7)
│   ├── avatar-crud.test.ts    # 完整CRUD + 版本 (7)
│   ├── smoke.test.ts          # 全链冒烟 (32)
│   ├── pet-config.test.ts     # 桌宠配置 (7)
│   ├── assets-upload.test.ts  # 资产上传 (12)
│   ├── review-flow.test.ts    # 审核流程 (8)
│   ├── security/              # CSP/CORS/rate-limit 测试
│   ├── contracts/             # 响应快照契约测试
│   ├── visual/                # 视觉回归测试 (jest-image-snapshot)
│   └── __mocks__/             # uuid mock
├── e2e/                       # Playwright E2E (9 spec)
├── k6/                        # K6 负载测试脚本
├── monitoring/                # Grafana/Prometheus/Loki 配置
├── helm/                      # Helm Chart
├── terraform/                 # IaC
├── argocd/                    # GitOps
├── chaos/                     # 混沌工程实验
├── .github/workflows/         # CI (ci.yml + fuzz.yml)
└── docs/adr/                  # 12份ADR (001-012)
```

---

## 2. 请求处理管道

```
HTTP Request
  │
  ▼
middleware.ts (Edge Runtime)
  ├── 1. Bot检测 → 敏感auth端点过滤空UA
  ├── 2. API鉴权 → /api/* 非公开路由检查 Bearer token
  ├── 3. i18n → 检测locale, 写NEXT_LOCALE cookie
  └── 4. 页面鉴权 → 保护页无token→重定向/login
  │
  ▼
Route Handler (Node.js Runtime)
  ├── withAuth() → JWT验证 (RS256+HS256 fallback)
  ├── requireRole('admin'|'auditor') → RBAC
  ├── withRateLimit() → Upstash/memory限流
  ├── Zod validation → 请求体校验
  │
  ├── service layer → 业务逻辑 (Prisma)
  ├── cache layer → tryCacheHit/cacheResponse
  │
  ▼
NextResponse → { success, data/error }
```

---

## 3. 数据层双轨现状

```
┌─────────────────────────────────────┐
│          Route Handler               │
│                                      │
│  getDb() ──────────► SQLite          │
│  (better-sqlite3)   database/data.db │
│                                      │
│  getPrisma() ──────► PostgreSQL      │
│  (Prisma Client)    localhost:5432   │
└─────────────────────────────────────┘

已迁移到 Prisma: all admin/*, avatars, assets, market, pet, notifications, oauth
仍用 getDb():   auth/*, settings/*, templates, health, dashboard/stats, parts/*
```

---

## 4. 数据库模型 (Prisma - PostgreSQL)

```
Workspace ──┬── User ──┬── RefreshToken
            │          ├── Avatar ──┬── AvatarVersion
            │          │            └── PetConfig ──┬── PetAssetMapping
            │          ├── Asset                  └── PetSessionLog
            │          ├── ApiKey
            │          ├── Notification
            │          ├── MarketItem ──┬── Order
            │          │               └── Review
            │          ├── PasswordResetToken
            │          └── AuditLog
            │
            └── (其他)
```

---

## 5. 组件树

```
AppLayout
├── Header
│   ├── SearchModal (键盘导航, 自动聚焦)
│   └── NotificationDropdown
│       └── NotificationList
├── Sidebar (可收起, 11个导航项)
└── <main> (页面内容)
    ├── ErrorBoundary (降级UI)
    ├── PerformanceMonitor
    └── [Page Content]
        ├── LoginForm / RegisterForm
        ├── Dashboard: KpiCards, CreationTrendChart, PartUsageChart, RecentAvatars
        ├── Avatars: AvatarCard, PlaceholderImage
        ├── Assets: AssetPickerModal
        └── Live2D: Live2DViewer
```

---

## 6. 安全架构

```
请求入口:
├── Bot检测 (middleware.ts) — 13种UA模式, 仅限敏感auth端点
├── CORS (cors.ts) — 动态白名单, CORS_ORIGINS环境变量
├── CSRF (csrf.ts) — Double Submit Cookie (XSRF-TOKEN + X-CSRF-Token)
├── 速率限制 (rate-limit/) — Upstash Redis + 内存降级
│   ├── login: 5/60s
│   ├── register: 3/60s
│   ├── upload: 20/10min
│   └── default: 100/60s
├── JWT鉴权 (auth/jwt.ts) — RS256主 + HS256备用
│   ├── accessToken: 15min
│   └── refreshToken: 7d, httpOnly cookie
├── RBAC (auth/roles.ts) — super_admin(100) > admin(80) > auditor(60) > designer(40) > user(20)
├── 输入校验 (validators.ts) — Zod + stripHtml防XSS
├── 密码 (auth/password.ts) — argon2id
├── 2FA (auth/totp.ts) — TOTP
├── OAuth2.0 (oauth/) — Authorization Code + PKCE
├── CSP (next.config.ts) — production严格模式, report-uri收集
└── 密钥扫描 (.gitleaks.toml) — CI自动检查
```

---

## 7. 可观测性栈

```
OpenTelemetry ──► OTLP HTTP Exporter ──► Jaeger/Grafana
Sentry ──► 错误追踪 + Performance (web-vitals)
Prometheus ──► /api/metrics (自定义指标)
Grafana ──► monitoring/grafana-dashboards/
Loki ──► 日志聚合
Pino ──► 结构化日志 (requestId, traceId自动注入)
Health ──► /api/health (DB/Prisma/Redis/Storage检查)
```

---

## 8. 部署架构

```
CI (GitHub Actions):
  gitleaks → lint → typecheck → test → e2e → docker build → trivy scan → SBOM

容器化:
  Dockerfile (multi-stage, standalone output)
  → ghcr.io

编排:
  Helm Chart (helm/avatar-web/)
  ArgoCD (argocd/)
  Terraform (terraform/)

CD: 缺失 (docker push 后无自动部署)
```

---

## 9. 关键技术债务

| 项目 | 影响面 | 修复工时 |
|------|--------|----------|
| 17个路由仍用 getDb() (SQLite) | 跨库数据不同步 | 3-5天 |
| 组件硬编码中文 14处 | i18n不完整 | 0.5天 |
| ja.json 异常膨大 | 翻译不同步 | 1h |
| 7个空目录 + 空 v2/ + 空 services/ | 代码清洁度 | 5min |
| 合约测试失败 (health格式) | CI红 | 10min |
| 视觉回归测试未安装依赖 | CI红 | 5min |
| 仪表板组件0%测试覆盖 | 质量 | 2天 |
| OpenAPI spec 覆盖 8/75 路由 | 文档 | 3天 |
| CD 部署流水线缺失 | DevOps | 1天 |
