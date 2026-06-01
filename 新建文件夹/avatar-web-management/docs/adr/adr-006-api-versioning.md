# ADR-006: API 版本化策略

| 属性 | 值 |
|---|---|
| **编号** | ADR-006 |
| **状态** | 已采纳 |
| **日期** | 2026-05-26 |
| **决策者** | 开发团队 |

## 背景

项目 API 端点为 `/api/avatars`、`/api/assets` 等无版本前缀的路径。随着产品迭代，API 的请求/响应格式可能发生不兼容变更，这需要在不破坏现有客户端的前提下支持多版本 API。

## 决策

**采用 URL 路径版本化（`/api/v{N}/`），通过中间件内部重写兼容现有端点。**

1. **`/api/v1/*` 自动映射到 `/api/*`**：所有现有端点可通过 v1 路径访问，无需迁移代码
2. **响应头 `X-API-Version: 1`**：通过响应头明确告知客户端当前 API 版本
3. **新端点从 v2 开始**：未来新增的 `/api/v2/` 端点独立维护，不经过重写
4. **旧路径保持兼容**：`/api/avatars` 和 `/api/v1/avatars` 返回相同内容，现有客户端不受影响

排除的方案：
- **查询参数版本化**（`?version=1`）：查询参数容易遗漏，URL 不够清晰
- **自定义 Header 版本化**（`Accept: application/vnd.avatar.v1+json`）：调试不便，需要特殊工具支持
- **域名版本化**（`v1.api.example.com`）：增加运维复杂度

## 后果

### 正面
- 零迁移成本，所有现有端点自动获得 v1 前缀
- 新版本端点可以独立实现，不耦合现有代码
- 响应头版本号便于客户端做兼容处理
- 符合 RESTful 最佳实践

### 负面
- URL 路径长度增加 `/v1/` 前缀
- 未来 v2 端点需要从零实现，可能与 v1 有代码重复

## 参考资料

- [Stripe API 版本化](https://stripe.com/docs/api/versioning)
- [GitHub API 版本化](https://docs.github.com/en/rest/about-the-rest-api/api-versions)
