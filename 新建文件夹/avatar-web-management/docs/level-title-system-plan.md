# 用户等级与称号系统 — 实施计划

> 基于 `星尘狐 · 用户等级与称号系统（v2.0）` 需求文档
> 实施日期: 2026-05-29

---

## 1. 代码库现状分析

| 维度 | 现状 | 需改动 |
|------|------|--------|
| User 模型 | 17 个字段，无 level/exp/bio/avatar_url | 新增 8 字段 |
| 经验值系统 | 不存在 | 全新 `src/lib/exp/` 模块 |
| 称号系统 | 不存在 | 全新 `src/lib/titles/` 模块 |
| 角色系统 | ROLE_HIERARCHY 数值层级 + withAuth/requireRole | 不变，仅扩展兼容 |
| 资料 API | PUT /api/settings/profile，bio 未写入 DB | 扩展返回 level/exp/titles |
| 管理后台 | 7 tabs，用户管理含 role/status 筛选 | 新增等级配置 tab |
| 前端 Store | authStore User 含 avatar_url 但 DB 无此列 | 新增 level/exp/title 字段 |
| i18n | 无等级相关键 | 新增 ~40 键 |

---

## 2. 架构设计

```
┌──────────────────────────────────────────────────────────────┐
│                    Level & Title System                       │
│                                                              │
│  src/lib/                                                     │
│  ├── exp/                                                     │
│  │   ├── constants.ts    # EXP 表 / 等级阈值 / 权益映射      │
│  │   ├── service.ts      # addExp / checkLevelUp / getLimits │
│  │   └── anti-abuse.ts   # 防刷校验 (Redis滑动窗口)          │
│  ├── titles/                                                  │
│  │   ├── constants.ts    # 称号定义表 (条件+图标+颜色)       │
│  │   └── service.ts      # checkAndGrantTitles / getTitles   │
│  └── constants.ts        # 新增 LEVEL_EXP_TABLE 等           │
│                                                              │
│  src/app/api/                                                 │
│  ├── user/exp/route.ts           # POST — 上报经验获取       │
│  ├── user/titles/route.ts        # GET/PUT — 称号列表/佩戴   │
│  └── admin/level-config/route.ts # GET/PUT — 动态调整阈值    │
│                                                              │
│  src/app/(auth)/settings/                                     │
│  ├── ProfileTab.tsx     # 修改 — 显示等级进度条+权益         │
│  └── TitleTab.tsx       # 新增 tab — 称号收集墙+佩戴         │
│                                                              │
│  src/app/(auth)/admin/                                        │
│  └── LevelConfigTab.tsx # 新增 — 动态配置等级阈值             │
│                                                              │
│  prisma/schema.prisma   # User 表新增 8 字段                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 数据库变更

### 3.1 User 表新增字段

```prisma
model User {
  // ... 现有字段不变 ...
  
  // 等级系统
  level             Int      @default(1)
  exp               Int      @default(0)
  totalLoginDays    Int      @default(0)   @map("total_login_days")
  lastLoginDate     DateTime?              @map("last_login_date")
  
  // 称号系统
  activeTitle       String?                @map("active_title")
  unlockedTitles    String[] @default([])  @map("unlocked_titles")
  
  // 配额追踪
  monthlyCloneUsed  Int      @default(0)   @map("monthly_clone_used")
  cloneResetDate    DateTime?              @map("clone_reset_date")
}
```

### 3.2 迁移策略

- 新增字段全部有 `@default()` 或 nullable，向后兼容
- `unlockedTitles` 使用 PostgreSQL `TEXT[]` 数组类型
- 创建 Prisma migration

---

## 4. 常量定义 (`src/lib/constants.ts` 新增)

```typescript
// 等级经验阈值
export const LEVEL_EXP_TABLE: Record<number, { exp: number; total: number }> = {
  1: { exp: 0, total: 0 },
  2: { exp: 200, total: 200 },
  3: { exp: 800, total: 1000 },
  4: { exp: 2000, total: 3000 },
  5: { exp: 6000, total: 9000 },
};

// 等级权益映射 (indexed by level)
export const LEVEL_BENEFITS = { ... };

// 经验获取途径
export const EXP_ACTIONS = { ... };
```

---

## 5. API 设计

### 5.1 `POST /api/user/exp` — 上报经验获取

- 鉴权: `withAuth`
- Body: `{ action: string, metadata?: Record<string, unknown> }`
- 逻辑: 防刷校验 → 查询 action 对应的 EXP 值 → 累加到 user.exp → 检查是否升级 → 返回 `{ gained, currentExp, level, levelUp }`

### 5.2 `GET /api/user/profile` — 获取完整用户资料

- 返回现在包含: `level, exp, nextLevelExp, activeTitle, unlockedTitles, monthlyCloneUsed, monthlyCloneLimit, assetCapacity`

### 5.3 `GET/PUT /api/user/titles` — 称号管理

- GET: 返回所有称号定义 + 用户已解锁列表
- PUT: `{ activeTitle: string | null }` 切换佩戴

### 5.4 `GET/PUT /api/admin/level-config` — 管理后台动态配置

- 存储在 Redis/DB 配置表，提供默认值回退

---

## 6. 前端组件

### 6.1 ProfileTab 修改

- 在现有 username/email/bio 表单上方增加等级卡片：
  - 等级图标 + 称号前缀 + 经验进度条
  - "当前权益" 可展开面板（声音克隆次数/资产容量/皮肤槽位）
  - "如何升级" 引导链接

### 6.2 TitleTab 新增

- 称号收集墙：已解锁 (亮色) + 未解锁 (灰色剪影 + 获取条件)
- 点击已解锁称号 → 一键佩戴
- 管理称号不可隐藏（显示但不可操作）

### 6.3 LevelConfigTab (管理后台)

- 等级阈值表格（可编辑）
- EXP 获取值表格（可编辑）
- 保存按钮

---

## 7. 任务分解

| # | 任务 | 工时 |
|---|------|:---:|
| L1 | Prisma Schema + 迁移 | 0.5h |
| L2 | 常量定义 (LEVEL_EXP_TABLE, EXP_ACTIONS, TITLES) | 0.5h |
| L3 | EXP 服务 (addExp/checkLevelUp/antiAbuse) | 1h |
| L4 | 称号服务 (checkAndGrantTitles) | 0.5h |
| L5 | API: user/profile 扩展 | 0.5h |
| L6 | API: user/exp (经验上报) | 0.5h |
| L7 | API: user/titles (称号管理) | 0.5h |
| L8 | API: admin/level-config | 0.5h |
| L9 | authStore 扩展 (level/exp/title) | 0.5h |
| L10 | ProfileTab 改造 (等级卡片+权益) | 1h |
| L11 | TitleTab 新建 (称号收集墙) | 1h |
| L12 | LevelConfigTab (管理后台) | 1h |
| L13 | i18n 三语 (级别/称号/权益 ~40键) | 0.5h |
| L14 | 单元测试 | 1h |
| **总计** | | **8.5h** |

---

## 8. 验证方案

- TypeScript 类型检查零错误
- 单元测试覆盖: EXP 计算、升级逻辑、称号解锁条件、防刷窗口
- 组件测试: ProfileTab 等级展示、TitleTab 交互
- 集成测试: POST /api/user/exp 升级流程
