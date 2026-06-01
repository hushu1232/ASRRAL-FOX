# 桌宠 Web 预览 — 本地测试指南

## 前提条件

在开始前，确保以下服务已启动：

| 服务 | 默认地址 | 用途 | 必需 |
|------|----------|------|------|
| avatar-web-management | localhost:3000 | BFF + Web UI | 是 |
| Ollama | localhost:11434 | LLM 对话 | 是 |
| GPT-SoVITS | localhost:8002 | TTS 语音合成 | 否（可降级） |
| PostgreSQL | localhost:5432 | 数据持久化 | 是 |
| Redis | localhost:6379 | 缓存/限流 | 是 |

## 快速启动

```bash
# 1. 确保 Ollama 运行并已拉取模型
ollama pull qwen2.5:latest
ollama serve

# 2. 启动基础设施（PostgreSQL + Redis + MinIO）
cd avatar-web-management
docker compose up -d postgres redis minio

# 3. 运行数据库迁移
npx prisma migrate deploy

# 4. 启动开发服务器
npm run dev

# 5. 可选：启动 GPT-SoVITS（GPU 需要）
docker compose --profile gpu up -d gpt-sovits
```

## 环境变量

在 `.env` 中配置：

```env
# LLM
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:latest
OLLAMA_TIMEOUT_MS=30000

# TTS (可选)
GPT_SOVITS_URL=http://localhost:8002
```

## 测试流程

### 1. 登录

访问 `http://localhost:3000/login`，使用测试账号登录。

### 2. 配置桌宠

进入 `/dashboard/pet`，设置：
- 性格描述
- 背景故事
- 动画模型：Live2D
- 模型路径：`/models/CatTail/cattail.model3.json`（或使用示例路径）

### 3. 打开预览

进入 `/preview/pet`，确认：
- 左侧显示 Live2D 模型（如果模型路径有效）
- 右侧显示对话面板
- 底部有输入框和发送按钮

### 4. 文字对话测试

1. 在输入框输入"你好" → 按 Enter
2. 观察：用户消息以蓝色气泡显示在右侧
3. 等待 1-3 秒：顶部显示"思考中..."
4. LLM 回复以气泡形式显示，带情绪标签
5. 状态变为"说话中..."，模型口型动画播放（如果有 TTS）

### 5. 语音输入测试

1. 点击麦克风按钮
2. 浏览器弹出权限请求 → 允许
3. 说话（例如"你好星尘"）
4. 识别文字实时显示在输入区
5. 停止说话后自动发送
6. 如果不支持语音识别，确认麦克风按钮不显示，文字输入正常

### 6. 情绪切换测试

发送以下消息验证情绪解析：
- "讲个笑话" → 期望 [happy]
- "我今天很难过" → 期望 [sad] 或 [shy]
- "你太讨厌了" → 期望 [angry] 或 [shy]
- "今天星期几" → 期望 [neutral]

### 7. 降级测试

1. 停止 Ollama：确认错误消息"AI 大脑暂时短路了"
2. 停止 GPT-SoVITS：确认 TTS 降级到浏览器语音合成（如果浏览器支持）
3. 刷新页面：清空对话历史

### 8. 响应式测试

1. 缩小浏览器窗口宽度至 768px 以下
2. 确认模型区域和对话面板自适应布局

## 常见问题

| 问题 | 解决方案 |
|------|---------|
| "Ollama 请求超时" | 检查 Ollama 是否运行，模型是否已拉取 |
| Live2D 模型不显示 | 检查 modelPath 是否指向有效的 .model3.json |
| 语音识别不支持 | 使用 Chrome/Edge，Safari/Firefox 不支持 SpeechRecognition |
| TTS 无声音 | 检查 GPT-SoVITS 服务状态，或确认浏览器自动播放未被阻止 |
