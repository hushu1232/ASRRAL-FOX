# ADR-012: OpenTelemetry 分布式追踪

| 属性 | 值 |
|---|---|
| **编号** | ADR-012 |
| **状态** | 已采纳 |
| **日期** | 2026-05-27 |
| **决策者** | Platform Team |

## 背景

平台已有 Pino JSON 结构化日志（含 requestId 关联）和 Sentry 错误监控，但缺少分布式追踪能力。当请求跨多个服务层（HTTP → Prisma → Redis → S3）时，无法：
- 端到端追踪单次请求的完整调用链
- 按层级拆解延迟（哪个环节慢？）
- 将日志（requestId）与追踪（traceId/spanId）关联以加速调试

## 决策

**使用 OpenTelemetry SDK (`@opentelemetry/sdk-node`) 作为追踪标准。**

- 使用 OTLP HTTP Exporter 导出到 Jaeger / Grafana Tempo / Datadog 等后端
- 开发环境自动降级为 ConsoleSpanExporter（无需外部服务）
- 采样策略：默认 `ParentBasedSampler` + `AlwaysOnSampler`（可通过 `OTEL_TRACES_SAMPLER` 环境变量切换）
- 自动插桩：HTTP 请求、Prisma 查询
- 手动插桩：缓存操作、导出操作、审计日志写入
- 在 `instrumentation.ts` 的 `register()` 中首先初始化（早于 DB 和 WS）
- Pino mixin 自动注入 traceId/spanId，实现日志→追踪关联

## 后果

### 正面
- 标准化的厂商中立追踪协议（CNCF 毕业项目），不锁定特定后端
- 开发环境零配置可用（console exporter）
- 自动 HTTP/Prisma 插桩覆盖大部分请求路径
- 日志→追踪关联无需额外代码（Pino mixin 自动注入）
- 与 Sentry 互补：Sentry 负责错误，OTel 负责性能

### 负面
- 增加的依赖包较多（8 个 OTel 包），约 2MB 额外体积
- 采样率 100% 时在高流量场景下会产生大量 span 数据（可通过 `OTEL_TRACES_SAMPLER_ARG` 调整）
- Prisma `$extends` 插桩在极端并发下可能有微小性能影响（<1ms 每查询）

### 中性
- 追踪后端（Tempo/Jaeger）需要单独部署，不在本 Helm chart 范围内
- 追踪上下文不会跨服务边界自动传播——需要 downstream 服务也接入 OTel

## 替代方案

| 方案 | 优点 | 缺点 | 为何未选 |
|---|---|---|---|
| Datadog APM | 开箱即用的完整方案 | 闭源、按主机收费、厂商锁定 | 不符合厂商中立原则 |
| New Relic | 免费层慷慨 | 闭源、数据出境合规风险 | 不在 CNCF 生态内 |
| Sentry Performance | 与已有 Sentry 集成 | 追踪能力弱于 OTel、按事件量收费 | Sentry 专注错误，追踪需专业工具 |
| 自研 context propagation | 零外部依赖 | 不标准、无法与现有工具集成 | 违反 "buy vs build" 原则 |

## 参考资料

- [OpenTelemetry JavaScript SDK](https://github.com/open-telemetry/opentelemetry-js)
- [AD4-004: Zod 环境变量校验](adr-004-zod-env-validation.md) — OTel 遵循相同的环境变量优先模式
- `src/lib/telemetry/index.ts` — 实现入口
- `src/lib/telemetry/prisma-instrumentation.ts` — Prisma 插桩
- `src/lib/logger.ts` — Pino mixin 注入 traceId/spanId
