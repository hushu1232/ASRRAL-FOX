# Avatar Web Management 改进路线图

> 基于 2026-05-29 工程完程度分析生成 | 综合得分 87/100

---

## 执行策略

采用"风险优先 + 投入产出比排序"原则，分 4 个 Phase 推进：

| Phase | 目标 | 工期 | 门槛 |
|-------|------|------|------|
| Phase 0 | 消除已知安全隐患 | 0.5d | ✅ 已完成 | 必须完成才能部署生产 |
| Phase 1 | 补测试 + 修响应式，达到可上线标准 | 5d | ✅ 已完成 | 生产发布前 |
| Phase 2 | 可观测性 + 工程化补齐 | 3d | ✅ 已完成 | 生产运行第1周 |
| Phase 3 | 体验深度打磨 | 6d | ✅ 已完成 | 公开发布前 |

---

## Phase 0：安全基线 (0.5d)

### ✅ T0-1: Notification 路由错误处理补全 [0.5h]

- **文件**: `src/app/api/notifications/route.ts`, `[id]/route.ts`, `[id]/read/route.ts`, `read-all/route.ts`, `unread-count/route.ts`
- **问题**: 4 个路由缺少 try/catch，服务层异常会直接泄漏为 500
- **方案**: 用 `try { ... } catch (e) { return error(e); }` 包裹每个 handler
- **验证**: `curl -X GET localhost:3000/api/notifications` 在 DB 离线时返回 `{ success: false, error: "..." }` 而非 crash
- **依赖**: 无

### ✅ T0-2: Admin 路由参数提取规范化 [0.5h]

- **文件**: `src/app/api/admin/users/[id]/route.ts`
- **问题**: 用 `req.url.split('/').pop()` 取 ID，特殊字符或末尾斜杠会取错
- **方案**: 改用 Next.js route params: `{ params }: { params: { id: string } }`
- **验证**: `curl -X PUT localhost:3000/api/admin/users/user_01` 正确更新目标用户
- **依赖**: 无

---

## Phase 1：测试 + 响应式补全 (5d)

### ✅ T1-1: Pet 核心组件测试 [2d]

**PetPreview.test.tsx** [0.5d]
- 渲染：加载态 Spin、错误态 + 重试按钮、正常态
- VoiceInput 集成：语音状态标签切换 (listening/thinking/speaking)
- ChatPanel 消息流：发送消息 → 追加到列表
- 边界：config 为 null 不渲染、voiceSupported=false 隐藏语音按钮
- Mock: `usePetPreviewStore`, `useVoiceInput`, `useTimeAwareness`

**ModelViewer.test.tsx** [0.5d]
- 渲染：Live2D 模式加载动态导入、VRM 模式初始化
- 情绪标签显示 (EMOTION_MAP 5 种)
- 语音指示器显示/隐藏 (isSpeaking 切换)
- 错误态：Live2D onError → error UI
- 口型同步：isSpeaking=true 时创建 AudioContext、isSpeaking=false 时清理
- Mock: `next/dynamic`, `AudioContext`, `requestAnimationFrame`

**ChatPanel.test.tsx** [0.5d]
- 空消息 → 欢迎页面
- 消息列表渲染（用户/AI 消息样式区分）
- 输入发送：Enter 键发送、按钮发送
- 语音按钮：voiceActive 切换图标、voiceText 中间结果显示
- disabled 态 → 输入框和按钮禁用
- 自动滚动到底部

**VoiceCloningWizard.test.tsx** [0.5d]
- Step1: 文件类型校验（合法/非法格式）、文件大小校验（>100MB）
- Step1→Step2: 未上传文件弹 warning、未填名称弹 warning
- Step2: 训练启动 → polling 启动、训练完成 → Result 显示
- Step2: 训练失败 → 错误 Result + 重试按钮
- Step3: 语音列表渲染、试听播放/停止、删除确认
- Step3: 未选择音色点击"设为桌宠"弹 warning
- Mock: `apiPost`, `apiGet`, `apiDelete`, `apiPostFormData`, `useAuthStore`

### ✅ T1-2: Rigging 组件测试 [1.5d]

**RiggingUpload.test.tsx** [0.5d]
- 文件上传区域渲染 (Dragger)
- 模板选择器 (Select → 3 个选项)
- 网格密度选择器 (Radio → 3 个选项)
- 上传成功 → 显示 imageId
- 上传失败 → message.error
- 未上传点击开始 → 按钮 disabled
- Mock: `apiPostFormData`, `message`

**PipelineProgress.test.tsx** [0.5d]
- 初始状态 → `connecting` 阶段
- WebSocket 消息 → 进度条百分比更新
- 阶段切换 (separating → rigging → exporting → deploying)
- 完成 → success Alert + 时间显示
- 失败 → error Alert + 重试按钮
- WebSocket 断开 → 降级轮询 `GET /api/rigging/status/:id`
- Mock: WebSocket, `fetch`

**ModelPreview.test.tsx** [0.5d]
- 模型信息展示 (模板名、网格密度、耗时)
- Live2DViewer 渲染 (传入 modelUrl)
- 下载按钮 → 调用下载 API
- 设为桌宠按钮 → 调用 pet API
- 发布市场按钮 → 跳转市场创建页
- 重新生成按钮 → 触发 pipeline
- Mock: `next/dynamic`, `Live2DViewer`, `apiPost`, `apiGet`

### ✅ T1-3: Rigging + VoiceCloning 响应式改造 [1d]

**RiggingUpload.tsx** [0.25d]
- 移除 `maxWidth: 600` 硬编码 → `max-w-2xl mx-auto`
- Upload 区域 → `w-full` + 响应式 padding
- 模板/网格选择器 → 小屏堆叠 (flex-col)，大屏并排 (flex-row)

**PipelineProgress.tsx** [0.25d]
- 移除 `maxWidth: 600` → `max-w-2xl mx-auto`
- Steps 组件 → 小屏 `size="small"` + `direction="vertical"`，大屏水平

**ModelPreview.tsx** [0.25d]
- 移除 `maxWidth: 600` → `max-w-2xl mx-auto`
- 按钮组 → 小屏 `flex-col`，大屏 `flex-row`
- Live2D 预览容器 → 小屏 300px 高，大屏 500px

**VoiceCloningWizard.tsx** [0.25d]
- 移除 `maxWidth: 680` 硬编码 → `max-w-2xl mx-auto`
- Steps 响应式同 PipelineProgress
- Card + Space → 响应式 padding
- 内联 `<input>` / `<textarea>` → Tailwind class 替代内联 style

### ✅ T1-4: Dashboard 图表组件测试 [0.5d]

**KpiCards.test.tsx** [0.15d]
- 4 个 KPI 卡片渲染
- 数值格式化 (千分位)
- 市场指标显示/隐藏
- 空数据 → 0 而非 NaN

**CreationTrendChart.test.tsx** [0.15d]
- 图表 SVG 渲染
- 数据点 → 折线绘制
- 空数据 → Empty 占位
- Mock: Recharts (依赖 ResizeObserver)

**PartUsageChart.test.tsx** [0.1d]
- 水平条形图渲染
- 部件名截断 (长名称)
- 空数据 → Empty 占位

**RecentAvatars.test.tsx** [0.1d]
- 表格列头渲染
- 空数据 → 居中提示
- 行点击 → 跳转详情

---

## Phase 2：可观测性 + 工程化 (3d)

### ✅ T2-1: 告警规则配置 [1d]

**Grafana AlertManager 规则**:
| 指标 | 条件 | 严重级别 |
|------|------|----------|
| API 错误率 | `rate(http_requests_total{status=~"5.."}[5m]) > 0.05` | critical |
| API P95 延迟 | `histogram_quantile(0.95, http_request_duration_ms) > 2000` | warning |
| DB 连接池耗尽 | `pg_pool_idle_connections < 2` | critical |
| Redis 不可用 | `redis_connected == 0` | warning |
| Rigging 服务不可达 | `healthcheck_rigging_status == 0` | warning |
| 磁盘使用率 | `disk_usage_percent > 80` | warning |
| 内存使用率 | `memory_usage_percent > 85` | critical |

**通知渠道**: Slack webhook #avatar-alerts + 邮件 oncall@

### ✅ T2-2: 分布式追踪可视化 [0.5d]

- 确认 OpenTelemetry OTLP exporter → Grafana Tempo / Jaeger
- 验证 trace 从 Next.js → Prisma → Rigging Service 全链路串联
- 在 Helm values 添加 `tempo` endpoint 配置

### ✅ T2-3: SLO 燃烧率监控 [0.5d]

- 定义 SLO: API 可用性 99.9%，P95 < 2s
- Prometheus recording rules: `slo:burn_rate_1h`, `slo:burn_rate_6h`
- 多窗口燃烧率告警: 1h > 14.4x + 6h > 6x → 页面

### ✅ T2-4: 日志聚合接入 [0.5d]

- 验证 Loki → Grafana 日志查询链路
- 添加关键日志 label: `{service="avatar-web", level="error"}`
- 配置 LogQL 常用查询面板 (Top 10 errors, 按路由分组的 4xx/5xx)

### ✅ T2-5: CD 部署步骤 [0.5d]

- GitHub Actions 添加 deploy job (当前只有 docker-build-push)
- 方案: `kubectl set image` + `kubectl rollout status` 或 ArgoCD Image Updater
- 添加 `helm rollback` 一键回滚脚本
- 部署通知到 Slack

---

## Phase 3：体验深度打磨 (6d)

### ✅ T3-1: 无障碍审计与修复 [2d]

**范围**: 所有面向用户的组件

**全局修复**:
- AppLayout: 添加 `<main>` 语义标签 (当前用 div#main-content)
- Sidebar: 添加 `<nav>` + `aria-label="主导航"`
- 所有 Card → `role="region"` + `aria-label`

**组件级修复**:
| 组件 | 问题 | 修复 |
|------|------|------|
| ChatPanel | 新消息无播报 | `aria-live="polite"` + `aria-atomic="true"` 在消息列表 |
| PipelineProgress | 进度更新无声 | `aria-live="assertive"` + `aria-valuenow` 在进度条 |
| ModelViewer | Canvas 无替代文本 | `aria-label="Live2D 模型预览"` + `role="img"` |
| VoiceCloningWizard | 表单无标签关联 | `<label htmlFor>` 绑定 input/textarea |
| SearchModal | 搜索结果无计数 | `aria-live` 在结果区域 |
| Drag & Drop | 无键盘替代 | 添加"点击选择文件"按钮 + `onKeyDown` 处理 |
| Recharts 图表 | SVG 完全不可访问 | 添加 `aria-label` + `role="img"` + 隐藏数据表 |

### ✅ T3-2: 组件测试补齐 (非 Pet/Rigging) [1.5d]

**AvatarCard.test.tsx** [0.25d]
- 渲染：名称、图片、状态标签
- 草稿/已发布/审核中 状态色
- male/female 性别标签
- 悬停效果

**SearchModal.test.tsx** [0.25d]
- 打开/关闭 Modal
- 搜索输入 → 结果列表
- 空结果 → Empty 组件
- 键盘导航 (上/下箭头 + Enter)
- 多分类结果分组

**Live2DViewer.test.tsx** [0.5d]
- Canvas 初始化 + Cubism 加载
- 加载状态 → Loading 覆盖层
- 加载失败 → 错误 UI + 重试
- 指针交互 (拖拽旋转)
- 模型切换 (modelUrl 变化 → 重新加载)
- Mock: Cubism Framework, Canvas API

**AssetPickerModal.test.tsx** [0.25d]
- 网格渲染 + 类型过滤
- 选中/取消选中
- 确认按钮 → 返回选中 asset IDs
- 空资产 → Empty 状态

**PlaceholderImage.test.tsx** [0.25d]
- 正常图片渲染
- 加载失败 → fallback SVG
- null/undefined src → 立即 fallback
- 不同类型 → 不同 fallback 图标

### ✅ T3-3: 空状态 / 边界情况统一 [0.5d]

**统一 Empty 组件规范**:
- 所有列表页 → 无数据时使用 Ant Design `<Empty>` + 对应描述
- 所有图表 → 无数据时居中显示 Empty，而非空白 SVG
- 所有搜索 → 无结果时显示 "未找到与 {query} 相关的结果"

**边界修复清单**:
- RecentAvatars 空数据 → 已有但需验证
- CreationTrendChart 空数据 → 需添加 Empty 回退
- PartUsageChart 空数据 → 需添加 Empty 回退
- VoiceCloningWizard Step3 空语音 → 已有 Empty
- RiggingUpload 模板列表为空 → 需添加 Empty

### ✅ T3-4: VoiceInput 增强 [1d]

**VAD (语音活动检测)** [0.5d]:
- ✅ 用 `AnalyserNode.getByteTimeDomainData` 计算 RMS → 阈值判断静音
- ✅ 静音 > 2s → 自动截断 + 发送
- ✅ 复用 ModelViewer 中已有的 RMS 计算逻辑
- ✅ 新增 props: `vadEnabled`, `silenceThreshold`, `silenceTimeout`
- **文件**: `src/components/pet/preview/VoiceInput.tsx`

**TTS 错误恢复** [0.5d]:
- ✅ 添加 `retryWithBackoff` 3 次指数退避 (1s/2s/4s)
- ✅ 每次尝试超时缩短至 15s
- ✅ 新增 `SynthesizeError` 类区分可恢复/不可恢复错误
- ✅ 4xx 错误立即失败不重试，5xx/网络错误自动重试
- **文件**: `src/lib/services/ttsService.ts`

### ✅ T3-5: 响应式全覆盖 [1d]

**移动端适配 (< 768px)**:
| 区域 | 当前问题 | 修复 | 状态 |
|------|----------|------|------|
| PetPreview | ChatPanel 固定 400px | 小屏全宽底部抽屉 (Drawer)，大屏侧边面板 | ✅ |
| Dashboard | KPI 网格 OK | 图表 `grid-cols-1 lg:grid-cols-2` 已适配 | ✅ |
| Marketplace | 搜索栏常显 | 搜索栏折叠到 Filters 按钮，Sort 下拉折叠 | ✅ |
| Admin | Tab 无滚动 | Tab 列表 `overflow-x-auto` 横向滚动 | ✅ |
| Settings | OK | - | - |
| Rigging | 硬编码宽度 | T1-3 已修 | ✅ |
| VoiceCloning | 硬编码宽度 | T1-3 已修 | ✅ |

**修改文件**:
- `src/components/pet/preview/PetPreview.tsx` — `isMobile` state + `Drawer` 底部抽屉 + 浮动按钮
- `src/app/(auth)/marketplace/page.tsx` — `showFilters` toggle + 响应式搜索栏折叠
- `src/app/(auth)/admin/page.tsx` — Tabs `overflow-x-auto` 横向滚动
- `messages/en.json`, `messages/zh-CN.json`, `messages/ja.json` — 新增 `marketplace.filters`, `pet.preview.chat`

---

## 执行顺序与依赖图

```
Phase 0 (0.5d)
├── T0-1: Notification try/catch ── 无依赖
└── T0-2: Admin params fix ────────── 无依赖
    │
    ▼
Phase 1 (5d)
├── T1-1: Pet 组件测试 ───────────── 无依赖
├── T1-2: Rigging 组件测试 ───────── 无依赖
├── T1-3: 响应式改造 ─────────────── 无依赖，可与测试并行
└── T1-4: Dashboard 图表测试 ──────── 无依赖
    │
    ▼
Phase 2 (3d)
├── T2-1: 告警规则 ───────────────── 依赖 O11y 基础设施就绪
├── T2-2: 分布式追踪 ─────────────── 无依赖
├── T2-3: SLO 燃烧率 ────────────── 依赖 T2-1
├── T2-4: 日志聚合 ───────────────── 无依赖
└── T2-5: CD 部署 ───────────────── 无依赖
    │
    ▼
Phase 3 (6d) ✅ 已完成
├── ✅ T3-1: 无障碍修复 ─────────────── 无依赖
├── ✅ T3-2: 组件测试补齐 ───────────── 无依赖
├── ✅ T3-3: 空状态/边界 ───────────── 无依赖
├── ✅ T3-4: VoiceInput 增强 ────────── 无依赖
└── ✅ T3-5: 响应式全覆盖 ───────────── 依赖 T1-3
```

---

## 工时汇总

| Phase | 内容 | 工时 |
|-------|------|------|
| Phase 0 | 安全基线 | 0.5d |
| Phase 1 | 测试 + 响应式 | 5d |
| Phase 2 | 可观测性 + 工程化 | 3d |
| Phase 3 | 体验深度打磨 | 6d |
| **总计** | | **14.5d** |

---

## 不纳入范围（明确排除）

以下项目不在本次改进路线图中：
- Chat 多 LLM 适配层：当前 Ollama 方案满足需求，后续按需扩展
- 退款/争议处理：市场目前无真实支付，暂不需要
- 购物车/优惠券：属于业务增长功能，非工程质量问题
- WebAuthn/Passkey：2FA TOTP 已满足安全需求
- 事件总线重构：当前直接调用耦合可接受，服务规模增长后再做

---

## 验证标准

每个 Task 完成需满足：
1. TypeScript 类型检查通过 (`npx tsc --noEmit`)
2. 相关测试套件通过 (`npx jest --testPathPattern=...`)
3. 无引入新的 lint 警告
4. 功能在浏览器中手动验证通过（含移动端视口）
