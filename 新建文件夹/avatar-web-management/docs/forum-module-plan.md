# 社区论坛模块 — Phase 1 技术任务规划

> 基于方案 B：`/community` 独立模块 + 商品详情页嵌入"相关讨论"
> Phase 1: 社区核心（6天） | Phase 2: 即时通讯（8天，后续）

---

## 架构总览

```
/community                    → 版块列表 + 热门帖子
/community/[boardSlug]        → 版块详情 + 帖子列表
/community/[boardSlug]/new    → 发帖编辑器
/community/[boardSlug]/[postId] → 帖子详情 + 嵌套回复
```

### 数据模型

```
Board ──< Post ──< Reply (自引用嵌套)
  │         │         │
  │         │         └── Vote (targetType: "reply")
  │         └── Vote (targetType: "post")
  └── Subscription (targetType: "board")

Post ── Subscription (targetType: "post")
```

### Prisma 新增模型

| 模型 | 表名 | 用途 |
|------|------|------|
| `Board` | `community_boards` | 版块（discussion/qa/official） |
| `Post` | `community_posts` | 帖子（discussion/qa） |
| `Reply` | `community_replies` | 回复（自引用嵌套，Q&A 采纳标记） |
| `Vote` | `community_votes` | 点赞/踩（targetType + targetId 多态） |
| `Subscription` | `community_subscriptions` | 关注版块/帖子 |

---

## 实施步骤

### T1: Prisma Schema + 数据库迁移 (0.5天)

**文件**: `prisma/schema.prisma` — 新增 5 个模型

<details>
<summary>展开 Prisma Schema 代码</summary>

```prisma
model Board {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  description String?
  type        String   @default("discussion") // discussion | qa | official
  sortOrder   Int      @default(0)
  icon        String?
  color       String?
  postCount   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  posts         Post[]
  subscriptions Subscription[]

  @@map("community_boards")
}

model Post {
  id          String   @id @default(uuid())
  boardId     String   @map("board_id")
  userId      String   @map("user_id")
  title       String
  content     String   // Markdown
  type        String   @default("discussion") // discussion | qa
  isPinned    Boolean  @default(false) @map("is_pinned")
  isLocked    Boolean  @default(false) @map("is_locked")
  viewCount   Int      @default(0) @map("view_count")
  replyCount  Int      @default(0) @map("reply_count")
  voteScore   Int      @default(0) @map("vote_score")
  tags        String   @default("[]")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  board         Board          @relation(fields: [boardId], references: [id], onDelete: Cascade)
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  replies       Reply[]
  votes         Vote[]
  subscriptions Subscription[]

  @@index([boardId])
  @@index([userId])
  @@index([createdAt])
  @@index([voteScore])
  @@map("community_posts")
}

model Reply {
  id         String   @id @default(uuid())
  postId     String   @map("post_id")
  userId     String   @map("user_id")
  parentId   String?  @map("parent_id")
  content    String
  voteScore  Int      @default(0) @map("vote_score")
  isAccepted Boolean  @default(false) @map("is_accepted")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  post     Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent   Reply? @relation("ReplyChain", fields: [parentId], references: [id])
  children Reply[] @relation("ReplyChain")
  votes    Vote[]

  @@index([postId])
  @@index([userId])
  @@index([parentId])
  @@map("community_replies")
}

model Vote {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  targetType String   @map("target_type") // "post" | "reply"
  targetId   String   @map("target_id")
  value      Int      // 1 = upvote, -1 = downvote
  createdAt  DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, targetType, targetId])
  @@index([targetType, targetId])
  @@map("community_votes")
}

model Subscription {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  targetType  String   @map("target_type") // "board" | "post"
  targetId    String   @map("target_id")
  notifyEmail Boolean  @default(false) @map("notify_email")
  notifySite  Boolean  @default(true) @map("notify_site")
  createdAt   DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, targetType, targetId])
  @@index([userId])
  @@map("community_subscriptions")
}
```
</details>

**操作**:
1. 追加以上模型到 `prisma/schema.prisma`
2. `npx prisma migrate dev --name add_community_forum`
3. `npx prisma generate`

**验证**: `npx prisma studio` 查看新表已创建

---

### T2: API 路由 — 版块 CRUD (0.5天)

| 文件 | 方法 | 功能 | 鉴权 |
|------|------|------|------|
| `src/app/api/community/boards/route.ts` | GET | 版块列表 | `withAuth` |
| `src/app/api/community/boards/route.ts` | POST | 创建版块 | `requireRole('admin')` |
| `src/app/api/community/boards/[id]/route.ts` | GET | 版块详情 | `withAuth` |
| `src/app/api/community/boards/[id]/route.ts` | PUT | 编辑版块 | `requireRole('admin')` |
| `src/app/api/community/boards/[id]/route.ts` | DELETE | 删除版块 | `requireRole('admin')` |

**GET /api/community/boards 返回**:
```json
{
  "success": true,
  "data": [
    { "id": "...", "name": "求助问答", "slug": "qa", "type": "qa", "icon": "QuestionCircleOutlined", "color": "#22c55e", "postCount": 42 }
  ]
}
```

---

### T3: API 路由 — 帖子 CRUD (0.5天)

| 文件 | 方法 | 功能 | 鉴权 |
|------|------|------|------|
| `src/app/api/community/boards/[id]/posts/route.ts` | GET | 版块帖子列表（分页+排序+置顶） | `withAuth` |
| `src/app/api/community/boards/[id]/posts/route.ts` | POST | 发帖 | `withAuth` |
| `src/app/api/community/posts/[id]/route.ts` | GET | 帖子详情（含嵌套回复树） | `withAuth` |
| `src/app/api/community/posts/[id]/route.ts` | PUT | 编辑帖子 | `withAuth`(作者) |
| `src/app/api/community/posts/[id]/route.ts` | DELETE | 删除帖子 | `withAuth`(作者/admin) |

**排序参数**: `sort=latest|hot|top`  
**分页**: `page + pageSize`（复用 `paginated()` 模式）

**GET /api/community/posts/[id] 返回**（含嵌套回复）:
```json
{
  "success": true,
  "data": {
    "post": { "id": "...", "title": "...", "content": "...", "voteScore": 5, ... },
    "replies": [
      { "id": "...", "content": "...", "children": [
        { "id": "...", "content": "...", "children": [] }
      ]}
    ]
  }
}
```

---

### T4: API 路由 — 回复 + 嵌套 (0.5天)

| 文件 | 方法 | 功能 | 鉴权 |
|------|------|------|------|
| `src/app/api/community/posts/[id]/replies/route.ts` | POST | 回复帖子/楼中楼 | `withAuth` |
| `src/app/api/community/replies/[id]/route.ts` | PUT | 编辑回复 | `withAuth`(作者) |
| `src/app/api/community/replies/[id]/route.ts` | DELETE | 删除回复 | `withAuth`(作者/admin) |

**POST body**:
```json
{ "content": "markdown内容", "parentId": null }  // null=顶层回复, string=回复某条回复
```

**嵌套实现**：存入 parentId，查询时用递归 CTE 或应用层构建树。帖子详情接口一次性返回 2 层嵌套树，更深层级按需加载（点击"展开更多回复"）。

---

### T5: API 路由 — 投票系统 (0.25天)

| 文件 | 方法 | 功能 | 鉴权 |
|------|------|------|------|
| `src/app/api/community/votes/route.ts` | POST | 点赞/踩/取消 | `withAuth` |

**POST body**:
```json
{ "targetType": "post", "targetId": "...", "value": 1 }  // 1=赞, -1=踩, 再次相同值=取消
```

**逻辑**：
- `@@unique([userId, targetType, targetId])` 确保每人每帖/每回复只有一票
- 再次 POST 相同 value → 删除 vote（取消）
- 再次 POST 不同 value → 更新 vote（切换赞/踩）
- 更新 Post/Reply 的 `voteScore` 缓存字段（加减计数）

---

### T6: API 路由 — 关注/订阅 (0.25天)

| 文件 | 方法 | 功能 | 鉴权 |
|------|------|------|------|
| `src/app/api/community/subscriptions/route.ts` | GET | 我的订阅列表 | `withAuth` |
| `src/app/api/community/subscriptions/route.ts` | POST | 关注版块/帖子 | `withAuth` |

**POST body**:
```json
{ "targetType": "board", "targetId": "...", "notifySite": true }
```

---

### T7: API 路由 — Q&A 采纳答案 (0.25天)

| 文件 | 方法 | 功能 | 鉴权 |
|------|------|------|------|
| `src/app/api/community/posts/[id]/accept/route.ts` | PUT | 采纳回答 | `withAuth`(帖主/admin) |

**PUT body**:
```json
{ "replyId": "..." }
```

**逻辑**: 将指定 reply 的 `isAccepted` 设为 true，同时将同一 post 下的其他 reply 设为 false。

---

### T8: 前端页面 — 社区首页 (0.5天)

**文件**: `src/app/(auth)/community/page.tsx`

**内容**:
- 版块卡片网格（按 sortOrder 排列，显示 name/description/icon/postCount）
- Q&A 版块卡片用特殊颜色标识
- 右侧栏：全站热帖 Top 10（按 voteScore 排序）
- 各版块最新帖子预览（每个版块显示 3 条）

---

### T9: 前端页面 — 版块帖子列表 (0.5天)

**文件**: `src/app/(auth)/community/[boardSlug]/page.tsx`

**内容**:
- 顶部：版块名称 + 描述 + 关注按钮
- 排序切换：最新/热门/本周最佳
- 帖子列表：标题、作者、时间、回复数、点赞数、标签
- 置顶帖特殊样式（图钉图标 + 浅色背景）
- Q&A 帖显示"未解决"/"已解决"状态标签
- 底部：分页 + 发帖按钮（FAB）

---

### T10: 前端页面 — 帖子详情 + 回复 (1天)

**文件**: `src/app/(auth)/community/[boardSlug]/[postId]/page.tsx`

**内容**:
- 顶部面包屑：社区 > 版块名 > 帖子标题
- 帖子正文（Markdown 渲染，使用 `react-markdown` 或简单解析）
- 作者信息栏（头像、用户名、角色标签、发帖时间）
- 点赞/踩按钮（实心=已投，空心=未投）
- 关注帖子按钮
- 标签展示
- 回复区：
  - 嵌套回复树（2层展示，第3层+折叠用"查看更多回复"展开）
  - 每条回复：作者、时间、点赞/踩、回复按钮
  - Q&A 答案高亮（绿色边框 + "已采纳"徽章）
- 底部：回复编辑器（Markdown textarea + 预览）
- 帖子锁定后隐藏回复编辑器

---

### T11: 前端页面 — 发帖编辑器 (0.5天)

**文件**: `src/app/(auth)/community/[boardSlug]/new/page.tsx`

**内容**:
- 标题输入框
- 标签输入（Tag mode multiple Select）
- Markdown 编辑器（简单 textarea + 实时预览 tab）
- 帖子类型选择（讨论/问答，仅普通版块可切换）
- 提交按钮
- 版块信息提示（发帖须知）

---

### T12: 前端组件 (0.5天)

| 组件 | 文件 | 用途 |
|------|------|------|
| `PostCard` | `src/components/community/PostCard.tsx` | 帖子列表卡片 |
| `PostEditor` | `src/components/community/PostEditor.tsx` | 发帖/回复编辑器（Markdown + 预览） |
| `ReplyThread` | `src/components/community/ReplyThread.tsx` | 嵌套回复树递归渲染 |
| `VoteButtons` | `src/components/community/VoteButtons.tsx` | 点赞/踩按钮组（带状态） |
| `BoardCard` | `src/components/community/BoardCard.tsx` | 版块卡片 |
| `QABadge` | `src/components/community/QABadge.tsx` | Q&A 采纳徽章 |

---

### T13: 市场集成 — 商品关联讨论 (0.5天)

**修改文件**: `src/app/(auth)/marketplace/[id]/page.tsx`

**新增逻辑**:
1. 在商品详情页评价区下方新增 Tab："讨论 (N)"
2. 点击展示该商品关联的社区帖子列表（通过 tag 匹配）
3. 发帖时自动关联商品 tag（如 `item_<marketItemId>`）
4. 帖子卡片中显示关联商品链接

**API 扩展**:
- 修改 `GET /api/community/boards/[id]/posts` 支持 `tag` 查询参数

---

### T14: i18n 国际化 (0.25天)

**文件修改**: `messages/zh-CN.json`, `messages/en.json`, `messages/ja.json`

**新增 key 结构**:
```json
{
  "community": {
    "title": "社区",
    "boards": "版块",
    "latest": "最新",
    "hot": "热门",
    "top": "评分最高",
    "post": {
      "create": "发帖",
      "edit": "编辑",
      "delete": "删除",
      "pinned": "置顶",
      "locked": "已锁定",
      "reply": "回复",
      "replies": "条回复",
      "noReplies": "暂无回复",
      "submitReply": "发表回复",
      "tags": "标签",
      "views": "次浏览"
    },
    "vote": { "upvote": "赞同", "downvote": "踩" },
    "board": {
      "subscribe": "关注", "unsubscribe": "取消关注",
      "createPost": "发布新帖", "rules": "发帖须知"
    },
    "qa": {
      "unsolved": "未解决", "solved": "已解决",
      "acceptAnswer": "采纳为最佳答案", "acceptedAnswer": "最佳答案"
    },
    "empty": { "noPosts": "暂无帖子，来发第一帖吧", "noBoards": "暂无版块" }
  }
}
```

---

### T15: 导航集成 + 种子数据 (0.25天)

**Sidebar 修改** (`src/components/layout/Sidebar.tsx`):
- 新增 `{ key: '/community', icon: <TeamOutlined />, label: t('community') }`
- 无角色限制，所有登录用户可见

**种子数据** (`src/lib/db/seed.ts`):
- 3 个默认版块：求助问答(qa)、晒单分享(discussion)、官方公告(official)
- 1 个示例帖子

---

### T16: 测试 (0.5天)

| 文件 | 类型 | 覆盖范围 |
|------|------|----------|
| `src/__tests__/api/community/boards.test.ts` | API 测试 | 版块 CRUD + 权限 |
| `src/__tests__/api/community/posts.test.ts` | API 测试 | 帖子 CRUD + 分页 + 排序 |
| `src/__tests__/api/community/votes.test.ts` | API 测试 | 投票切换逻辑 |
| `src/components/__tests__/VoteButtons.test.tsx` | 组件测试 | 赞/踩/取消渲染 |
| `src/components/__tests__/ReplyThread.test.tsx` | 组件测试 | 嵌套回复树渲染 |
| `src/components/__tests__/PostCard.test.tsx` | 组件测试 | 卡片元素渲染 |

---

## 进度 (2026-05-29)

| 任务 | 状态 |
|------|------|
| T1: Schema + Migration | ✅ |
| T2: Boards CRUD API | ✅ |
| T3: Posts CRUD API | ✅ |
| T4: Replies API | ✅ |
| T5: Votes API | ✅ |
| T6: Subscriptions API | ✅ |
| T7: Q&A Accept API | ✅ |
| T8: Community Home | ✅ |
| T9: Board Posts List | ✅ |
| T10: Post Detail | ✅ |
| T11: Post Editor | ✅ |
| T12: Components | ✅ |
| T13: Marketplace Integration | ✅ |
| T14: i18n | ✅ |
| T15: Navigation + Seed | ✅ |
| T16: Tests | ✅ |

---

## 执行顺序

```
T1 (Schema) → T2 (Boards API) → T3 (Posts API) → T4 (Replies API)
                                              ↓
T5 (Votes API) ← T6 (Subscriptions API) ← T7 (Q&A Accept API)
                                              ↓
T8 (社区首页) → T9 (版块列表) → T10 (帖子详情) → T11 (发帖)
                                              ↓
T12 (组件抽离) → T13 (市场集成) → T14 (i18n) → T15 (导航+种子)
                                              ↓
                                          T16 (测试)
```

**并行机会**: T5/T6/T7 可并行；T8/T9/T10/T11 依赖 API 完成。

---

## 工时汇总

| 任务 | 工时 |
|------|------|
| T1: Schema | 0.5d |
| T2-T7: API (6 路由) | 2.5d |
| T8-T11: 页面 (4 页) | 2.5d |
| T12-T15: 组件+集成+i18n | 1.5d |
| T16: 测试 | 0.5d |
| **合计** | **7d** |

---

## 验证清单

- [x] `npx prisma migrate dev` 创建 5 张新表
- [x] GET /api/community/boards 返回版块列表
- [x] POST /api/community/boards 仅 admin 可创建
- [x] GET /api/community/boards/[id]/posts 支持分页+排序+标签过滤
- [x] POST /api/community/boards/[id]/posts 发帖成功
- [x] GET /api/community/posts/[id] 返回帖子+嵌套回复树
- [x] POST /api/community/posts/[id]/replies 支持 parentId 嵌套
- [x] POST /api/community/votes 赞→取消→切换踩 逻辑正确
- [x] POST /api/community/subscriptions 关注/取消关注
- [x] PUT /api/community/posts/[id]/accept Q&A 采纳答案
- [x] /community 页面 版块卡片 + 热门帖子渲染
- [x] /community/[boardSlug] 帖子列表分页+排序
- [x] /community/[boardSlug]/[postId] 嵌套回复展示
- [x] /community/[boardSlug]/new 发帖成功跳转
- [x] 商品详情页出现"讨论"关联区域
- [x] 所有中文/英文/日文 i18n key 生效
- [x] 257 个已有测试持续通过
- [x] 新增测试覆盖核心逻辑 (reply tree + vote logic, 17 tests)
