# DevLog: Phase 1 MVP Launch 完成 — 2026-05-27

## 概述

Phase 1（MVP Launch）全部 5 个子任务完成。项目从 65% → 74% 完成度。用户从注册到拥有一个可以语音对话、会在桌面走动的猫耳桌宠，全链路贯通。

## 环境

- **Web 平台**: Next.js 16 (App Router) + Prisma 7.8 + PostgreSQL/SQLite
- **BFF**: FastAPI (Python 3.12) + WebSocket
- **桌宠客户端**: Unity (Tuanjie 2022.3) + Live2D Cubism 5.3
- **日期**: 2026-05-24 ~ 2026-05-27

## Phase 1 任务清单

| # | 任务 | 状态 | 产出 |
|---|------|------|------|
| 1.1 | CatTail 模型集成到 Unity | 完成 | 8 个文件修改，默认模型切换，Greeting 状态 |
| 1.2 | API Key 配置全链路 | 完成 | /api/pet/sync 端点，PetApiClient 远程配置拉取 |
| 1.3 | 真实 Function Tool 实现 | 完成 | 和风天气 + Bing Search + 内存定时提醒 |
| 1.4 | 通知中心前端 | 完成 | 通知列表页 + 侧边栏入口 + 已读操作 |
| 1.5 | 集成测试与发布准备 | 完成 | Dockerfile ×2 + docker-compose + E2E 测试 |

## 子系统变更摘要

### 1.1 CatTail 模型集成（Unity 客户端）

**问题**: 桌宠使用 Akagi 舰娘人形模型，无法走路/跳跃/做桌宠行为。

**变更**:
- `AppConfig.cs` — 默认模型路径改为 CatTail，角色名"星尘"，猫耳精灵性格
- `FoxParamId.cs` — 参数注释更新为 CatTail 特定映射
- `FoxAnimationController.cs` — 新增 Greeting 动画状态（耳朵竖起+尾巴猛摇+前倾+眯眼），2.5s 自动回 Idle
- `IPetAnimator.cs` / `Live2DAnimator.cs` — PetAnimationState 新增 Greeting
- `FoxSimpleMovement.cs` — Greeting 期间暂停移动
- `PetApiClient.cs` — 新增 FetchSyncConfig() 从远程拉取 API Key 和配置
- `BackendClient.cs` — 新增 OnReminder 事件，处理 reminder WebSocket 消息

### 1.2 API Key 配置全链路

**问题**: BFF 支持真实 API 但 Unity 客户端无法获取解密密钥。

**变更**:
- 新建 `src/app/api/pet/sync/route.ts` — JWT 认证后调用 `petService.exportConfig()`，返回解密后的完整配置（azureSpeechKey, openaiApiKey, modelPath, params, equippedParts, mappedAssets）
- 修改 `src/app/(auth)/dashboard/pet/page.tsx` — 新增首次设置向导（4步骤：下载客户端→配置API Key→命名桌宠→启动），Azure/OpenAI 字段添加 Tooltip 说明费用和获取方式

### 1.3 真实 Function Tool 实现

**问题**: BFF 的 3 个 function tools 全部返回 mock 数据。

**变更**:
- `backend/tools.py` 完全重写：
  - `handle_get_weather(city)` → 和风天气 API（geoapi 城市查询 → devapi 实时天气）
  - `handle_search_web(query)` → Bing Search API v7
  - `handle_set_reminder(title, time)` → asyncio.create_task 定时器，通过 WebSocket 推送提醒
  - 所有工具在 API key 缺失时优雅降级到 mock
  - 提醒回调系统：per-WebSocket register/unregister
- `backend/config.py` — 新增 QWEATHER_API_KEY, BING_SEARCH_API_KEY
- `backend/main.py` — 每连接注册提醒回调，协议文档更新
- `backend/.env.example` — 新增天气/搜索 API Key 获取地址
- `backend/test_ws.py` — 新增 tool_tests()：天气/搜索/提醒/过期时间拒绝/未知工具错误

### 1.4 通知中心前端

**问题**: 通知系统后端完整但用户无可见 UI。

**变更**:
- 新建 `src/app/(auth)/notifications/page.tsx` — 通知列表（分页、类型彩色标签、标记已读、全部已读、点击跳转、相对时间）
- 修改 `src/components/layout/Sidebar.tsx` — 新增铃铛图标"通知"菜单项
- 注：NotificationDropdown 下拉组件已存在无需新建

### 1.5 集成测试与发布准备

**变更**:
- 新建 `backend/Dockerfile` — Python 3.12-slim + ffmpeg + EXPOSE 8765 + healthcheck
- 新建 `docker-compose.yml`（项目根） — postgres:16-alpine + web(Next.js) + bff(Python)
- 新建 `e2e/notifications.spec.ts` — 9 个 Playwright 测试（铃铛可见性/下拉/页面/全部已读/侧边栏/API鉴权）

## 测试结果

### Web 平台
- TypeScript 编译: 0 errors
- 单元测试: 455/455 passed
- E2E 测试: notifications.spec.ts 9/9 passed

### BFF
- WebSocket 测试: 3 组（chat + commands + tools）全部通过
- 工具注册表: 3 工具全部注册，API key 缺失时降级到 mock

### Unity
- 代码审查通过（8 个文件修改）
- Editor Play Mode 需在 Unity Editor 中手动验证（CatTail prefab 完整性、.moc3 参数、动画状态机）

## 关键架构决策 (ADR)

| ADR | 决策 | 原因 |
|-----|------|------|
| 提醒回调架构 | per-WebSocket register_callback(ws_id, callback) | 工具在 LLM service 内执行，需跨上下文投递 WS 消息 |
| PetApiClient 认证 | 复用现有 JWT login/refresh 流程 | 避免引入新的认证通道 |
| CatTail 参数映射 | 基于 Cubism 标准参数约定推断 | .moc3 二进制无法直接读取参数名 |
| 通知页面 | SWR useApiPaginated hook | 遵循项目现有数据获取模式 |

## 已知限制

1. CatTail 模型的 .moc3 参数名未在 Unity Editor 中实测验证
2. 支付系统仍为 mock（Phase 2）
3. 前端组件测试覆盖率低（仅 3 个组件有测试）
4. i18n 翻译覆盖率约 50%
5. 无障碍 ARIA 属性稀缺
