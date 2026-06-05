# 工程日志 — AstralFox Market

> 最后更新: 2026-05-28

## 当前状态

| 指标 | 数值 |
|------|------|
| 项目完成度 | 78% |
| 集成测试 | 94/94 通过 (8 suites) |
| 组件测试 | 112/112 通过 (12 suites) |
| 行覆盖率 | 67.2% (1519/2259) |
| 源码文件 | ~231 |

## 本轮修复记录 (2026-05-28)

### 硬伤修复 (本轮 — 已完成)

1. **SQL 注入 + 白名单缺失** — admin users/reviews 路由增加 role/status/action 白名单校验
2. **audit-logs 无 try/catch** — 补全异常处理，防止堆栈泄露
3. **双数据库（SQLite + PostgreSQL）admin 面** — 6 个 admin 路由从 `getDb()` 迁移到 `getPrisma()`

### 修改文件清单

| 文件 | 变更类型 |
|------|----------|
| `src/app/api/admin/users/route.ts` | 重写: getDb()→Prisma + 白名单 |
| `src/app/api/admin/users/[id]/route.ts` | 重写: getDb()→Prisma + 白名单 |
| `src/app/api/admin/reviews/route.ts` | 重写: getDb()→Prisma + 白名单 |
| `src/app/api/admin/reviews/[id]/route.ts` | 重写: getDb()→Prisma + 白名单 |
| `src/app/api/admin/audit-logs/route.ts` | 重写: getDb()→Prisma + try/catch |
| `src/app/api/admin/stats/route.ts` | 重写: 混合→纯Prisma |
| `src/lib/db/index.ts` | `isPostgres()` 优先检查 POSTGRES_PRISMA_URL |
| `database/schema.sql` | 修复 `//` → `--` SQL 注释 |

### 上一轮修复记录 (上下文恢复前)

| 任务 | 状态 |
|------|------|
| AdminTabs 测试修复 | 13/13 通过 |
| root middleware.ts 补全 | 已完成（bot 防护/i18n/鉴权/安全头） |
| openapi.json `//` 注释修复 | 已完成 |
| globals.css `//` 注释修复 | 已完成 |
| API 集成测试补全 | 4 新文件，41 新测试 |
| pet-config 测试 snake_case 修复 | 已完成 |
| test helpers 扩展 | cookie/DELETE/User-Agent 支持 |

## 存量已知问题

### 严重
- **双数据库残留**: admin 外的 17 个路由仍用 `getDb()` (SQLite)，与 Prisma (PostgreSQL) 数据不同步
- **审核流跨库断裂**: 版本数据在 PG，审核路由原在 SQLite（本轮已修 admin 面）

### 中等
- 合约测试 `health` 缺少 `success` 包装 — 1 个测试失败
- 视觉回归测试 `jest-image-snapshot` 未安装 — 5 个测试失败
- 组件硬编码中文 14 处（validators / Sidebar / ErrorBoundary）
- `ja.json` 1032 行 vs en/zh-CN 469 行 — 不同步
- 7 个空组件目录 + 空 `api/v2/` 目录 + 空 `src/services/`
- OpenAPI spec 覆盖 ~8/75 路由

### 低优
- 仪表板组件 0% 测试覆盖
- 无 CSP 头（有 `/api/csp-report` 端点但未启用）
- README 缺少架构图/技术栈

## 未启动的任务
- [ ] #3: 硬编码中文字符串移除
- [ ] #4: API v2 目录清理/实施
- [ ] #5: 空组件目录清理
- [ ] #6: CD 部署流水线
