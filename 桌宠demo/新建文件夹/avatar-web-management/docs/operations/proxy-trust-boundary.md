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
