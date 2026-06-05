# 虚拟形象 Web 管理系统 — 完整技术方案与界面规划

> 版本: v1.0 | 日期: 2026-05-24

---

## 1. 核心子系统架构

### 系统总览（文字架构图）

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 SPA (React)                        │
│  登录/注册 │ 工作台 │ 编辑器 │ 资产管理 │ 管理后台 │ API文档   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS / WSS (WebSocket for 实时协作)
┌──────────────────────▼──────────────────────────────────────┐
│                   API Gateway (Kong / APISIX)                │
│         认证鉴权 │ 限流 │ 路由 │ 日志 │ 跨域 │ 协议转换       │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    微服务层 (Go + Node.js)                    │
│                                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│ │ 用户账户  │ │ 形象引擎  │ │ 数字资产  │ │  形象配置定制  │   │
│ │ 权限系统  │ │ 编辑服务  │ │ 管理 DAM │ │  规则引擎     │   │
│ └──────────┘ └──────────┘ └──────────┘ └───────────────┘   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│ │ 预览渲染  │ │ 版本发布  │ │ 数据分析  │ │  系统管理监控  │   │
│ │ 服务      │ │ 管理      │ │ 运营      │ │               │   │
│ └──────────┘ └──────────┘ └──────────┘ └───────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                       数据层                                  │
│ PostgreSQL │ Redis │ Elasticsearch │ MinIO (S3) │ RabbitMQ   │
└─────────────────────────────────────────────────────────────┘
```

### 子系统 1: 用户账户与权限系统

**职责:**
- 仅支持邮箱/用户名 + 密码注册登录（Argon2id 哈希）
- 企业 SSO 集成: LDAP、OIDC (支持 Azure AD / Okta / Keycloak)
- 多角色 RBAC: `super_admin` > `admin` > `auditor` > `designer` > `user`
- 租户隔离: workspace 级别数据隔离，每 workspace 可绑定独立 SSO 配置
- 会话管理: JWT (access 15min + refresh 7d)，refresh token 轮转防重放
- 严格禁止: 手机号登录、微信/QQ/微博等社交登录按钮、短信验证码

**关键规则:**
- 注册仅需 `email` + `username` + `password`，邮箱验证后激活
- 登录表单仅展示: 邮箱输入框、密码框、SSO 跳转按钮（企业用户）
- 登录页面不出现任何"手机号"/"微信"/"QQ"/"短信验证"文字或图标

### 子系统 2: 虚拟形象创建与编辑引擎

**职责:**
- 基础模板选择（男女基础模型，写实/卡通/低多边形风格）
- 参数化捏脸: 200+ Blendshape 参数（眉骨、颧骨、下颌、鼻翼等）
- 体型调节: 身高、肩宽、腰围、四肢比例
- 部件装配: 发型、上装、下装、鞋子、配饰分层叠加
- 材质编辑: PBR 参数（albedo、roughness、metallic、normal map）
- 快照保存: 每次编辑生成不可变 snapshot，支持分支

### 子系统 3: 数字资产管理 (DAM)

**职责:**
- 文件上传: 分片上传（>100MB 自动分片），支持断点续传
- 格式支持: FBX/GLTF/GLB (模型)、PNG/HDR/EXR (贴图)、FBX/BVH (动画)、VFX Graph (特效)
- 自动处理: 上传后异步生成缩略图、计算 polycount/texture size、提取元数据
- 版本控制: 资产级版本链，支持回滚和 diff
- 版权标记: 每资产标记许可类型（CC0/CC-BY/商用许可），到期自动下线

### 子系统 4: 形象配置与定制

**职责:**
- 预设模板库: 50+ 官方预设形象，按风格分类（二次元/写实/欧美/韩系/Q版）
- 部件共存规则引擎: 定义部件互斥/依赖关系（如"长裙不能配长靴"）
- 导出配置: 生成 VRM 1.0 / GLB 导出包，或返回 CDN URL
- 外部集成: 提供 iframe embed / SDK 方式供第三方调用

### 子系统 5: 预览与实时渲染系统

**职责:**
- 基于 WebGL 2.0 的实时 3D 渲染（Three.js 或 Babylon.js）
- 支持旋转/缩放/平移画布操作
- 多光照预设: 工作室光/室外光/夜晚/自定义 HDR 环境贴图
- 高质量截图: 4K PNG 导出（离屏渲染 + MSAA）
- WebSocket 推送模型更新（编辑 → 预览实时同步）

### 子系统 6: 版本与发布管理

**职责:**
- 状态流转: `draft` → `pending_review` → `approved` / `rejected` → `published` → `archived`
- 审核机制: 自动审核（合规检查）+ 人工审核（审核员队列）
- 版本树: 支持分支（基于任意版本创建分支编辑），diff 对比
- 环境隔离: dev / staging / production 三套环境独立发布

### 子系统 7: 数据分析与运营

**职责:**
- 指标采集: 形象创建量、DAU、部件使用排行、人均编辑时长
- 漏斗分析: 注册 → 首次创建 → 首次发布 → 首次导出
- 上报方式: 前端埋点 → Kafka → ClickHouse → Grafana 看板
- 导出: CSV/Excel 报表，定时邮件周报

### 子系统 8: 系统管理与监控

**职责:**
- 操作审计日志: 谁 (who) + 何时 (when) + 做了什么 (what) + IP + User-Agent
- 配置中心: 功能开关、阈值配置、第三方 API Key 管理
- 存储监控: MinIO bucket 用量、CDN 流量/带宽、缓存命中率
- 告警: Prometheus + AlertManager，钉钉/飞书/邮件通知

---

## 2. 前端操作界面清单及页面说明

### 2.1 登录/注册页

**布局:** 居中单列卡片（max-width: 420px）

```
┌──────────────────────────────┐
│        ★ 系统 Logo            │
│   虚拟形象管理平台              │
│                              │
│  ┌────────────────────────┐  │
│  │ ✉ 邮箱地址              │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 🔒 密码            👁   │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │      登  录              │  │
│  └────────────────────────┘  │
│                              │
│    还没有账号？立即注册        │
│                              │
│  ──────── 或 ────────        │
│                              │
│  ┌────────────────────────┐  │
│  │  🏢 企业 SSO 登录        │  │  ← 仅此一个外部登录选项
│  └────────────────────────┘  │
│                              │
│  规则:                        │
│  ✓ 仅邮箱/用户名+密码         │
│  ✓ 企业 SSO (LDAP/OIDC)      │
│  ✗ 无手机号                  │
│  ✗ 无微信/QQ/社交登录         │
└──────────────────────────────┘
```

### 2.2 工作台仪表盘

**布局:** 顶栏 + 左侧导航 + 内容区

| 区域 | 组件 |
|------|------|
| 顶栏 | 搜索框、+ 新建形象、通知铃铛、头像下拉菜单 |
| 左侧 | 工作台 / 我的形象 / 资产库 / 模板市场 / 设置 / (管理员: 审核队列、系统管理) |
| 主内容区 | 4 个 KPI 卡片（总形象数/本月创建/待审核/存储用量）+ 图表区（创建趋势折线图、部件使用排行柱状图）+ 最近编辑列表（缩略图 + 名称 + 更新时间）|

### 2.3 形象管理中心

**布局:** 顶部筛选栏 + 卡片网格

- **筛选栏:** 搜索关键词、状态（草稿/已发布/审核中）、风格、创建时间范围、排序
- **卡片网格:** 每卡片显示 3D 缩略图、名称、状态标签、更新时间、右键菜单（编辑/复制/删除/导出）
- **批量操作:** 多选后支持批量删除、批量导出、批量修改标签
- **详情页:** 点击进入，展示完整元数据、版本历史、分享链接、嵌入代码

### 2.4 虚拟形象编辑器（核心页面）

**布局:** 全屏四区 + 顶栏 + 底栏

```
┌─────────────────────────────────────────────────────────────┐
│  顶栏: [返回] [形象名称] [保存(状态指示灯)] [撤销↩ 重做↪] [发布▼] │
├────────┬──────────────────────────────┬──────────────────────┤
│ 左侧   │                              │  右侧                │
│ 部件面板│       3D / 2D 预览区         │  属性面板             │
│        │                              │                      │
│ ▼ 基础  │    ┌──────────────────┐      │  当前选中: 头发_01     │
│  ·头型  │    │                  │      │  ──────────────────   │
│  ·脸型  │    │                  │      │  [颜色]  ■■□□□□      │
│  ·眼睛  │    │    WebGL Canvas  │      │  [长度]  ──●────     │
│  ·鼻子  │    │    实时 3D 渲染   │      │  [卷度]  ───●───     │
│  ·嘴巴  │    │                  │      │  [光泽]  ──●────     │
│        │    │                  │      │  ──────────────────   │
│ ▼ 发型  │    │                  │      │  光照: [工作室▼]      │
│  ·长发  │    │                  │      │  环境: [室内▼]        │
│  ·短发  │    │   旋转·缩放·平移  │      │                      │
│  ·束发  │    │   右键拖拽旋转    │      │  动画预览:            │
│        │    │   滚轮缩放       │      │  [待机][走路][招手]    │
│ ▼ 服装  │    │   中键平移       │      │                      │
│  ·上装  │    │                  │      │  截图导出:            │
│  ·下装  │    │                  │      │  [4K PNG] [VRM导出]  │
│  ·套装  │    └──────────────────┘      │                      │
│        │                              │                      │
│ ▼ 配饰  │   光照: ○○○ 工作室 室外 夜晚  │                      │
│  ·眼镜  │   背景: ○○○ 白 灰 渐变 自定义  │                      │
│  ·帽子  │                              │                      │
│  ·耳饰  │   快捷视角: [正面][侧面][背面]  │                      │
├────────┴──────────────────────────────┴──────────────────────┤
│  底栏: [待机▶] [走路▶] [跑步▶] [跳跃▶] [自定义动画…] [循环🔄]  │
└─────────────────────────────────────────────────────────────┘
```

**交互要点:**
- 左侧部件列表: 拖拽部件到预览区 → 自动装配到对应骨骼挂点
- 画布: 右键拖拽旋转、滚轮缩放、Shift+拖拽平移
- 右侧面板: 调整参数时 3D 视图实时刷新（debounce 16ms）
- 撤销/重做: Ctrl+Z / Ctrl+Shift+Z，操作栈深度 50 步
- 状态指示灯: 绿=已保存 / 黄=有未保存更改 / 红=保存失败

### 2.5 资产库/素材管理界面

**布局:** 左侧文件夹树 + 右侧网格视图

- 文件夹浏览器: 支持嵌套目录、拖拽移动
- 工具栏: 上传按钮（支持拖拽到页面）、视图切换（网格/列表）、排序
- 资产卡片: 缩略图、文件名、格式标签、大小、上传时间
- 右键菜单: 预览/编辑标签/替换文件/下载/删除/查看使用位置
- 详情侧边栏: 点击资产展开，显示元数据、使用历史、版权信息

### 2.6 模板市场/形象商店

**布局:** 顶部分类导航 + 卡片网格 + 预览浮层

- 分类: 二次元 / 写实 / 韩系 / 欧美 / Q版 / 奇幻 / 职业
- 卡片: 360度旋转预览 GIF + 名称 + 作者 + 使用次数
- 点击: 弹出预览浮层，可旋转查看模型，一键"使用此模板"
- 筛选: 免费 / 付费 / 最新 / 最热

### 2.7 个人中心/账户设置

**Tab 结构:**

| Tab | 内容 |
|-----|------|
| 基本资料 | 头像、用户名、邮箱（不可改）、个人简介 |
| 安全设置 | 修改密码、双因素认证（TOTP）、登录历史 |
| API Keys | 生成/吊销 API Key、调用限额查看 |
| 通知偏好 | 邮件/站内信开关 |
| 收藏与记录 | 收藏的形象/部件、编辑历史 |
| 企业绑定 | 绑定/解绑企业 SSO 账户 |

### 2.8 管理后台专属界面

**布局:** 左侧管理菜单 + 内容区

| 菜单项 | 功能 |
|--------|------|
| 用户管理 | 用户列表、搜索、封禁/解封、角色分配 |
| 形象审核队列 | 待审核列表、预览、通过/驳回+备注 |
| 素材审核 | 上传内容审核（自动 + 人工）|
| 系统配置 | 功能开关、上传限制、CDN 配置 |
| 操作日志 | 全量审计日志查询与导出 |
| 统计看板 | 全局 DAU、存储用量、API 调用量 |

### 2.9 API 文档与开发者界面

- 基于 Swagger UI / Scalar 的在线文档
- 右侧 Try-It-Out 面板，可直接填入 API Key 调试
- 下方展示当前用户的调用统计（今日/本月/总量）

### 2.10 帮助中心/引导页

- 新手指引: 分步引导创建第一个虚拟形象（灰色遮罩 + 高亮提示）
- 快捷键速查表: 编辑器内按 `?` 弹出
- 更新日志: 版本发布记录

---

## 3. 技术栈推荐

### 前端
| 技术 | 选型 | 理由 |
|------|------|------|
| 框架 | **React 18 + TypeScript** | 生态最大，Three.js React 绑定（@react-three/fiber）最成熟 |
| 状态管理 | **Zustand** | 轻量且高性能，适合编辑器频繁状态更新 |
| UI 组件库 | **Ant Design 5** | 企业级中文生态，Table/Form/Tree 组件成熟 |
| 3D 渲染 | **Three.js + @react-three/fiber + @react-three/drei** | 社区最大，FBX/GLTF 加载器完善，PBR 支持好 |
| CSS | **TailwindCSS + CSS Modules** | 原子化提高开发效率，编辑器面板用 CSS Modules 隔离 |

**备选考虑:**
- Babylon.js: 编辑器功能更强（内置 GUI 控件、动画编辑器），但 React 集成不如 Three.js 成熟
- Vue 3 + TresJS: 如果团队更熟悉 Vue，TresJS 对标 R3F

### 后端
| 技术 | 选型 | 理由 |
|------|------|------|
| API 网关 | **APISIX** | 高性能、动态路由、插件丰富（限流/鉴权/日志） |
| 核心服务 | **Go (Gin)** | 用户/权限/资产 CRUD 等高并发场景首选 |
| 计算密集 | **Node.js + Worker Threads** | GLTF 处理/缩略图生成/格式转换 |
| 实时通信 | **WebSocket (ws + Redis PubSub)** | 编辑器多人协作场景 |

### 数据层
| 技术 | 用途 | 理由 |
|------|------|------|
| PostgreSQL 15 | 主数据库 | JSONB 存形象参数、行级安全(RLS)支持租户隔离 |
| Redis Cluster | 缓存+会话 | JWT 黑名单、Session、热点数据缓存 |
| Elasticsearch | 全文搜索 | 形象/资产搜索，拼音分词 + 中文分词 |
| MinIO | 对象存储 | S3 兼容，私有部署，存储模型/贴图/缩略图 |
| RabbitMQ | 消息队列 | 异步任务（缩略图生成、模型转换、审核通知）|

### DevOps
| 技术 | 用途 |
|------|------|
| Docker + K8s | 容器编排 |
| Prometheus + Grafana | 监控告警 |
| GitHub Actions | CI/CD |
| Nginx + Cloudflare CDN | 静态资源 + 全球加速 |

---

## 4. 编辑器核心组件交互细节

### 4.1 部件拖拽与装配

```
流程:
1. 左侧部件列表项设置 draggable=true，dataTransfer 携带部件 ID
2. 3D 画布监听 dragover/drop 事件，通过 raycasting 检测鼠标下方骨骼挂点
3. drop 时:
   a. 查询部件元数据(绑定骨骼、占用槽位)
   b. 规则引擎检查: 该槽位是否已有部件？是否互斥？
   c. 通过后: 加载 GLB → attach 到骨骼节点 → 更新 Redux/Zustand 状态
4. 已有部件替换: 旧部件 fadeOut → 新部件 fadeIn (300ms 过渡)
5. 撤销栈记录: {type:'attach_part', slot, oldPartId, newPartId}
```

### 4.2 画布操作

| 操作 | 鼠标 | 触控板 | 实现 |
|------|------|--------|------|
| 旋转 | 右键拖拽 | 双指滑动 | OrbitControls.autoRotate=false |
| 缩放 | 滚轮 | 双指捏合 | OrbitControls.minDistance=0.5, maxDistance=5 |
| 平移 | Shift+拖拽 / 中键拖拽 | 三指滑动 | OrbitControls.enablePan=true |
| 聚焦部件 | 双击部件 | — | camera.fitToBox(partBoundingBox, {padding:0.2}) |

### 4.3 属性面板实时联动

```
数据流（单向）:
Zustand Store → 3D Scene ←→ Property Panel
                    ↕
              OrbitControls

具体:
1. 用户在属性面板拖动滑条 → onChange → store.setPartParam(partId, key, value)
2. Store 更新 → 3D 组件通过 useFrame 检测变化 → 应用到 material/morphTarget
3. debounce 策略: UI 端 16ms (一帧) 批量提交，避免高频更新
4. 关键 Blendshape 参数使用 GPU 端插值 (vertex shader)
```

### 4.4 捏脸/Blendshape 滑条控制

```
实现:
1. 基础模型预定义 200+ Blendshape key (对应 morph target index)
2. 每个 Blendshape 有: displayName, index, min(-1), max(1), step(0.01), category
3. 滑条组件: <Slider min={-1} max={1} step={0.01} value={value} onChange={...} />
4. 当 value 改变:
   mesh.morphTargetInfluences[index] = value
5. 对称联动: 选中"对称编辑"时，左→右自动同步
6. 重置: 双击滑条恢复默认值 0
```

### 4.5 撤销/重做机制

```
实现 (Command 模式):
interface EditCommand {
  execute(): void;
  undo(): void;
  label: string;        // 显示在工具栏
  timestamp: number;
}

class EditHistory {
  private undoStack: EditCommand[] = [];  // max 50
  private redoStack: EditCommand[] = [];

  execute(cmd: EditCommand) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];  // 新操作清空 redo
    if (this.undoStack.length > 50) this.undoStack.shift();
  }

  undo(): void { /* pop undoStack → cmd.undo() → push redoStack */ }
  redo(): void { /* pop redoStack → cmd.execute() → push undoStack */ }
}

示例命令:
- SetBlendshapeCommand(partId, key, oldValue, newValue)
- AttachPartCommand(slot, oldPartId, newPartId)
- SetMaterialCommand(partId, oldMat, newMat)
```

### 4.6 切换动画预览

```
实现:
1. 底栏列出动画列表（待机/走路/跑步/跳跃/自定义上传）
2. 点击动画:
   a. animationMixer.stopAllAction()
   b. const action = animationMixer.clipAction(clip)
   c. action.play()
   d. 循环开关: action.setLoop(THREE.LoopRepeat / LoopOnce)
3. 动画混合: 两个动画之间 crossFadeTo(action, 0.3) 平滑过渡
4. 时间轴: 可拖拽进度条控制播放位置 (action.time = t * clip.duration)
```

---

## 5. 数据模型核心实体

### 实体关系图（文字版）

```
User ──1:N──> Avatar ──1:N──> AvatarVersion
  │               │
  │               └──N:N──> Part ──N:1──> Asset
  │                             │
  └──1:N──> APIKey              └──N:N──> PartRule (共存规则)

Workspace ──1:N──> User (成员)
Workspace ──1:N──> Avatar
Workspace ──1:N──> Asset

ReviewQueue ──1:1──> AvatarVersion
AuditLog ──N:1──> User
```

### 关键实体

**User (用户)**
```
id: UUID
workspace_id: UUID FK
email: string (unique, indexed)
username: string (unique)
password_hash: string (Argon2id)
role: enum(super_admin|admin|auditor|designer|user)
sso_provider: enum(null|ldap|oidc)
sso_subject: string (nullable)
totp_secret: string (nullable, encrypted)
status: enum(active|suspended|deleted)
last_login_at: timestamp
created_at: timestamp
```

**Avatar (虚拟形象)**
```
id: UUID
workspace_id: UUID FK
creator_id: UUID FK → User
name: string
style: enum(anime|realistic|lowpoly|korean|western|chibi)
base_model: string (GLB URL)
thumbnail_url: string
status: enum(draft|published|archived)
current_version_id: UUID FK → AvatarVersion
is_template: bool
created_at: timestamp
updated_at: timestamp
```

**AvatarVersion (形象版本)**
```
id: UUID
avatar_id: UUID FK
version_number: int
blendshape_snapshot: JSONB (map of blendShapeName→value)
body_params: JSONB ({height,shoulder,waist,...})
equipped_parts: JSONB ([{slot,partId,materialOverrides}])
preview_screenshot_url: string
status: enum(draft|pending_review|approved|rejected|published)
review_comment: string (nullable)
parent_version_id: UUID (nullable, for branching)
created_at: timestamp
```

**Part (部件/装备)**
```
id: UUID
asset_id: UUID FK → Asset
name: string
category: enum(hair|top|bottom|shoes|accessory|makeup|body)
slot: string (骨骼挂点名, e.g. "Head"|"Spine2"|"RightHand")
gender: enum(male|female|unisex)
style_tags: string[]
thumbnail_url: string
prefab_url: string (GLB/GLTF URL)
default_material: JSONB
physics_config: JSONB (optional, 布料/头发物理参数)
created_at: timestamp
```

**PartRule (部件共存规则)**
```
id: UUID
rule_type: enum(mutex|dependency)  // 互斥/依赖
part_a_id: UUID FK → Part
part_b_id: UUID FK → Part
message: string (给用户的提示，如"长发与高领上衣不兼容")
```

**Asset (数字资产)**
```
id: UUID
workspace_id: UUID FK
uploader_id: UUID FK → User
filename: string
file_size: bigint
mime_type: string
storage_path: string (MinIO key)
thumbnail_url: string
asset_type: enum(model|texture|animation|vfx|hdri)
format: enum(gltf|glb|fbx|png|jpg|hdr|exr|mp4)
license: enum(cc0|cc_by|commercial|custom)
metadata: JSONB ({polycount,textureSize,duration,...})
tags: string[]
version: int
status: enum(processing|ready|failed|archived)
created_at: timestamp
```

**Workspace (工作空间/租户)**
```
id: UUID
name: string
plan: enum(free|pro|enterprise)
sso_config: JSONB (nullable, {provider,clientId,issuer,...})
storage_quota_bytes: bigint
member_count: int
created_at: timestamp
```

---

## 6. 整体架构描述

### 分层架构

```
┌──────────────────────────────────────────────────────────┐
│ Layer 1: 客户端                                           │
│ ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│ │ React SPA    │  │ Mobile Web   │  │ 第三方 API 客户端 │  │
│ │ (Web 编辑器)  │  │ (PWA 轻量版) │  │ (REST + SDK)    │  │
│ └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
└────────┼──────────────────┼───────────────────┼───────────┘
         │                  │                   │
         └──────────────────┼───────────────────┘
                            │ HTTPS/TLS 1.3
┌───────────────────────────▼──────────────────────────────┐
│ Layer 2: 网关层 (APISIX)                                   │
│ • JWT 验证 (RS256 公钥)                                    │
│ • 限流 (令牌桶, 100rps/user)                                │
│ • 路由 (path → upstream service)                           │
│ • CORS / WAF / IP 黑白名单                                  │
│ • WebSocket 升级 (编辑器实时协作)                             │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│ Layer 3: 业务服务层 (微服务)                                │
│                                                            │
│ ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│ │ user-svc     │ │avatar-svc│ │ asset-svc│ │config-svc │  │
│ │ (Go)         │ │(Go+Node) │ │ (Go)     │ │ (Go)      │  │
│ │ 认证/鉴权    │ │ 编辑引擎 │ │ 上传管理 │ │ 规则引擎   │  │
│ │ SSO集成      │ │ 版本管理 │ │ 缩略图   │ │ 模板库     │  │
│ └──────┬───────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│        │              │            │             │         │
│ ┌──────▼───────┐ ┌────▼─────┐ ┌───▼──────┐ ┌───▼──────┐  │
│ │ render-svc   │ │review-svc│ │analytics │ │admin-svc │  │
│ │ (Node.js)    │ │ (Go)     │ │ -svc     │ │ (Go)     │  │
│ │ 3D截图/导出  │ │ 审核流程 │ │ (Go)     │ │ 审计/配置 │  │
│ │ VRM转换      │ │ 发布管理 │ │ 埋点聚合 │ │ 监控告警  │  │
│ └──────┬───────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
└────────┼──────────────┼────────────┼─────────────┼───────┘
         │              │            │             │
         └──────────────┼────────────┼─────────────┘
                        │            │
┌───────────────────────▼────────────▼─────────────────────┐
│ Layer 4: 数据层                                            │
│                                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│ │PostgreSQL│ │  Redis   │ │  MinIO   │ │Elasticsearch │  │
│ │ (主数据) │ │(缓存/Sess)│ │(对象存储) │ │  (全文搜索)  │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│ │RabbitMQ  │ │ Kafka    │ │ClickHouse│                    │
│ │(任务队列) │ │(埋点流水) │ │(OLAP分析)│                    │
│ └──────────┘ └──────────┘ └──────────┘                    │
└───────────────────────────────────────────────────────────┘
```

### 关键通信流程

**编辑形象 → 3D 预览实时更新:**
```
用户拖动滑条
  → React onChange → Zustand store.set(key, value)
  → useFrame 检测 store 变化
  → mesh.morphTargetInfluences[i] = value
  → GPU 渲染 (WebGL draw call)
全程在客户端完成，无网络延迟
```

**保存形象:**
```
用户点击保存
  → POST /api/avatars/:id/versions (blendshape snapshot + equipped parts)
  → avatar-svc 生成版本记录，写入 PostgreSQL
  → 异步: 发送 MQ 消息 → render-svc 渲染 4K 截图 → 上传 MinIO → 更新 thumbnail_url
  → 返回 version_id + 截图 URL
```

**上传资产:**
```
用户拖拽文件到资产库
  → 前端计算 MD5 → 检查秒传 (asset-svc GET /dedup?hash=xxx)
  → 若重复: 直接复用已有资产
  → 若新文件: 分片上传 → asset-svc 合并 → 写入 MinIO
  → MQ 异步任务: 生成缩略图 → 提取元数据(polycount, format 等) → 写入 DB
  → 前端轮询 /api/assets/:id/status 直到 ready
```

**企业 SSO 登录:**
```
用户点击"企业 SSO 登录"
  → 输入企业域名 → 查询 workspace SSO 配置
  → 重定向到 OIDC Provider (如 Azure AD)
  → 用户认证 → 回调 /api/auth/oidc/callback
  → user-svc 验证 id_token → 查找/创建用户 → 签发 JWT
  → 前端存储 access_token (内存) + refresh_token (httpOnly cookie)
全程不涉及手机号/微信/QQ 任何字段
```

---

## 附录: 安全设计清单

- [x] 密码: Argon2id 哈希，参数 m=65536, t=3, p=4
- [x] 会话: JWT RS256 + refresh token rotation + 设备指纹
- [x] 传输: TLS 1.3, HSTS (max-age=31536000)
- [x] 上传: 文件类型魔数校验（禁止仅依据扩展名）
- [x] SQL 注入: 参数化查询（Go database/sql）
- [x] XSS: CSP 头 + React 默认转义 + DOMPurify 处理用户输入
- [x] CSRF: SameSite=Strict Cookie + CSRF Token
- [x] 速率限制: 登录接口 5次/IP/分钟，API 100次/用户/秒
- [x] 登录页: 仅邮箱+密码+SSO，彻底移除手机/微信/QQ 入口
