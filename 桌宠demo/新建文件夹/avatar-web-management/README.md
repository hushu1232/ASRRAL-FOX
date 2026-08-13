# 虚拟形象管理平台 (Virtual Avatar Web Management)

基于 Next.js 16 的全栈虚拟形象管理系统。

## 环境配置

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env
```

编辑 `.env` 文件，至少修改以下必填项：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 本机开发使用指向 `localhost:5432` 的 PostgreSQL URL |
| `POSTGRES_PASSWORD` | Compose PostgreSQL 密码，须与 `DATABASE_URL` 中密码一致 |
| `JWT_SECRET` | 仅供开发 HS256 使用；生产应配置 RSA 密钥 |

> 不要提交 `.env`、数据库文件或私钥。生产环境只有当前置代理会覆盖客户端转发头、并注入与 `TRUST_PROXY_SECRET` 匹配的 `x-foxd-proxy-token` 时，才设置 `TRUST_PROXY_HEADERS=true`；否则 API 会安全地返回 503。

### 2. 初始化数据库

本机开发先启动 PostgreSQL，再执行 Prisma migration：

```bash
docker compose up -d postgres
npm run prisma:migrate:deploy
```

种子数据不会在生产环境自动写入。如需本地演示账号，显式执行：

```bash
npm run prisma:seed
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

### 4. 本地演示账号

仅在显式运行 `npm run prisma:seed` 后可用：

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 超级管理员 | admin@example.com | admin123 |
| 设计师 | designer@example.com | demo1234 |
| 普通用户 | demo@example.com | demo1234 |

## 运行测试

```bash
npm test          # 运行所有测试
npm run test:watch  # 监视模式
```

## 部署

Compose 会等待 PostgreSQL 健康检查，运行 `prisma migrate deploy`，成功后再启动应用；Prisma migrations 是唯一的生产数据库结构来源。

```bash
cp .env.example .env
# 修改 .env 中的所有占位值后（包括 PostgreSQL、Keycloak 与 MinIO 密码）：
docker compose up -d --build
```

非 Compose 部署必须先运行 `npm run prisma:migrate:deploy`，再执行：

```bash
npm run build
npm start
```
