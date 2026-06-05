# ADR-002: 数据库从 SQLite 迁移到 PostgreSQL 的决策与时机

| 属性 | 值 |
|---|---|
| **编号** | ADR-002 |
| **状态** | 已采纳 |
| **日期** | 2025-03-10 |
| **决策者** | 开发团队 |

## 背景

项目初期使用 `better-sqlite3` 作为开发数据库——零配置、嵌入式、单文件存储，非常适合本地开发和快速原型。但随着功能增长（用户体系、工作空间隔离、部件规则引擎、版本管理、审批流），SQLite 的局限性逐渐暴露：缺乏并发写入支持（单写锁）、无原生数组/JSON 查询优化、无法水平扩展。生产环境需要支持多实例部署、连接池管理、行级安全策略。

## 决策

**采用双模式数据库架构：SQLite 用于本地开发，PostgreSQL 用于生产环境。** 通过统一的查询抽象层 (`src/lib/db/index.ts`) 根据 `DATABASE_URL` 环境变量自动切换数据库后端。

关键设计：
1. **共享 SQL 子集**：所有查询使用标准 SQL 语法，避免 SQLite/PostgreSQL 特有函数
2. **启动时自动迁移**：`db/index.ts` 在首次连接时执行 DDL，无需独立迁移工具
3. **连接管理**：SQLite 使用单连接（`better-sqlite3` 同步 API），PostgreSQL 使用连接池（`pg.Pool`）
4. **渐进迁移策略**：任何开发者 `git clone` 后无需配置即可通过 SQLite 运行；部署到生产时设置 `DATABASE_URL` 即可切换到 PostgreSQL

排除的方案：
- **纯 SQLite**：无法支撑生产环境的并发需求和多实例部署
- **纯 PostgreSQL**：增加本地开发的环境搭建成本（需要安装/运行 PG 服务）
- **Prisma ORM**：虽然提供更好的类型安全，但增加了一层抽象和学习成本。项目现有 SQL 查询简单直接，Prisma 的收益不及其迁移成本
- **Drizzle ORM**：类似 Prisma，且项目早期的直接 SQL 查询模式已经稳定

## 后果

### 正面
- 开发体验零摩擦：`git clone && npm install && npm run dev` 即可启动
- 生产环境享受 PostgreSQL 的并发性能、连接池、JSONB 查询优化
- 双模式架构天然支持 CI/CD（测试用 SQLite，部署用 PG）
- 连接的抽象层让未来切换到其他数据库（如 PlanetScale/MySQL）成为可能

### 负面
- 需要维护两套连接管理的代码路径
- SQLite 和 PostgreSQL 的细微差异（如日期函数 `datetime('now')` vs `NOW()`）需要在代码中处理
- 开发环境与生产环境的数据库行为不完全一致，可能产生"开发通过、生产异常"的 bug
- 缺乏 ORM 的类型安全，SQL 拼写错误只能在运行时发现

### 中性
- 如果未来团队规模扩大，可能需要重新评估是否引入 Prisma/Drizzle
- JSON 字段在 SQLite 中以 TEXT 存储，查询效率低于 PostgreSQL 的 JSONB

## 参考资料

- [better-sqlite3 文档](https://github.com/WiseLibs/better-sqlite3)
- [node-postgres 文档](https://node-postgres.com/)
