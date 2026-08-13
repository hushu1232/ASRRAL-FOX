# Avatar Web Management 网站验收与改进清单

- 验收日期：2026-08-06
- 最近更新：2026-08-12
- 验收对象：`桌宠demo/新建文件夹/avatar-web-management`
- 验收结论：**生产验收不通过；内部开发演示可用**
- 判定原因：代码级 P0 已完成修复，但远端 CI、官方依赖审计和真实生产演练尚未完成，不能据此放行生产。

## 1. 项目现状

项目已具备较完整的管理站外壳和较大的功能范围：约 1015 个受跟踪文件、43,781 行 TS/TSX、34 个页面、117 个 API Route、60 个运行依赖、46 个开发依赖和 38 条 npm script。认证、角色权限、头像、资产、市场、桌宠、管理台及测试体系已有较多实现。

当前主要问题不是“功能太少”，而是范围扩张快于核心流程收口；即使代码级安全边界和头像编辑闭环已经修复，也不能以页面数量或测试数量替代真实部署证据。

## 2. 生产阻断项（P0，第一轮已修复）

以下条目记录初始验收证据；代码和聚焦回归测试已完成修复，但仍应在目标部署环境复核。

### P0-1 本地存储存在路径穿越风险

- `src/lib/storage/fs.ts` 的 key 规范化仅移除 `/uploads/` 前缀，未拒绝绝对路径、盘符、空段或 `..`。
- 上传、删除、存在性检查和分块合并均依赖该 key，可越出上传根目录。
- `src/app/api/assets/proxy/route.ts` 直接接收用户提供的 key，并对本地文件 URL 使用 `path.resolve`，既可能读错目录，也缺少“必须位于上传根目录内”的约束。

验收要求：在共享存储边界统一验证 key；覆盖读取、写入、删除、exists、分块合并的穿越测试；代理路由必须复用存储层的安全语义。

### P0-2 可伪造客户端 IP 绕过限流和 CSRF

- `src/proxy.ts` 无条件信任 `x-forwarded-for` 第一项和 `x-real-ip`。
- 请求无 IP 头时默认 `127.0.0.1`。
- 本地 IP 可跳过限流和 CSRF，攻击者可通过请求头伪造本地来源。

验收要求：CSRF 不得因客户端可控 IP 头而跳过；无可信来源时必须 fail closed；不要为未确认需求引入复杂代理框架。

### P0-3 Refresh token 以明文写入 tokenHash

- `src/lib/auth/jwt.ts` 将原始 refresh token 存入名为 `tokenHash` 的字段，并使用原 token 查询。

验收要求：使用 Node 标准库 SHA-256 摘要后再保存和查询。允许现有 refresh token 统一失效，作为安全轮换；不需要数据库迁移。

### P0-4 认证异常细节泄露

- `src/lib/auth/middleware.ts` 将异常的 `message` 和 `name` 原样返回客户端。
- `requireRole` 对未知角色隐式给最低等级，安全语义不够明确。

验收要求：客户端仅返回稳定通用错误；详细异常只记服务端日志；未知角色 fail closed。

### P0-5 Revalidate 使用生产默认密钥

- `src/app/api/revalidate/route.ts` 在环境变量缺失时回退到 `dev-secret`。

验收要求：生产环境没有显式密钥时拒绝处理；若确认无调用方则删除该接口。

### P0-6 Docker 与数据库配置不可直接生产运行

- Prisma 使用 PostgreSQL，Compose 应用却只设置 SQLite 风格的 `DATABASE_PATH`。
- Prisma 默认 `localhost:5432` 在应用容器中不会指向 Compose 的 `postgres` 服务。
- Dockerfile 未明确 migration/seed 策略。
- Compose 手写 `database/schema.pg.sql`，与 Prisma migrations 形成双轨 schema 来源。
- README 仍以 SQLite 为主；`.env.example` 被 `.env*` 规则忽略，无法随仓库交付。

验收要求：以 Prisma migrations 为唯一 schema 来源；Compose 显式提供指向 `postgres:5432` 的 `DATABASE_URL`；README、`.env.example`、Docker 配置一致；生产部署不得自动写入测试账号。

### P0-7 头像编辑主流程断裂

- 实际只有头像列表页与详情页，没有 `/avatars/[id]/edit` 页面。
- 列表页和详情页多个按钮均跳转到不存在的编辑路由。
- 创建失败/特殊分支还会跳转到 `/avatars/new/edit`。

验收要求：复用现有表单、store 和 API 形成真实编辑闭环；若无法提供编辑能力，应删除虚假编辑入口，不接受只加重定向掩盖 404。

## 3. 高优先级体验和质量问题（P1）

- [x] 修复市场卡片对比度不足。
- [x] 市场 API 请求失败不再伪装成“暂无商品”，错误态和空态已分离。
- [x] 卖家跳转改为可键盘操作的链接。
- [x] 删除管理台空的 `config` tab。
- [x] 头像列表“复制”按钮执行真实复制动作。
- [x] 正常桌宠页面不再展示开发用 WebBridge mock 状态面板。
- [x] lint 退出 0；本轮移除剩余 effect 数据镜像和资源生命周期 warning，完整门禁结果见最终验证基线。
- [x] Jest 未关闭句柄和主要异步 `act` 问题已修复；当前只剩 antd/jsdom 的 `NaN` 样式警告。
- [ ] 线上依赖漏洞审计仍需由 CI 官方源确认；本地离线审计已返回 0 个漏洞。

## 4. 不合理的工程安排

1. **先扩展外围功能，后补核心闭环。** 社区、消息、通知、OAuth、AI、支付等范围先于头像创建—编辑—资产绑定—预览主链展开；主链 404 已修复，但这种排期顺序不应重复。
2. **数据库曾存在双轨事实来源。** Prisma migrations 与手写 PostgreSQL schema 并行维护容易产生不可追踪的环境差异；现已统一为 Prisma migrations。
3. **开发便利曾绕过生产安全边界。** 本地 IP 豁免、默认 revalidate 密钥和明文 refresh token 已移除；后续开发开关不得进入生产信任路径。
4. **测试数量替代了发布门禁。** 单测数量较多，但远程 CI 核心 E2E 尚未执行确认，不能把测试数量当作发布证明。
5. **监控与集成范围过宽。** 在核心流程未收口时并行维护 OTel、Prometheus、Sentry、Keycloak 等体系，维护成本高于当前收益。
6. **生产与演示数据策略混杂。** migration、seed、测试账号和受跟踪数据库文件之间缺少清晰边界。

## 5. 不需要或应后置的功能

### 立即删除或隐藏

- [x] 隐藏生产桌宠页面中的 `WebBridgeMockStatusPanel`。
- [x] 删除管理台空的 `config` tab。
- [x] 将没有真实动作的“复制”按钮改为复制真实链接。
- [ ] 无真实调用方的 revalidate webhook；目前先保留 fail-closed 实现。
- [ ] 受 Git 跟踪的开发数据库文件；删除前先确认不含需保留数据并评估历史泄露。
- [x] 删除未使用的 `@prisma/adapter-better-sqlite3`，保留仍被兼容层使用的 `better-sqlite3`。
- [ ] 在依赖本身已带类型时冗余的 `@types/uuid`、`@types/dompurify`。
- [x] 删除无生产调用方的 `SearchModal` 及其重复测试；Header 统一使用功能更完整的 `CommandPalette`。

### MVP 后置

- 社区、私信、通知。
- OAuth Provider、API Docs、API Keys、Keycloak。
- AI Rigging。
- 语音克隆和 TTS 训练。
- 多支付渠道、提现和复杂财务体系。
- EXP、等级、称号和实验平台。
- OTel、Prometheus、Sentry 三套完整观测体系并行建设。

### MVP 保留

- Auth 与 RBAC。
- 头像 CRUD 和真实编辑。
- 资产上传、管理和绑定。
- 桌宠配置与预览。
- 基础市场浏览、发布和下载。
- WebBridge 包与真实只读同步状态。
- 最小用户和商品审核能力。

范围决定：支付页面暂不直接删除，作为简历演示的降级候选保留；不继续增加支付渠道、结算、对账或财务后台。AIRI 集成继续保持独立路线，本轮不改 AIRI 页面、模型适配和相关测试。

## 6. 分阶段改进清单

### 第一批：安全根因修复

- [x] 共享存储层拒绝路径穿越和绝对路径。
- [x] 修复资产代理的本地文件路径语义。
- [x] 移除基于可伪造 IP 的限流和 CSRF 豁免。
- [x] refresh token 改为 SHA-256 摘要存储与查询。
- [x] 认证异常响应改为通用错误，未知角色 fail closed。
- [x] revalidate 密钥在生产环境 fail closed，或在无消费者时删除路由。
- [x] 为上述安全路径增加聚焦回归测试。

### 第二批：部署一致性和核心闭环

- [x] 统一 README、`.env.example`、Compose、Dockerfile 和 Prisma 的 PostgreSQL 说明。
- [x] 以 Prisma migrations 为唯一生产 schema 来源。
- [x] 明确生产 migration 执行方式，禁止自动写测试 seed。
- [x] 实现真实头像编辑路由，复用现有组件和 API。
- [x] 删除失效或虚假的创建、编辑、复制入口。

### 第三批：UI 与交付质量

- [x] 修复市场卡片对比度，区分错误态、空态和加载态。
- [x] 将点击 `span` 改为可访问链接或按钮。
- [x] 修正 Rigging 页副作用和加载反馈。
- [x] 隐藏开发 mock 与空管理 tab。
- [x] 已将 lint warning 从历史 245 条降至当前 21 条。
- [x] CI 已通过 `npm run lint:ci` 固定 25 条 warning 上限，当前 21 条；Rigging 图片性能提示已清理，剩余 React effect warning 按收益处理。
- [x] 修复 Jest 未关闭句柄和主要测试异步边界；剩余 `NaN` 样式警告属于 antd/jsdom 测试环境噪音。
- [x] 单元测试 Functions 覆盖率已达到 60% 门槛（当前 60.19%）。
- [ ] CI 已配置临时 PostgreSQL、migration/seed，并计划运行 API + 头像编辑核心 E2E，仍需在真实 CI 执行确认。
- [x] 本地已取得完整生产构建产物；远端 CI 资源仍需执行确认。
- [x] 更新测试报告，改为当前验证基线并明确未完成发布门禁。

## 7. 当前验证基线

| 检查 | 结果 |
|---|---|
| `npm ci` | 通过，安装 2105 个包 |
| `npm run lint` / `npm run lint:ci` | 普通 lint 退出 0；CI lint 以 25 条为上限，当前 21 条 warning、0 error |
| `npm run typecheck` | 通过 |
| `npm test` | 117 suites、1086 tests 全部通过；仅剩 antd/jsdom `NaN` 样式警告 |
| `npm run test:contracts` | 9 suites、69 tests 全部通过 |
| unit coverage | Statements 66.72%、Branches 57.21%、Functions 60.19%、Lines 68.66%；门槛通过 |
| `next build` | 通过；编译、类型检查、113 个静态页面生成和优化均完成 |
| `npx playwright test --list` | 通过；发现 532 个 E2E 测试，但尚未执行测试本身 |
| `npm audit --production --audit-level=critical --offline` | 通过，0 个漏洞；线上 CI 仍需使用官方源复核 |

2026-08-12 本轮增量复核：`npm run typecheck` 通过；`npm run lint:ci` 为 0 error、0 warning；`npm test` 为 118 suites、1094 tests 全部通过；仍仅有已知的 antd/jsdom `NaN` 样式测试噪音。生产构建、合同测试、覆盖率和远端 CI 结果沿用上次证据，尚未在本轮重新执行，不能据此更新生产放行结论。

## 8. 完成定义

网站只有同时满足以下条件才可重新提交生产验收：

1. 所有 P0 项关闭，并有针对信任边界的可运行回归测试。
2. 头像创建、编辑、保存、资产绑定和预览形成无 404 的真实闭环。
3. Compose 可按文档从空数据库启动，migration 来源唯一，生产不自动写测试数据。
4. 类型检查、单测、合同测试、覆盖率门槛和完整生产构建全部通过。
5. 核心 E2E 在 CI 运行，测试报告由当次 CI 结果生成或更新。
6. 依赖安全审计取得明确结果，而不是将网络失败记为通过。

## 9. 实施记录

### 2026-08-06 第一轮实施

- 安全：存储路径、代理信任、refresh token、认证错误和 revalidate 默认密钥已修复，并新增回归测试。
- 核心流程：新增 `/avatars/[id]/edit`，可编辑名称、风格、基础体型和基础 Blend Shape；保存会更新头像并创建版本。
- 部署：Compose 使用 PostgreSQL 服务名和独立 migrator，删除 SQLite 配置和手写 schema 挂载；`.env.example` 已纳入交付。
- 体验：创建失败不再跳不存在的 `/avatars/new/edit`；复制按钮改为复制真实头像链接。
- 验证：`npm test`、`npm run test:contracts`、`npm run typecheck`、`npm run lint`、`docker compose config --quiet`、`npm run build` 均完成；当时 lint 统计为 245 条 warning，后续轮次已继续清理。

### 2026-08-06 第二轮实施

- Rigging：将服务健康检查从 `useState` 初始化器移到可取消的 `useEffect`，检查期间显示可访问的加载状态，避免首屏空白和副作用重复执行。
- CI：E2E job 新增临时 PostgreSQL、Prisma migration 和显式测试 seed，并把 API E2E 与头像编辑核心 E2E 纳入 Chromium 门禁；尚未在远端 CI 实际跑完，不能提前标记为通过。
- 依赖：删除未使用的 `@prisma/adapter-better-sqlite3`，并完成本地离线生产依赖审计（0 个漏洞）。

### 2026-08-06 第三轮实施

- 覆盖率：为 metrics、feature flags、Web Vitals、token storage 和 Cookie Consent 增加行为测试，单元测试 Functions 覆盖率达到 60.19%，`test:ci:unit` 现在串行执行并通过门槛。
- 测试生命周期：WebSocket 房间清理定时器可取消且 `unref`，测试连接超时定时器在连接成功/失败时清理；Jest 不再报告未关闭句柄。
- 测试异步边界：补齐 Admin/Settings 测试的 `act` 等待；审核消息改用 `App.useApp()`，消除静态 message 的上下文警告。
- 最终验证：`npm run test:ci:unit` 114 suites、1069 tests 全部通过，Functions 60.16%；`npm run build`、`npm run test:contracts` 和 `npm run typecheck` 也通过。剩余测试输出仅有 ChatPanel 在 jsdom 下的 antd `NaN` 高度警告。
- 交付文档：重写 `TEST-REPORT.md`，移除过期的“可部署”结论，改为当前可复核命令和未完成发布门禁。

### 2026-08-06 第四轮实施

- CI 发布链路：Trivy/Syft 改用与 Docker metadata 一致的短 SHA 镜像标签；Helm 自动回写提交加入 `[skip ci]`，避免 push 回写触发构建/部署循环。
- Compose 安全：Keycloak、MinIO 和其数据库密码改为必填环境变量，`.env.example` 与 README 同步说明，不再携带可直接进入生产的默认管理密码。
- 运行时质量：修复 OAuth 重定向、WebSocket 重连闭包、语音输入支持检测、语音克隆音频引用、等级配置初始化和若干未使用代码；定向 lint 无 warning，完整 lint 在该轮从 313 降至 245 条 warning（后续已降至 25 条）。

### 2026-08-06 第五轮实施

- 桌宠流式聊天：SSE `done`/`error` 事件现在立即结束请求，60 秒超时会主动取消并恢复 UI 状态；新增回归测试避免每次对话固定等待超时。
- 工作区隔离：PetConfig 的读取、更新和头像绑定均验证 workspace，跨工作区记录不会被读取或修改。
- 覆盖率：新增 Web Vitals、token storage、Cookie Consent 和离线状态订阅行为测试，`test:ci:unit` 通过 114 suites、1069 tests，Functions 60.16%。
- 当轮本地门禁：`npm run test:contracts`、`npm run typecheck`、`npm run build`、`git diff --check` 通过；Compose 在注入占位密码后可解析，缺少必填密码时按设计拒绝启动；完整 lint 退出 0，当时仍有 245 条 warning。

### 2026-08-07 第六轮实施

- 兼容性：恢复本地存储适配器公开方法的可选 MIME 参数，避免具体实现被既有调用方以完整接口参数调用时产生类型回归。
- 质量：用 `eslint --fix` 清理无效禁用注释和 `prefer-const`，为 k6 场景命名默认导出；消息页对派生消息列表使用 `useMemo`，并将请求上下文存储改为泛型类型，避免无必要的 `any`。
- 最终本地门禁：`npm run typecheck`、`npm test`（114 suites、1069 tests）、`npm run test:contracts`（9 suites、69 tests）、`npm run test:ci:unit`、`npm run build`、`npm run lint:ci`、`git diff --check` 全部通过；覆盖率为 Statements 66.57%、Branches 56.51%、Functions 60.05%、Lines 68.51%；lint 25 warnings、0 errors。

### 2026-08-07 第七轮实施

- 副作用质量：TimeAwarenessOverlay 的进入/退出动画改为可取消的双层 `requestAnimationFrame`，清理旧 RAF 与隐藏计时器，避免快速切换消息时动画状态竞态；useNetworkStatus 的首次 ping 改为提交后异步启动，并清理 bootstrap 定时器。
- 首屏加载：StatsTab 和 SecurityTab 将只读请求的 loading 状态放入初始 state，删除 effect 内同步重复赋值，避免首屏空态闪烁并减少 2 条 React effect warning。
- 最终本地门禁：`npm run typecheck`、`npm run lint:ci`、管理台/设置定向测试和 `npm run test:ci:unit` 全部通过；114 suites、1069 tests；覆盖率为 Statements 66.56%、Branches 56.51%、Functions 60.05%、Lines 68.49%；lint 23 warnings、0 errors。

剩余发布风险：CI 核心 E2E 已配置但尚未在远端执行确认；lint 仍有 21 条 React effect warning；线上官方源依赖审计待确认；生产数据迁移、备份、回滚、RSA 密钥注入和真实对象存储策略仍需在目标环境演练。因此本轮仍是“开发验收通过、生产验收暂不通过”。

### 2026-08-08 第八轮实施

- Rigging 进度页不再把 WebSocket 端口硬编码为 `3001`，现在读取已有的 `NEXT_PUBLIC_WS_PORT`，部署到非默认端口时仍能接收实时进度。
- Rigging 预览图统一使用 `next/image`，保留动态资产的 `unoptimized` 行为，清理 2 条原生 `<img>` 性能 warning。
- 新增配置端口回归测试；定向组件测试 4 个全部通过，类型检查通过。
- 当前完整本地门禁：`npm test` 与 `npm run test:ci:unit` 均为 117 suites、1086 tests；覆盖率 Statements 66.72%、Branches 57.21%、Functions 60.19%、Lines 68.66%；`npm run build` 第二次重跑通过。
- AIRI 集成暂停，不影响本轮现有网站修缮；真实 AIRI 源码获取门禁保留在独立路线文档中。

### 2026-08-12 第九轮实施

- 数据获取：管理台用户、审核、市场审核、审计、等级配置、OAuth 客户端、支付配置、卖家收款、API Key、资产库、通知和桌宠状态统一复用现有 SWR hook，不再在 effect 中复制服务端列表与加载状态。
- 请求边界：新增统一 `apiPatch`；管理操作不再手写 token、CSRF 和 PATCH 请求；资产上传复用 `apiPostFormData`，保留统一 401 刷新和鉴权行为。
- 缓存一致性：通知已读只在接口成功后更新列表和未读数；资产上传、审核、用户管理、OAuth、支付、API Key 和语音列表在成功操作后刷新对应缓存。
- 生命周期：Cookie 同意改为 SSR 安全的外部存储订阅；语音训练轮询不再重叠并阻断卸载后的迟到响应，试听 Blob URL 在停止、结束、切换和卸载时释放；Live2D 初始化支持卸载取消并释放迟到创建的 delegate。
- 桌宠配置：配置成功后才启用桌面同步和本地健康查询，保留确认阶段 8 秒轻轮询、隐藏标签页暂停、应用成功过渡提示和保存后刷新。
- 范围收口：删除无生产入口的重复 `SearchModal`；真实入口统一为 `CommandPalette`。AIRI 继续暂停；支付仅保留现有演示，不扩展复杂财务能力。

下一步按价值排序：先在远端 CI 运行 PostgreSQL 核心 E2E、正式依赖审计和生产构建；再用真实浏览器验收登录、头像编辑、资产上传绑定、桌宠配置与 WebBridge 确认链；最后补目标环境的 migration、备份、回滚、密钥注入和对象存储演练。上述证据未齐前，生产验收结论不变。
