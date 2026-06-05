# AstralFox 项目架构图 v2.0 — Phase 1 完成后 (2026-05-27)

## 系统总览

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            AstralFox 星尘狐 系统架构                            │
│                        AI桌面宠伴侣 + 创作者市场平台                             │
│                             完成度: 74% (Phase 1)                              │
└──────────────────────────────────────────────────────────────────────────────┘

                                  ┌──────────────┐
                                  │   用户/创作者   │
                                  └──────┬───────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
     ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
     │  Unity 桌宠客户端  │  │  Web 管理平台     │  │  第三方 API       │
     │  (C# / Live2D)    │  │  (Next.js 16)    │  │                  │
     │  Windows 桌面应用  │  │  浏览器 SPA       │  │  和风天气 API     │
     │  Tuanjie 2022.3   │  │  Chrome/Firefox/ │  │  Bing Search API  │
     │  Cubism SDK 5.3   │  │  Safari/Edge     │  │  Azure Speech     │
     └────────┬──────────┘  └────────┬─────────┘  │  OpenAI / 兼容    │
              │                      │             └────────┬─────────┘
              │                      │                      │
     ┌────────▼──────────────────────▼──────────────────────▼─────────┐
     │                        网络边界                                  │
     │  HTTPS (TLS 1.3) / WSS (WebSocket Secure)                      │
     │  HTTP/2 多路复用 │ CORS 白名单 │ CSRF Double Cookie │ Rate Limiting │
     └────────┬──────────────────────┬──────────────────────┬─────────┘
              │                      │                      │
     ┌────────▼──────────┐  ┌────────▼──────────┐  ┌────────▼──────────┐
     │  Python BFF        │  │  Next.js API      │  │  基础设施           │
     │  (FastAPI)         │  │  (App Router)     │  │                   │
     │                    │  │                   │  │  PostgreSQL 16     │
     │  /ws/chat (WSS)    │  │  /api/auth/*      │  │  Redis (可选)       │
     │                    │  │  /api/market/*    │  │  SQLite (开发)      │
     │  ASR 语音识别 ◄────┼──┤  /api/pet/*       │  │  MinIO/S3 (可选)    │
     │  LLM 对话 ◄────────┤  │  /api/admin/*     │  │  RabbitMQ (Phase2) │
     │  TTS 语音合成 ◄────┤  │  /api/notif/*     │  │                   │
     │  Tools 工具调用 ◄──┤  │  /api/assets/*    │  │                   │
     │                    │  │                   │  │                   │
     │  ┌──────────────┐  │  │  ┌─────────────┐  │  │                   │
     │  │ 和风天气 API  │  │  │  │ 19 Prisma   │  │  │                   │
     │  │ Bing Search  │  │  │  │ 模型         │  │  │                   │
     │  │ 定时提醒      │  │  │  │ RBAC 5级角色  │  │  │                   │
     │  └──────────────┘  │  │  └─────────────┘  │  │                   │
     └────────┬───────────┘  └────────┬──────────┘  └────────┬──────────┘
              │                       │                       │
              │              ┌────────▼──────────┐            │
              │              │  中间件链           │            │
              │              │                   │            │
              │              │  JWT (RS256/HS256)│            │
              │              │  CSRF Double Cookie│           │
              │              │  CORS 白名单       │            │
              │              │  RBAC (5级: super_ │            │
              │              │  admin→admin→     │            │
              │              │  auditor→designer │            │
              │              │  →user)           │            │
              │              │  Rate Limiting    │            │
              │              │  (Upstash→memory) │            │
              │              │  CSP + HSTS       │            │
              │              └────────┬──────────┘            │
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │     可观测性栈             │
                         │                          │
                         │  OpenTelemetry 链路追踪   │
                         │  Sentry 错误监控          │
                         │  Prometheus 指标采集      │
                         │  Grafana 可视化面板       │
                         │  Loki 日志聚合            │
                         │  Pino 结构化日志 + PII脱敏 │
                         └──────────────────────────┘
```

---

## 数据模型图 (Prisma — 19 Models)

```
┌──────────────────────────────────────────────────────────────────┐
│                          User (用户)                               │
│  id, email, username, password_hash, role, workspace_id           │
│  email_verified, avatar_url, totp_secret, last_login              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐                   │
│  │ Session  │  │ ApiKey   │  │ OAuthClient  │                   │
│  │ token    │  │ key_hash │  │ client_id    │                   │
│  │ expires  │  │ scopes   │  │ redirect_uri │                   │
│  │ revoked  │  │ revoked  │  │ grants       │                   │
│  └──────────┘  └──────────┘  └──────────────┘                   │
└───────────────────────┬──────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┬──────────────────┐
        ▼               ▼               ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Avatar     │ │   Asset      │ │ MarketItem   │ │  PetConfig   │
│   (形象)      │ │   (资产)      │ │  (市场商品)   │ │  (桌宠配置)   │
│              │ │              │ │              │ │              │
│ name         │ │ filename     │ │ title        │ │ pet_name     │
│ creator_id───┼─┤ uploader_id  │ │ description  │ │ user_id ────┼──► User
│ status       │ │ type/size    │ │ price        │ │ personality  │
│ thumbnail    │ │ category     │ │ category     │ │ backstory    │
│ is_template  │ │ license      │ │ status───────┼─┤─审核流程      │
│              │ │ version      │ │ seller_id───┼─┤─► User        │
└──────┬───────┘ └──────┬───────┘ │ download_cnt │ │ model_path   │
       │                │         │ rating       │ │ animation    │
       ▼                ▼         └──────┬───────┘ └──────┬───────┘
┌──────────────┐ ┌──────────────┐        │                │
│AvatarVersion │ │ PetEquipSlot │        ▼                ▼
│  (版本快照)   │ │  (装备槽位)   │ ┌──────────────┐ ┌──────────────┐
│              │ │              │ │    Order     │ │PetSessionLog │
│ snapshot_data│ │ slot_name    │ │  (订单)       │ │  (会话日志)   │
│ version_num  │ │ asset_id────┼─┤              │ │              │
│ changelog    │ │ pet_config──┼─┤ buyer_id     │ │ action       │
│ avatar_id    │ │ slot_order   │ │ item_id      │ │ timestamp    │
└──────────────┘ └──────────────┘ │ amount       │ │ metadata     │
                                  │ status       │ └──────────────┘
┌──────────────┐ ┌──────────────┐ │ platform_fee │
│ PartRule     │ │ AuditLog     │ │ seller_payout│
│  (部件规则)   │ │  (审计日志)   │ └──────┬───────┘
│              │ │              │        │
│ rule_type    │ │ user_id      │        ▼
│ left_part    │ │ action       │ ┌──────────────┐
│ right_part   │ │ resource     │ │   Review     │
│ relation     │ │ ip_address   │ │  (评价)       │
│ is_active    │ │ user_agent   │ │              │
└──────────────┘ │ metadata     │ │ rating       │
                 │ created_at   │ │ comment      │
                 └──────────────┘ │ pet_screenshot│
                                  │ user_id      │
┌──────────────┐ ┌──────────────┐ │ item_id      │
│ Notification │ │ Experiment   │ └──────────────┘
│  (通知)       │ │  (A/B实验)   │
│              │ │              │
│ user_id      │ │ name         │
│ type         │ │ description  │
│ title        │ │ traffic_pct  │
│ message      │ │ variants     │
│ resource_url │ │ winning_var  │
│ is_read      │ │ is_active    │
│ created_at   │ │ started_at   │
└──────────────┘ └──────────────┘
```

---

## WebSocket 通信协议 (BFF ↔ Unity)

```
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket 协议: /ws/chat                       │
│                                                                  │
│  Unity → BFF (Binary):                                          │
│    PCM 16kHz 16bit mono 音频块                                    │
│                                                                  │
│  Unity → BFF (Text):                                            │
│    {"type": "ping"}                                             │
│                                                                  │
│  BFF → Unity (Text JSON):                                       │
│    {"type": "partial_transcript", "text": "..."}                │
│    {"type": "final_transcript",  "text": "用户说了什么"}          │
│    {"type": "llm_response",      "text": "[happy]你好!"}         │
│    {"type": "tts_audio",         "index":0, "data":"<base64>"}  │
│    {"type": "tts_done"}                                         │
│    {"type": "reminder",          "id":"...", "title":"..."}      │
│    {"type": "error",             "message": "..."}              │
│                                                                  │
│  管线: 音频 → ASR → 文本 → LLM → 响应文本 → TTS → 音频            │
│              Azure Speech    GPT-4o/兼容    Azure Speech         │
│                                                                  │
│  Function Tools (LLM 可调用):                                    │
│    get_weather("北京")   → 和风天气 API                           │
│    search_web("新闻")    → Bing Search API v7                    │
│    set_reminder("喝水", "5分钟后") → asyncio 定时器 → WS推送      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Unity 客户端内部架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Unity 桌宠客户端                              │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ BackendClient   │  │ PetApiClient    │  │ ConfigManager   │  │
│  │ (WebSocket)      │  │ (HTTP REST)     │  │ (本地配置)       │  │
│  │                 │  │                 │  │                 │  │
│  │ ws://BFF/chat   │  │ /api/pet/sync  │  │ AppConfig.json  │  │
│  │ 音频收发         │  │ API Key 同步    │  │ DataStore       │  │
│  │ 消息分发         │  │ JWT 认证       │  │ 加密存储         │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
│           └────────────────────┼────────────────────┘            │
│                                │                                 │
│  ┌─────────────────────────────▼─────────────────────────────┐  │
│  │                    PetAnimationManager                     │  │
│  │                    (动画中枢调度)                             │  │
│  └──┬──────────┬──────────┬──────────┬──────────┬────────────┘  │
│     │          │          │          │          │               │
│     ▼          ▼          ▼          ▼          ▼               │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌──────────────┐     │
│  │FoxAni│ │FoxEmo│ │Cubism │ │FoxSim│ │Live2DAnimator│     │
│  │mation │ │tion   │ │Param  │ │ple   │ │(IPetAnimator)│     │
│  │Ctrl   │ │Ctrl   │ │Driver │ │Move  │ │              │     │
│  │       │ │       │ │       │ │ment  │ │ 统一接口      │     │
│  │状态机  │ │表情管理│ │参数驱动│ │桌面  │ │              │     │
│  │Idle   │ │Neutral│ │Smooth │ │漫游  │ │ SetMouthOpen │     │
│  │Listen │ │Happy  │ │Damp   │ │走动  │ │ SetEyeOpen   │     │
│  │Speak  │ │Sad    │ │       │ │跳跃  │ │ SetTailWag   │     │
│  │Sleep  │ │Shy    │ │       │ │边界  │ │ SetEarPose   │     │
│  │Drag   │ │Angry  │ │       │ │检测  │ │ SetBodyPose  │     │
│  │Greet  │ │       │ │       │ │      │ │              │     │
│  └───────┘ └───────┘ └───────┘ └───────┘ └──────────────┘     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                Live2D Cubism 5 渲染层                      │   │
│  │  CubismModel → CubismRenderer → CubismParameterStore      │   │
│  │  18 drawables │ CatTail 猫尾 Q版 模型                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Web 管理平台前端架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 16 App Router                          │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     AppLayout (Shell)                      │  │
│  │  ┌─────────┐  ┌──────────────────────────────────────┐    │  │
│  │  │ Sidebar │  │  Header (SearchModal + NotifDropdown) │    │  │
│  │  │         │  │                                       │    │  │
│  │  │ 工作台   │  │  ┌─────────────────────────────────┐  │    │  │
│  │  │ 形象管理 │  │  │        Page Content              │  │    │  │
│  │  │ 资产管理 │  │  │  (loading.tsx → error.tsx →      │  │    │  │
│  │  │ 市场     │  │  │   page.tsx)                      │  │    │  │
│  │  │ 通知 🆕  │  │  └─────────────────────────────────┘  │    │  │
│  │  │ 管理后台 │  │                                       │    │  │
│  │  │ 设置    │  │                                       │    │  │
│  │  └─────────┘  └──────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    认证页面 (无布局)                        │  │
│  │  /login │ /register │ /forgot-password │ /reset-password  │  │
│  │  /oauth/consent                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    组件库 (30 components)                   │  │
│  │                                                            │  │
│  │  common/          layout/          dashboard/              │  │
│  │  ├─ ErrorBoundary ├─ AppLayout     ├─ KpiCards              │  │
│  │  ├─ AvatarCard    ├─ Header        ├─ RecentAvatars         │  │
│  │  └─ Placeholder   ├─ Sidebar       ├─ CreationTrendChart    │  │
│  │                   ├─ SearchModal   └─ PartUsageChart        │  │
│  │  auth/            ├─ NotifDropdown                         │  │
│  │  ├─ LoginForm     │               market/                  │  │
│  │  └─ RegisterForm  │               └─ AssetPickerModal       │  │
│  │                   │               live2d/                  │  │
│  │                   │               └─ Live2DViewer 🆕        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    数据层                                   │  │
│  │  Zustand (authStore, uiStore)  │  SWR (useApiPaginated)    │  │
│  │  api-client.ts (自动 Bearer + CSRF + 401 自动刷新)         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 部署架构 (Phase 1 → Phase 2)

```
┌─────────────────────────────────────────────────────────────────┐
│                      当前: Docker Compose                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  web          │  │  bff          │  │  postgres     │          │
│  │  (Next.js)    │  │  (FastAPI)    │  │  (16-alpine)  │          │
│  │  port:3000    │  │  port:8765    │  │  port:5432    │          │
│  │  Dockerfile   │  │  Dockerfile   │  │               │          │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      未来: Kubernetes (Helm + ArgoCD)             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Ingress (NGINX)                        │   │
│  │                    TLS + WSS                             │   │
│  └────────┬──────────┬──────────┬──────────┬────────────────┘   │
│           │          │          │          │                    │
│  ┌────────▼──┐ ┌─────▼────┐ ┌──▼──────┐ ┌─▼──────────┐        │
│  │ Web Pods  │ │ BFF Pods │ │ Monitor │ │ Background  │        │
│  │ (HPA 2-5) │ │ (HPA 2-3)│ │ Grafana │ │ CronJobs    │        │
│  │ Next.js   │ │ FastAPI  │ │ Prometh │ │ Settlements │        │
│  └───────────┘ └──────────┘ │ Loki    │ │ Cleanup     │        │
│                             └─────────┘ └─────────────┘        │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │PostgreSQL│ │  Redis   │ │RabbitMQ  │ │  MinIO   │          │
│  │(Primary  │ │(Sentinel)│ │(Phase 2) │ │  (S3)    │          │
│  │+Replica) │ │          │ │          │ │          │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  安全: ExternalSecrets │ Canary Deploy │ PriorityClass   │   │
│  │  Trivy 镜像扫描 │ NetworkPolicy │ PodSecurityPolicy     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 技术栈总览

| 层次 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **前端框架** | Next.js (App Router) | 16 | Web 管理平台 SPA |
| **UI 组件** | Ant Design | 5.x | 企业级 React 组件库 |
| **状态管理** | Zustand + SWR | latest | 客户端状态 + 数据获取 |
| **3D 渲染** | Live2D Cubism 5 SDK (Web) | 5.3 | 浏览器内桌宠预览 |
| **桌宠引擎** | Unity (Tuanjie) | 2022.3 | 桌面客户端 |
| **2D 动画** | Live2D Cubism 5 SDK (Native) | 5.3-r.5 | Live2D 模型渲染 |
| **后端框架** | Next.js API + FastAPI | 16 / 0.110 | REST API + WebSocket |
| **数据库** | PostgreSQL + SQLite | 16 / 3 | 主库 + 开发库 |
| **ORM** | Prisma | 7.8 | 类型安全数据访问 |
| **LLM** | OpenAI GPT-4o / 兼容 API | - | 对话 AI |
| **语音** | Azure Speech Services | - | ASR 语音识别 + TTS 合成 |
| **认证** | JWT RS256/HS256 | - | 无状态认证 + refresh 轮转 |
| **监控** | OpenTelemetry + Sentry + Prometheus + Grafana + Loki | - | 全栈可观测性 |
| **CI/CD** | GitHub Actions + Docker + Trivy | - | 自动化构建 + 安全扫描 |
| **部署** | Docker Compose → K8s (Helm + ArgoCD) | - | 容器编排 |
| **IaC** | Terraform | - | 基础设施即代码 |

---

## Phase 1 完成后的能力矩阵

| 能力 | 状态 | 用户可感知 |
|------|------|-----------|
| 邮箱注册/登录 | 完成 | 注册 → 邮箱验证 → 登录 → 工作台 |
| 宠物配置同步 | 完成 | Web 配置 API Key → Unity 自动拉取 |
| 语音对话 | 完成 | 唤醒词 → ASR → GPT-4o → TTS → 口型动画 |
| Live2D 动画 | 完成 | 6 状态机 (Idle/Listen/Speak/Sleep/Drag/Greet) |
| 桌面漫游 | 完成 | 自动走动/跳跃/边缘检测/透明窗口 |
| 市场浏览 | 完成 | 商品列表/搜索/筛选/详情页 |
| 商品购买 | Mock | 订单创建但不涉及资金流转 |
| 通知系统 | 完成 | 购买/销售/系统通知 → 铃铛图标 + 列表页 |
| 实时天气 | 完成 | 问"今天北京天气"→ 和风天气真实数据 |
| 网页搜索 | 完成 | 问"搜索最新AI新闻"→ Bing 搜索结果 |
| 定时提醒 | 完成 | "5分钟后提醒我喝水"→ 桌面弹窗 |
| 管理后台 | 完成 | 用户管理/审计日志/市场审核/A/B实验 |
| 支付 | Mock | Phase 2 |
| 创作者提现 | 无 | Phase 2 |
| 移动端 | 无 | Phase 3 |
| 社交功能 | 无 | Phase 3 |
