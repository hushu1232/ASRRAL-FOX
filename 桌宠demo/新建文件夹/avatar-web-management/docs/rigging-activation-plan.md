# AstralFox Rigging — Python AI 服务激活计划

> 目标：从零构建 `astralfox-rigging` Python FastAPI 微服务，使 web-management 的 AI 骨骼绑定管线全链路可运行。

---

## 1. API 契约（web-management 已实现的调用端）

基于 `src/lib/rigging/client.ts` 分析，Python 服务必须实现以下 8 个端点：

| 方法 | 路径 | 请求体 | 响应 | 超时 |
|------|------|--------|------|------|
| `GET` | `/api/health` | — | `{ status: "ok" }` | 5s |
| `POST` | `/api/upload` | multipart `file` | `{ image_id, filename, size, url }` | 130s |
| `POST` | `/api/separate` | JSON — `image_id, target_layers[], edge_refine` | `SeparateResponse` | 130s |
| `POST` | `/api/rig` | JSON — `image_id, layers[], template, mesh_density` | `RigResponse` | 130s |
| `POST` | `/api/export` | JSON — 骨架+网格+权重+纹理参数 | `ExportResponse` | 130s |
| `GET` | `/api/export/download/{image_id}` | — | ZIP 文件流 | 130s |
| `POST` | `/api/deploy` | JSON — `model_id, anim_params, target_name` | `DeployResponse` | 130s |
| `POST` | `/api/pipeline` | JSON — `image_id, template, mesh_density, auto_deploy, target_name` | `PipelineResponse` | 130s |

### 1.1 请求/响应详细结构

**SeparateRequest:**
```json
{
  "image_id": "string",
  "target_layers": ["hair_back", "body", "hair_front", "face", "eye_L", "eye_R", "eyebrow_L", "eyebrow_R", "mouth", "accessory"],
  "edge_refine": true
}
```

**SeparateResponse:**
```json
{
  "imageId": "string",
  "layers": [
    { "label": "hair_back", "textureUrl": "/api/files/...", "maskUrl": "/api/files/...", "bbox": [0, 0, 200, 300] }
  ],
  "processingTimeMs": 15000
}
```

**RigRequest:**
```json
{
  "image_id": "string",
  "layers": [{"label": "body", "texture_url": "...", "mask_url": "...", "bbox": [0,0,200,300]}],
  "template": "catgirl",
  "mesh_density": "medium"
}
```

**RigResponse:**
```json
{
  "imageId": "string",
  "skeleton": { "name": "root", "position": [0,0], "children": [...] },
  "meshCount": 12,
  "meshes": [{ "label": "body", "vertexCount": 200, "triangleCount": 350, "vertices": [...], "uvs": [...], "indices": [...] }],
  "weights": [{ "label": "body", "boneNames": ["spine"], "vertexCount": 200, "boneCount": 1, "weights": [...] }],
  "processingTimeMs": 30000
}
```

**ExportRequest:**
```json
{
  "image_id": "string",
  "skeleton": { ... },
  "layers": [ ... ],
  "meshes": [ ... ],
  "weights": [ ... ],
  "canvas_width": 3000,
  "canvas_height": 4000,
  "texture_size": 2048,
  "generate_moc3": true
}
```

**ExportResponse:**
```json
{
  "cmo3Url": "/api/files/model.cmo3",
  "moc3Url": "/api/files/model.moc3",
  "model3JsonUrl": "/api/files/model.model3.json",
  "texturesUrls": ["/api/files/tex_0.png", ...],
  "processingTimeMs": 15000
}
```

**DeployRequest:**
```json
{
  "model_id": "string",
  "anim_params": { "idle": { "ParamBreath": 0.5 } },
  "target_name": "my_pet"
}
```

**DeployResponse:**
```json
{
  "modelId": "string",
  "deployedPath": "/path/to/streamingassets/models/my_pet/",
  "reloadTriggered": true,
  "configsWritten": ["model.moc3", "model.model3.json"],
  "processingTimeMs": 3000
}
```

**PipelineResponse:**
```json
{
  "separate": { ...SeparateResponse },
  "rig": { ...RigResponse },
  "export": { ...ExportResponse },
  "deploy": { ...DeployResponse } | null,
  "totalTimeMs": 45000
}
```

### 1.2 错误格式

所有错误使用 FastAPI 标准格式：

```json
{ "detail": "Human-readable error message in English" }
```

HTTP 状态码：422（参数校验）、500（处理失败）、503（GPU 不可用）

---

## 2. Python 服务架构

```
astralfox-rigging/
├── pyproject.toml          # Poetry 依赖管理
├── Dockerfile              # CUDA 12.1 + PyTorch 基础镜像
├── docker-compose.yml      # 本地开发（可选 GPU）
├── .env.example
├── README.md
│
├── api/
│   ├── __init__.py
│   ├── main.py             # FastAPI app 入口
│   ├── dependencies.py     # 依赖注入（模型加载器等）
│   ├── schemas.py          # Pydantic 模型（镜像前端的 types.ts）
│   │
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── health.py       # GET /api/health
│   │   ├── upload.py       # POST /api/upload
│   │   ├── separate.py     # POST /api/separate
│   │   ├── rig.py          # POST /api/rig
│   │   ├── export.py       # POST /api/export + GET download
│   │   ├── deploy.py       # POST /api/deploy
│   │   └── pipeline.py     # POST /api/pipeline（编排上述步骤）
│   │
│   └── middleware/
│       ├── __init__.py
│       ├── timing.py       # 请求计时中间件
│       └── error_handler.py # 统一异常→FastAPI detail 格式
│
├── core/
│   ├── __init__.py
│   ├── config.py           # Settings (pydantic-settings)
│   ├── separation.py       # SAM2 + rembg 图层分离
│   ├── rigging.py          # 骨骼生成 + 蒙皮权重
│   ├── export.py           # Cubism 4 格式导出
│   └── deploy.py           # 文件复制 + Unity 热重载
│
├── models/
│   ├── __init__.py
│   ├── skeleton_templates.py  # 模板骨骼定义（猫娘/女性/男性）
│   └── checkpoints.py         # 模型下载 + 缓存管理
│
├── storage/
│   ├── __init__.py
│   ├── local.py             # 本地文件系统存储
│   └── s3.py                # MinIO/S3 存储（生产）
│
├── tests/
│   ├── conftest.py
│   ├── test_health.py
│   ├── test_upload.py
│   ├── test_separate.py
│   ├── test_rig.py
│   ├── test_export.py
│   ├── test_deploy.py
│   └── test_pipeline.py
│
└── scripts/
    ├── download_models.sh   # 下载所有预训练权重
    └── verify_setup.py      # 环境验证脚本
```

---

## 3. 技术栈与依赖

### 3.1 核心依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `fastapi` | >=0.111 | Web 框架 |
| `uvicorn[standard]` | >=0.30 | ASGI 服务器 |
| `python-multipart` | * | 文件上传 |
| `Pillow` | >=10.3 | 图像处理 |
| `numpy` | >=1.26 | 数值计算 |
| `torch` | >=2.3 | 深度学习运行时 |
| `torchvision` | >=0.18 | 图像变换 |
| `segment-anything` | * | SAM2 分割 |
| `rembg` | >=2.0 | 背景去除 |
| `scipy` | >=1.13 | 网格处理/三角剖分 |
| `scikit-image` | >=0.23 | 形态学操作 |
| `shapely` | >=2.0 | 几何计算 |
| `openmesh` | >=1.3 | 3D 网格处理 |
| `pydantic-settings` | >=2.3 | 配置管理 |
| `httpx` | >=0.27 | 异步 HTTP（测试） |
| `loguru` | >=0.7 | 日志 |
| `prometheus-fastapi-instrumentator` | * | 指标暴露 |

### 3.2 CUDA 要求

| 项 | 最低 | 推荐 |
|----|------|------|
| CUDA 版本 | 11.8 | 12.1+ |
| GPU 显存 | 8 GB | 16 GB+ |
| 驱动版本 | 525.x | 535.x+ |
| PyTorch CUDA | cu118/cu121 | cu121 |

### 3.3 Docker 基础镜像

```dockerfile
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.11 python3.11-dev python3-pip \
    libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY . .
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

---

## 4. 管线阶段算法详解

### 4.1 图层分离（Layer Separation）— 5-20s

**输入：** 原图 PNG/JPEG（最大 10MB，建议 2000x3000+）  
**输出：** 10 个图层 PNG + alpha mask  

**流程：**
1. `rembg` 去除背景 → 全图 alpha mask
2. `SAM2` (sam2_hiera_large) 自动分割：
   - 使用 points prompt（人体关键点启发式规则）
   - 提取头发(后→前)、身体、面部、眼睛(L/R)、眉毛(L/R)、嘴、配饰
3. 边缘细化：
   - 形态学闭运算连接断裂边缘
   - 高斯模糊 + alpha 抠图（closed-form matting）
4. 每层裁剪到 tight bounding box → 保存为 PNG

**模型下载：**
- SAM2: `facebook/sam2-hiera-large` (~224 MB) — HuggingFace
- rembg: `u2net` (~176 MB) — 首次运行自动下载

### 4.2 骨骼绑定（Rigging）— 20-50s

**输入：** 图层列表 + template 选择  
**输出：** 骨骼层级树 + 网格 + 蒙皮权重  

**流程：**
1. **模板匹配** — 从 `skeleton_templates.py` 选择基准骨骼：
   - `catgirl`: 15 根骨骼（头/体/双马尾/手臂×2/腿×2/裙子/尾巴）
   - `human_female`: 18 根骨骼
   - `human_male`: 18 根骨骼
2. **骨骼适配** — 基于图层 bbox 调整骨骼位置：
   - 头部 → face + eyes 中心
   - 身体 → body 轮廓
   - 四肢 → OpenCV 细化算法找中线
3. **网格生成** — 三角剖分：
   - 每层独立 Mesh（低 500△ / 中 1200△ / 高 3000△）
   - Delaunay 三角剖分（均匀采样边界点）
   - 约束 Delaunay（保留轮廓边缘）
4. **蒙皮权重** — 自动绑定：
   - 每个顶点找最近 K=4 根骨骼
   - 基于测地距离的权重衰减
   - 归一化到 sum=1.0

### 4.3 Cubism 导出（Export）— 10-20s

**输入：** 骨架 + 网格 + 权重 + 纹理参数  
**输出：** .moc3 + .model3.json + .physics3.json + 纹理图集  

**流程：**
1. **纹理合并** — 各层纹理拼接为图集（canvas 3000×4000 → texture 2048²）：
   - 贪心装箱算法
   - 各层 UV 坐标重映射到图集空间
2. **.moc3 生成** — 编写 Cubism 4 二进制格式：
   - 骨骼层级 + 默认变形参数
   - 网格顶点数据（位置+UV+索引）
3. **.model3.json** — Live2D Cubism 4 模型描述文件：
   - 引用 .moc3 路径
   - 纹理路径列表
   - 参数组定义（ParamAngleX/Y/Z, ParamBodyAngleX/Y/Z 等）
   - 碰撞检测 + 物理设置
4. **.physics3.json** — 头发/裙子物理参数：
   - 摆锤参数（质量、阻尼、角度限制）
   - 重力 + 风力影响

### 4.4 部署（Deploy）— 2-5s

**输入：** model_id  
**输出：** 文件复制到 Unity StreamingAssets + WebSocket 热重载通知  

**流程：**
1. 复制 .moc3 + .model3.json + textures/ → `StreamingAssets/Models/{target_name}/`
2. 写入 anim config JSON（动画参数覆盖）
3. 通过 WebSocket 通知 Unity Editor/Player 热重载
4. 返回 `{ deployedPath, reloadTriggered }`

---

## 5. 模型下载清单

| 模型 | 大小 | 来源 | 用途 | 缓存路径 |
|------|------|------|------|----------|
| `sam2-hiera-large` | ~224 MB | `facebook/sam2-hiera-large` (HF) | 图层分割 | `~/.cache/rigging/sam2/` |
| `u2net` | ~176 MB | rembg 自动下载 | 背景去除 | `~/.u2net/` |
| `catgirl_template` | ~2 KB | 内置 JSON | 猫娘骨骼模板 | `models/` |
| `human_female_template` | ~2 KB | 内置 JSON | 女性骨骼模板 | `models/` |
| `human_male_template` | ~2 KB | 内置 JSON | 男性骨骼模板 | `models/` |
| **总计** | **~400 MB** | | | |

下载脚本 `scripts/download_models.sh`：
```bash
#!/bin/bash
set -e

# SAM2 checkpoint
HF_HUB_ENABLE_HF_TRANSFER=1 python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('facebook/sam2-hiera-large', local_dir='models/sam2')
"

# rembg 预热（首次运行自动下载 u2net）
python3 -c "from rembg import remove; print('rembg ready')"

echo "All models downloaded."
```

---

## 6. 集成测试策略

### 6.1 契约测试（Web ↔ Rigging）

使用 `pytest` + `httpx` 验证每个端点：

```
tests/
├── conftest.py              # Fixtures: test image, mock template, temp dirs
├── test_health.py           # GET /api/health → 200
├── test_upload.py           # POST /api/upload → image_id
├── test_separate.py         # POST /api/separate → 10 layers
├── test_rig.py              # POST /api/rig → skeleton + meshes + weights
├── test_export.py           # POST /api/export → moc3 + model3.json
├── test_deploy.py           # POST /api/deploy → deployedPath
└── test_pipeline.py         # POST /api/pipeline → full e2e
```

### 6.2 测试数据

- 准备 3 张标准测试插画（猫娘/女性/男性角色，2000×3000 PNG）
- 存在 `tests/fixtures/` 下

### 6.3 CI 集成

GitHub Actions 中单独运行（GPU runner 或 CPU 降级模式）：

```yaml
test-rigging:
  runs-on: [self-hosted, gpu]  # 或 ubuntu-latest + CPU fallback
  steps:
    - uses: actions/checkout@v4
    - run: pip install -e ".[dev]"
    - run: bash scripts/download_models.sh
    - run: pytest tests/ -v --timeout=300
```

### 6.4 负载测试

使用 `k6` 验证并发容量：
- 5 并发上传 → 全部 200
- 3 并发管线 → 排队处理（GPU 串行）
- 健康检查端点 1000 RPS 不降级

---

## 7. 部署与监控

### 7.1 部署检查清单

- [ ] `GET /api/health` 返回 `{"status": "ok"}`
- [ ] `torch.cuda.is_available()` → True（GPU 模式）
- [ ] 磁盘空间 ≥ 50 GB 可用（模型+中间产物）
- [ ] SAM2 checkpoint 存在于 `models/sam2/`
- [ ] 上传测试图片 → 返回 image_id
- [ ] 管线单步测试：separate → rig → export → deploy 逐阶段通过
- [ ] 全链管线：上传 → pipeline → 下载 ZIP → 解压验证文件完整性
- [ ] Unity WebSocket 热重载通知可送达

### 7.2 监控指标

暴露 Prometheus metrics 在 `/api/metrics`：
- `rigging_pipeline_duration_seconds` — 管线总耗时 histogram
- `rigging_stage_duration_seconds{stage}` — 各阶段耗时
- `rigging_upload_size_bytes` — 上传文件大小
- `rigging_gpu_memory_used_bytes` — GPU 显存使用
- `rigging_requests_total{status}` — 请求计数
- `rigging_errors_total{type}` — 错误计数

### 7.3 日志

使用 structlog 输出 JSON：
```json
{"level": "info", "event": "pipeline complete", "image_id": "abc", "total_ms": 45000, "template": "catgirl"}
```

---

## 8. 实施步骤（按依赖顺序）

### Step 1：项目骨架 + 健康检查（0.5天）
- 初始化 Poetry 项目 + FastAPI app
- `GET /api/health` + `GET /api/metrics`
- Dockerfile + docker-compose

### Step 2：图片上传 + 存储（0.5天）
- `POST /api/upload` — 接收 multipart → 本地存储
- `GET /api/files/{path}` — 静态文件服务
- Pillow 格式校验（仅 PNG/JPEG，≤10MB）

### Step 3：图层分离（1.5天）
- SAM2 模型加载 + 推理
- rembg 背景去除
- 10 层分割 + 边缘细化
- `POST /api/separate`

### Step 4：骨骼绑定（2天）
- 3 套模板骨骼定义
- 自适应骨骼位置调整
- Delaunay 网格三角剖分
- 测地距离蒙皮权重
- `POST /api/rig`

### Step 5：Cubism 导出（1.5天）
- 纹理图集打包
- .moc3 二进制编写
- .model3.json + .physics3.json 生成
- ZIP 打包下载
- `POST /api/export` + `GET /api/export/download/{id}`

### Step 6：部署到 Unity（0.5天）
- 文件复制到 StreamingAssets
- WebSocket 热重载通知
- `POST /api/deploy`

### Step 7：全链管线编排（0.5天）
- `POST /api/pipeline` — 串联 separate→rig→export→deploy
- 阶段计时 + 错误传递

### Step 8：集成测试 + 文档（1天）
- pytest 测试套件（8 个端点）
- 手动 E2E 验证
- README + API 文档

**总工时：~8 天**

---

## 9. 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| SAM2 在 8GB GPU 上 OOM | 中 | 支持 CPU 降级模式（慢 10× 但可用），图片自动缩放到 1500px |
| Cubism .moc3 二进制格式不兼容 | 中 | 参考 Live2D Cubism SDK 源码 + 二进制对比验证 |
| 骨骼质量不稳定 | 高 | 3 套模板覆盖主流角色拓扑，提供 manual tune 参数 |
| Unity WebSocket 热重载失败 | 中 | 降级为文件就绪通知，用户手动重启 Unity |
| GPU 驱动版本不匹配 | 低 | Docker 镜像锁定 CUDA 12.1，CI 兼容性矩阵测试 |

---

## 10. 环境变量

```bash
# .env.example
RIGGING_HOST=0.0.0.0
RIGGING_PORT=8001
RIGGING_STORAGE_DIR=/data/rigging
RIGGING_MODELS_DIR=/app/models
RIGGING_MAX_UPLOAD_MB=10
RIGGING_CANVAS_WIDTH=3000
RIGGING_CANVAS_HEIGHT=4000
RIGGING_TEXTURE_SIZE=2048
RIGGING_GPU_ENABLED=true
RIGGING_CPU_FALLBACK=true
RIGGING_UNITY_WS_URL=ws://localhost:3001
RIGGING_LOG_LEVEL=INFO
```

---

> 关联文档：
> - [架构蓝图](architecture-blueprint.md) — 系统整体架构
> - [论坛模块计划](forum-module-plan.md) — Phase 1 技术设计
> - [等级称号系统](level-title-system-plan.md) — 实现计划
