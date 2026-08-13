# 虚拟形象管理平台测试与发布基线

> 更新日期：2026-08-08
> 适用版本：当前工作区验收改进轮次
> 结论：开发验收通过；生产验收暂不通过

详细问题、改进清单和生产放行条件见 [`docs/avatar-web-management-acceptance-2026-08-06.md`](../../../docs/avatar-web-management-acceptance-2026-08-06.md)。本文件只记录可复核的命令结果，不作为“已生产就绪”的替代证明。

## 当前验证结果

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| `npm test` | 通过 | 117 suites、1086 tests |
| `npm run test:contracts` | 通过 | 9 suites、69 tests |
| `npm run typecheck` | 通过 | `tsc --noEmit` |
| `npm run lint` / `npm run lint:ci` | 通过但有警告 | 普通 lint 退出码 0；CI lint 以 25 条为上限，当前 21 warnings、0 errors（均为 React effect） |
| `npm run test:ci:unit` | 通过 | 117 suites、1086 tests；Statements 66.72%、Branches 57.21%、Functions 60.19%、Lines 68.66% |
| `docker compose config --quiet` | 通过 | 注入占位密码后配置可解析；缺少必填密码时会按设计拒绝启动 |
| `npm run build` | 通过 | 完成编译、类型检查和静态页面生成 |
| `npx playwright test --list` | 通过 | 发现 532 个 E2E 测试；仅验证发现，不代表已执行 |
| `git diff --check` | 通过 | 无空白错误；存在既有换行格式提示 |
| `npm audit --production --audit-level=critical --offline` | 通过 | 本地缓存返回 0 个漏洞；线上 CI 仍需使用官方源复核 |

## 已覆盖的关键回归

- 存储 key 的绝对路径、`..` 和分块上传路径穿越。
- 资产代理只能读取存储根目录内的本地文件。
- 未信任代理头时，伪造 IP 不能绕过限流或 CSRF。
- Refresh token 只保存 SHA-256 摘要。
- 认证异常对客户端返回通用错误；未知角色拒绝访问。
- 缺少 revalidate 密钥时接口拒绝执行。
- 头像列表、头像详情和头像编辑页面的保存闭环。
- 桌宠 SSE `done`/`error` 流结束、超时取消和及时恢复状态。
- PetConfig 读取、更新和绑定均校验 workspace 边界。
- Web Vitals、token storage、Cookie Consent 的最小行为回归。

## 未完成的发布门禁

以下项目仍阻止生产放行：

1. CI 已配置 API + 头像编辑核心 E2E，但尚未在远端 CI 执行确认。
2. lint 已从历史 245 条降至 23 条；CI 已设置 25 条上限，剩余 React effect 和图片性能提示按收益处理。
3. 依赖审计已在本地离线缓存通过，仍需线上 CI 用官方源复核。
4. 生产数据迁移、备份、回滚和真实对象存储策略仍需在目标环境演练。

已知测试噪音：ChatPanel 中 antd 自动高度 TextArea 在 jsdom 下会输出一次 `NaN` 样式警告，不影响浏览器运行或测试结果。

## 复核方式

在项目目录执行：

```bash
npm ci
npm test
npm run test:contracts
npm run typecheck
npm run lint:ci
npm run build
docker compose config --quiet
```

只有当验收文档中的完成定义全部满足，才可将结论改为“生产验收通过”。
