# ADR-004: 使用 Zod 进行启动时环境变量校验

| 属性 | 值 |
|---|---|
| **编号** | ADR-004 |
| **状态** | 已采纳 |
| **日期** | 2025-04-01 |
| **决策者** | 开发团队 |

## 背景

项目依赖大量环境变量：数据库连接 (`DATABASE_URL`, `REDIS_HOST`)、JWT 密钥 (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`)、对象存储配置 (`MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`)、第三方服务 (`SENTRY_DSN`, `UPSTASH_REDIS_REST_URL`) 等。在开发过程中，多次出现因遗漏环境变量或值格式错误导致运行时崩溃的问题。传统的 `process.env.XXX || 'default'` 模式缺乏类型安全，且不会在启动时报告缺失的必需配置。

## 决策

**使用 Zod v4 在应用启动时（`next.config.ts` 和 `instrumentation.ts`）对所有环境变量进行解析和校验。** 校验失败直接抛出错误并打印具体缺失/格式错误的变量名，阻止应用启动。

关键设计：
1. **集中定义**：所有环境变量的名称、类型、默认值和校验规则集中在一个 schema 文件中
2. **启动即校验**：在 `instrumentation.ts` 的 `register()` 阶段执行校验，早于任何业务逻辑
3. **细化类型**：不仅校验存在性，还校验格式（如 URL 格式、Base64 格式的密钥、数字范围等）
4. **开发友好**：提供清晰的错误消息指出哪个变量缺失或格式错误

排除的方案：
- **手动 `process.env` 检查**：分散在代码各处，容易遗漏，且错误消息不友好
- **`envalid` 库**：功能类似但生态不如 Zod 活跃，且项目已在 API 层使用 Zod 做输入校验，统一工具栈更优
- **`dotenv` + 类型声明**：仅加载 `.env` 文件，不做运行时校验
- **`t3-env`**：Next.js 专用方案，但绑定了 T3 生态，且 Zod 已能满足需求

## 后果

### 正面
- 启动时即可发现配置错误，避免运行时在用户请求中崩溃（fail-fast 原则）
- Zod schema 可被 TypeScript 推导出精确类型，IDE 自动补全 `env.XXX`
- 统一的校验代码作为文档，开发者可通过阅读 schema 了解所有配置项
- 同一个 schema 可复用于 CI/CD 流水线中的配置校验

### 负面
- 每次新增环境变量需要同步更新 Zod schema，增加少量维护成本
- 启动时校验会增加冷启动时间（通常 < 100ms，可忽略）
- Zod v4 API 与 v3 不完全兼容，迁移时需注意 Breaking Changes

### 中性
- 需制定团队规范：新增环境变量必须同步更新 Zod schema 和 `.env.example`

## 参考资料

- [Zod 文档](https://zod.dev/)
- [Next.js 环境变量最佳实践](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
