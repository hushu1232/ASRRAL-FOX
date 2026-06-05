# Avatar Web Management — 后端基础设施搭建日志

日期: 2026-05-25 ~ 2026-05-26

## 概述

在虚拟形象 Web 管理端（Next.js 16 全栈项目）上完成了后端安全升级、测试框架搭建、以及分块上传功能实现。

---

## P3-2: JWT RS256 非对称加密迁移

### 背景
原有 JWT 使用 HS256 对称算法，密钥分散在环境变量中，不符合企业级安全标准。迁移至 RS256 支持密钥轮换和 JWKS 端点。

### 实现

**`src/lib/auth/keys.ts`**
- RSA 密钥管理：文件系统加载 → 环境变量回退 → 内存缓存 三级查找
- `generateRsaKeyPair()` 通过 Node.js crypto 生成 RSA-2048 密钥对
- `exportJwk()` 导出 JWK 格式公钥（含 kid）
- `computeJwkThumbprint()` 计算 JWK 指纹

**`src/lib/auth/jwt.ts`**
- 自动协商 RS256 / HS256 算法
- `signAccessToken()` 优先 RSA 私钥，回退 HMAC-SHA256
- `verifyAccessToken()` 双算法尝试验证（兼容历史 token）

**`scripts/generate-keys.mjs`**
- 一键生成脚本：`node scripts/generate-keys.mjs` → `keys/private.pem` + `keys/public.pem` + `keys/kid`

**`src/app/.well-known/jwks.json/route.ts`**
- 公开 JWKS 端点，返回 RSA 公钥
- RS256 未配置时返回 404
- Cache-Control: public, max-age=3600

---

## 测试框架搭建

### 配置

| 项目 | 选型 |
|------|------|
| 测试框架 | Jest 30 + ts-jest |
| 组件测试 | @testing-library/react 16 + jest-environment-jsdom |
| 断言扩展 | @testing-library/jest-dom |
| API 测试 | supertest 7 |
| E2E 测试 | @playwright/test 1.60 |

### 测试套件（156 tests · 14 suites · 全部通过）

#### Unit Tests（后端模块）

| 文件 | 测试数 | 覆盖范围 |
|------|--------|---------|
| `tests/unit/jwt.test.ts` | 12 | RS256 签名/验证/防篡改/HS256 回退/密钥管理 |
| `tests/unit/roles.test.ts` | 15 | hasRole/isAdmin/isSuperAdmin/canManageUsers/canReview/边界 |
| `tests/unit/errors.test.ts` | 13 | AppError 及其子类 / 继承链 / 序列化 |
| `tests/unit/validators.test.ts` | 30+ | Zod schema: login/register/avatar CRUD/version/profile |
| `tests/unit/part-rules.test.ts` | 14 | 互斥/依赖/多重规则/边界 |
| `tests/unit/pkce.test.ts` | 6 | seal/unseal 往返/防篡改/IV 随机化 |
| `tests/unit/password.test.ts` | 7 | Argon2id hash/verify/unicode/畸形 hash |
| `tests/unit/chunked-upload.test.ts` | 12 | 会话创建/分块追踪/唯一性/清理 |
| `tests/unit/storage-chunked.test.ts` | 9 | 本地存储: 分块上传/合并/缺少分块错误/取消/大数据量 |

#### Component Tests（React 组件）

| 文件 | 测试数 | 覆盖范围 |
|------|--------|---------|
| `src/components/__tests__/EditorToolbar.test.tsx` | 7 | 工具栏渲染/撤销重做/保存/导出/发布/状态 |
| `src/components/__tests__/LoginForm.test.tsx` | 4 | 表单渲染/SSO/登录按钮/注册链接 |

### 踩坑记录

1. **`window.matchMedia` 缺失** — Antd v6 responsiveObserver 调用 `window.matchMedia()`，jsdom 无此 API。在 `jest.setup.ts` 中通过 `setupFilesAfterEnv` 添加 polyfill。

2. **`MessageChannel` 缺失** — `@rc-component/form` 使用 `MessageChannel` 做异步通知，jsdom 未提供。从 Node.js globalThis 桥接。

3. **Antd v6 cssinjs 与 jsdom 冲突** — cssinjs 注入的 CSS 类名包含 nwsapi 无法解析的选择器，导致 `getAllByRole` 崩溃。改用 text-based 查询。

4. **Jest 30 配置变更** — `--testPathPattern` → `--testPathPatterns`，`setupTestFrameworkScriptFile` → `setupFilesAfterEnv`。

5. **React 19 AggregateError** — `console.error` 在 `act()` 内的调用被 React 收集为 AggregateError 抛出。需要 mock 掉 `next/image` 的 `unoptimized` prop 避免 DOM 警告。

---

## 分块上传（Chunked Upload）

### 新增 API 端点

| 方法 | 路径 | 作用 |
|------|------|------|
| POST | `/api/assets/upload/init` | 初始化分块上传，返回 uploadId + chunkSize + totalChunks |
| POST | `/api/assets/upload/[uploadId]/chunk` | 上传单个分块（multipart），校验索引和大小 |
| POST | `/api/assets/upload/[uploadId]/complete` | 合并分块 → 写入数据库 → 异步入队处理 |
| GET | `/api/assets/upload/[uploadId]` | 查询上传进度、缺失分块列表（断点续传） |
| DELETE | `/api/assets/upload/[uploadId]` | 中止上传并清理临时文件 |

### 存储层

**`src/lib/storage/types.ts`**
- `StorageAdapter` 接口新增 5 个可选方法：`initChunkedUpload` / `uploadChunk` / `assembleChunks` / `abortChunkedUpload` / `getUploadedChunks`
- 新增 `ChunkedUploadSession` 接口

**`src/lib/storage/fs.ts`** — 本地文件系统适配器
- 分块存储至 `.chunks/<uploadId>/chunk_XXXXXX`
- 合并时先验证所有分块存在，再 `Buffer.concat` + `writeFileSync` 原子写入
- 构造函数支持 `baseDir` 参数（便于测试）

**`src/lib/storage/minio.ts`** — MinIO/S3 适配器
- 使用 `CopySourceOptions` / `CopyDestinationOptions` 实例
- `composeObject` 服务端合并（最多 32 个源对象/批次）
- 超过 32 分块时多步合并：temp_merge → copyObject → 清理

**`src/lib/storage/chunked-upload.ts`** — 会话管理器
- 内存 Map 存储会话状态（uploadId → ChunkedUploadSession）
- 支持分块去重、进度追踪、24h TTL 自动清理

---

## 文件变更清单

### 新增文件 (11)
```
src/lib/auth/keys.ts                      — RSA 密钥管理
src/lib/storage/chunked-upload.ts          — 分块上传会话管理
src/app/.well-known/jwks.json/route.ts     — JWKS 端点
src/app/api/assets/upload/init/route.ts    — 上传初始化
src/app/api/assets/upload/[uploadId]/chunk/route.ts      — 分块上传
src/app/api/assets/upload/[uploadId]/complete/route.ts   — 分块合并
src/app/api/assets/upload/[uploadId]/route.ts            — 状态/取消
scripts/generate-keys.mjs                  — 密钥生成脚本
tests/unit/chunked-upload.test.ts          — 会话管理测试
tests/unit/storage-chunked.test.ts         — 存储适配器分块测试
tests/test-utils.tsx                       — 组件测试工具
```

### 修改文件 (9)
```
jest.config.js                    — setupFilesAfterEnv 配置
tests/jest.setup.ts               — jsdom polyfill (matchMedia/MessageChannel)
src/lib/auth/jwt.ts               — RS256/HS256 自动协商
src/lib/storage/types.ts          — 分块上传接口
src/lib/storage/fs.ts             — 本地存储分块实现
src/lib/storage/minio.ts          — MinIO 分块实现
src/lib/storage/index.ts          — 类型导出
src/components/__tests__/LoginForm.test.tsx   — 组件测试
src/components/__tests__/EditorToolbar.test.tsx — 组件测试
```

---

## 当前测试统计

```
Test Suites: 14 passed, 14 total
Tests:       156 passed, 156 total
```

---

## 下一步

按优先级排序：

1. **WebSocket 实时预览** — 编辑器 3D 场景与服务器双向同步
2. **4K 截图服务** — 服务端渲染高分辨率缩略图
3. **200+ Blendshape 扩展** — morph target 定义扩充
4. **CI/CD** — GitHub Actions 自动化测试 + 部署
5. **VRM 导出完善** — 表情/物理/SpringBone 全量支持
