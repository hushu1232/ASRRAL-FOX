# 架构决策记录 (ADR)

本目录记录了虚拟形象 Web 管理平台的重大架构决策及其背景、权衡和后果。

## ADR 索引

| 编号 | 标题 | 状态 | 日期 |
|---|---|---|---|
| [ADR-001](adr-001-nextjs-fullstack.md) | 选择 Next.js 作为全栈框架 | 已采纳 | 2025-01-15 |
| [ADR-002](adr-002-sqlite-to-postgresql.md) | 数据库从 SQLite 迁移到 PostgreSQL 的决策与时机 | 已采纳 | 2025-03-10 |
| [ADR-003](adr-003-react-three-fiber.md) | 选用 React Three Fiber 而非原生 Three.js 进行 3D 渲染 | 已采纳 | 2025-02-01 |
| [ADR-004](adr-004-zod-env-validation.md) | 使用 Zod 进行启动时环境变量校验 | 已采纳 | 2025-04-01 |
| [ADR-005](adr-005-rate-limit-strategy.md) | 限流方案选择 Upstash Redis 与滑动窗口算法 | 已采纳 | 2025-05-10 |
| [ADR-006](adr-006-api-versioning.md) | API 版本化策略 — URL 路径 /api/v{N}/ | 已采纳 | 2026-05-26 |
| [ADR-007](adr-007-snake-case-api-convention.md) | Snake-case API 响应键名约定 | 已采纳 | 2026-05-26 |
| [ADR-008](adr-008-pet-api-key-encryption.md) | 桌宠 API Key AES-256-GCM 加密方案 | 已采纳 | 2026-05-26 |
| [ADR-009](adr-009-pet-submodule-architecture.md) | 桌宠模块作为平台子模块的架构决策 | 已采纳 | 2026-05-26 |
| [ADR-010](adr-010-animation-model-abstraction.md) | 动画系统抽象（Live2D / DragonBones / VRM） | 已采纳 | 2026-05-26 |
| [ADR-011](adr-011-pet-session-logging.md) | 桌宠会话日志记录方案 | 已采纳 | 2026-05-26 |
| [ADR-012](adr-012-opentelemetry-tracing.md) | OpenTelemetry 分布式追踪方案 | 已采纳 | 2026-05-27 |

## 状态说明

- **提议** — 正在讨论中，尚未做出最终决策
- **已采纳** — 决策已通过并正在实施
- **已废弃** — 决策已被推翻或不再适用
- **已替代** — 被更新的 ADR 所取代

## 创建新的 ADR

1. 复制 `adr-template.md` 作为起点
2. 按编号递增命名：`adr-NNN-title-slug.md`
3. 填写所有章节（背景、决策、后果、替代方案）
4. 更新本 README 的索引表格
5. 提交 PR 请求团队审查

---

*最后更新：2026-05-27*
