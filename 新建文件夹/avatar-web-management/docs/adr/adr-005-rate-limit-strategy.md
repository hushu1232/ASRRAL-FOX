# ADR-005: 限流方案选择 Upstash Redis 与滑动窗口算法

| 属性 | 值 |
|---|---|
| **编号** | ADR-005 |
| **状态** | 已采纳 |
| **日期** | 2025-05-10 |
| **决策者** | 开发团队 |

## 背景

随着 API 端点数量增长（30+ 端点），需要对所有 `/api/*` 路由实施速率限制，防止暴力攻击（登录撞库）、资源滥用（文件上传）和意外的流量尖峰。需要一套既能满足开发环境零配置运行、又能在生产环境中跨多实例共享状态的限流方案。

## 决策

**采用 Upstash Redis + 滑动窗口算法作为主要限流方案，内存存储作为本地开发的自动回退。**

架构设计：
1. **全局中间件统一拦截**：`middleware.ts` 对所有 `/api/*` 路由执行限流检查，区分路由配置不同的限制
2. **Upstash Redis 优先**：根据是否存在 `UPSTASH_REDIS_REST_URL` 环境变量自动启用，提供跨实例一致的限流计数
3. **内存滑动窗口回退**：当 Upstash 不可用时（本地开发、Redis 故障），回退到内存 `Map<string, WindowEntry>` 存储
4. **差异化配置**：通用 API (100/60s)、登录 (5/60s)、上传 (20/10min)、导出 (3/5min)
5. **用户级限流**：上传/导出等敏感操作从 JWT 提取 `userId` 做用户级限流，而非仅依赖 IP

排除的方案：
- **Express-rate-limit + Redis Store**：依赖 Express 中间件，不适用于 Next.js App Router
- **next-rate-limit**：社区库功能有限，不支持滑动窗口和用户级限流
- **纯内存方案（生产用）**：但多实例部署时无法共享计数，限流不准确
- **Nginx/API Gateway 限流**：配置复杂，且无法实现用户级限流（需要 JWT 解析）
- **固定窗口算法**：边界突刺问题（窗口重置瞬间可发送 2×limit 请求），滑动窗口更平滑

## 后果

### 正面
- 中间件统一处理，无需在每个 API 路由中手动添加限流代码
- 开发环境零配置可用（内存回退），生产环境自动升级到 Redis
- 滑动窗口算法避免了固定窗口的边界突刺问题
- 响应头 `X-RateLimit-*` 可帮助客户端实现自适应请求速率
- Upstash REST API 兼容 Edge Runtime，无需原生 TCP 连接
- 用户级限流防止单个 IP 绕过限制（如公司 NAT 场景）

### 负面
- 内存存储在多实例部署时不一致（这是回退方案的设计妥协）
- Upstash Redis 增加月度运营成本（按请求量计费）
- 限流 key 的粒度需要在"太粗"（误伤正常用户）和"太细"（key 爆炸）之间平衡
- 每个请求增加一次 Redis 网络调用，P99 延迟约增加 5-15ms

### 中性
- 限流阈值需要根据实际流量数据持续调整
- 需要监控 429 响应的比例，判断是否误限正常用户
- 未来可能需要引入令牌桶算法以支持突发流量

## 参考资料

- [Upstash Ratelimit 文档](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [滑动窗口算法 vs 固定窗口](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/)
- [RFC 6585 — 429 Too Many Requests](https://datatracker.ietf.org/doc/html/rfc6585)
