# 技术债务清理任务列表

> 基于 2026-05-29 功能完成度检查报告 | 按投入产出比排序

---

## 已完成 ✅

| # | 任务 | 工时 | 状态 |
|---|------|------|------|
| D1 | 清理6个空组件目录 | 5min | ✅ 已完成 |
| D2 | 修复视觉回归测试依赖 (jest-image-snapshot) | 5min | ✅ 已完成 |
| D3 | 修复健康检查合约测试 (health格式不一致) | 10min | ✅ 已完成 |
| D5 | SQLite→PostgreSQL路由迁移 (32个路由) | 3-5d | ✅ 已完成 |

## 待完成 ⬜

| # | 任务 | 工时 | 状态 |
|---|------|------|------|
| D4 | 实现CD自动部署流水线 (GitHub Actions deploy job) | 1d | ✅ 已完成 |

---

## D1: 清理空组件目录 ✅

**范围**: `src/components/` 下 6 个空目录
- `admin/` `assets/` `avatars/` `marketplace/` `settings/` `shared/`
- 已删除所有空目录

---

## D2: 修复视觉回归测试依赖 ✅

**修复**: 在 `jest.config.js` 添加 `testPathIgnorePatterns: ['<rootDir>/tests/visual/']`
- 视觉测试有独立的 `tests/visual/jest.config.ts` 配置 `toMatchImageSnapshot`

---

## D3: 修复健康检查合约测试 ✅

**修复**: 统一 health 端点 status 格式与 validator 一致

---

## D5: SQLite → PostgreSQL 路由迁移 ✅

**范围**: 32 个路由全部迁移完成

### 迁移记录

| 批次 | 路由 | 日期 |
|------|------|------|
| Auth (6) | login, register, refresh, forgot-password, reset-password, sso/callback | 2026-05-29 |
| Settings (5) | profile, 2fa, api-keys, api-keys/[id], login-history | 2026-05-29 |
| Admin (8) | users, users/[id], reviews, reviews/[id], audit-logs, stats, market/items, market/items/[id] | 2026-05-29 |
| Market (2) | items/[id]/purchase, purchases (已是Prisma无需改造) | - |
| Parts (3) | route, rules, validate | 2026-05-29 |
| Others (8) | dashboard/stats, health, templates, oauth/userinfo, rigging/models, rigging/models/[id], assets/upload, assets/upload/[uploadId]/complete | 2026-05-29 |

### 剩余 `getDb()` 使用（非路由，内部库文件）

- `src/lib/db/index.ts` — getDb 函数定义
- `src/lib/db/seed.ts` — 种子脚本
- `src/lib/db/seed-market.ts` — 市场种子脚本
- `src/lib/auth/jwt.ts` — JWT 令牌操作
- `src/lib/storage/pipeline.ts` — 管线任务队列

---

## D4: CD自动部署流水线 ✅

**文件**: `.github/workflows/ci.yml`
**实现**:
- `deploy` job 依赖 `docker-build-push`，仅 main 分支 push 触发
- `helm upgrade` + `--set image.tag=<sha>` + `--atomic` 自动部署
- 失败自动 `helm rollback` 到上一版本
- Slack 通知 `#avatar-deploys`（成功）/ `#avatar-alerts`（失败）
- `scripts/helm-rollback.sh` — 交互式手动回滚脚本
- `scripts/deploy.sh` — ArgoCD 手动同步脚本
**所需 Secrets**: `KUBECONFIG`, `SLACK_DEPLOY_WEBHOOK_URL`
