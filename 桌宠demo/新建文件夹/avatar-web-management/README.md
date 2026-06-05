# 虚拟形象管理平台 (Virtual Avatar Web Management)

基于 Next.js 16 的全栈虚拟形象管理系统。

## 环境配置

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env
```

编辑 `.env` 文件，修改以下必填项：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | 服务端口 | `3000` |
| `JWT_SECRET` | JWT 签名密钥（生产环境必须修改） | `dev-secret-...` |
| `DATABASE_PATH` | SQLite 数据库文件路径 | `database/data.db` |

> **安全警告**：生产环境必须设置强随机的 `JWT_SECRET`，否则服务将拒绝启动。

### 2. 初始化数据库

数据库会在首次访问 API 时自动迁移并写入种子数据，无需手动操作。

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

### 4. 测试账号

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

```bash
npm run build
npm start
```

详细部署文档见 [Next.js 官方文档](https://nextjs.org/docs/app/building-your-application/deploying)。
