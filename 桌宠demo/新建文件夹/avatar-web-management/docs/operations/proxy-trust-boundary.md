# 生产反向代理信任边界

## 必需配置

生产环境只有在反向代理能够注入可信客户端地址时，才启用代理头限流：

```env
TRUST_PROXY_HEADERS=true
TRUST_PROXY_SECRET=<random-secret-shared-with-your-proxy>
```

代理必须完成以下动作：

1. 删除客户端提供的 `x-foxd-proxy-token`、`x-forwarded-for` 和 `x-real-ip`；
2. 写入服务端配置的 `x-foxd-proxy-token`，值必须等于 `TRUST_PROXY_SECRET`；
3. 覆盖 `x-forwarded-for` 和 `x-real-ip`，不能把客户端值追加到可信值前面；
4. 禁止公网绕过代理直接访问 Next.js 应用端口。

应用只接受单值的 `x-forwarded-for` 或 `x-real-ip`。缺少共享代理认证、出现追加链、或生产环境没有可信客户端地址时，非豁免 API 返回 `503`，不会跳过限流。

## 本地开发

本地开发默认不信任转发头。没有代理时，应用使用按路由隔离的 `local-dev` 限流桶；不要把这个开发回退策略用于生产。

## 轮换

轮换 `TRUST_PROXY_SECRET` 时，应先同步代理和应用配置，再重启应用。旧密钥请求会被视为没有可信客户端地址并返回 `503`。

## Nginx Ingress 生产冒烟配置

生产 Helm values 已打开请求体缓冲，并把 Ingress 的单次请求上限设为 `100m`。这会让客户端的 chunked 请求先在网关侧落盘缓冲，再以带 `Content-Length` 的请求转发给应用；应用代理因此可以在路由处理前拒绝未知大小的请求体。

Ingress 还需要引用一个由密钥管理流程生成的 header ConfigMap（不要把真实 token 提交到仓库）：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: avatar-web-proxy-headers
  namespace: production
data:
  X-Foxd-Proxy-Token: <same-value-as-TRUST_PROXY_SECRET>
  X-Forwarded-For: "$remote_addr"
  X-Real-IP: "$remote_addr"
```

部署前检查：

1. ConfigMap 与应用位于同一 namespace，且 Ingress controller 服务账号可以读取它；
2. 应用 Secret 中的 `TRUST_PROXY_SECRET` 与 ConfigMap 的 token 完全一致；
3. 应用 Service 不暴露公网端口，只允许 Ingress 到达；
4. 用一条正常 JSON 请求和一条超过限制的请求验证：前者进入限流链路，后者在网关或应用代理返回 `413`，无 `Content-Length` 的带 body 请求返回 `411`。

本地或 CI 可以先运行零依赖的静态配置检查：

```bash
node scripts/check-production-proxy-config.mjs
```

## Refresh Token 兼容退出

新签发的 refresh token 只保存 SHA-256。迁移期间默认双读旧明文记录；设置 `JWT_LEGACY_REFRESH_TOKEN_CUTOFF` 为 RFC 3339 时间后，截止时间到达即只读哈希记录，旧会话需要重新登录。截止时间应覆盖最长 refresh token 有效期，并在切换前完成一次 dry-run：

```bash
npx tsx scripts/revoke-legacy-refresh-tokens.ts
npx tsx scripts/revoke-legacy-refresh-tokens.ts --apply
```

脚本只撤销未撤销且不是 64 位十六进制 SHA-256 的记录，不会打印 token 内容。确认旧记录数量为零后，可以移除截止兼容逻辑和对应的双读测试。
