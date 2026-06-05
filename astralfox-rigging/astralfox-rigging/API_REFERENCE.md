# AstralFox Rigging Pipeline API Reference

> 本文档描述微服务的完整接口规范，用于主项目集成。

## Base URL

```
http://localhost:8001
```

## 接口总览

| 方法 | 端点 | 功能 | Content-Type |
|------|------|------|--------------|
| POST | `/api/upload` | 上传图片 | multipart/form-data |
| POST | `/api/separate/` | AI 图层分离 | application/json |
| POST | `/api/rig/` | 骨骼绑定 | application/json |
| POST | `/api/export/` | 导出 Cubism 模型 | application/json |
| GET | `/api/export/download/{id}` | 下载 ZIP 包 | - |
| POST | `/api/deploy/` | 一键部署到 Unity | application/json |
| POST | `/api/pipeline/` | 端到端全流程 | application/json |
| POST | `/api/generate` | ComfyUI 图生图 | multipart/form-data |
| GET | `/api/progress/{id}` | SSE 进度流 | text/event-stream |
| GET | `/api/progress/{id}/status` | 查询进度状态 | - |
| GET | `/api/health` | 健康检查 | - |

---

## 1. 上传图片

### `POST /api/upload`

上传角色立绘图片，返回 image_id 用于后续处理。

**请求：**
```http
POST /api/upload
Content-Type: multipart/form-data

file: <binary>  # PNG/JPG 图片文件
```

**响应：**
```json
{
  "image_id": "c6ceef15288d",
  "filename": "character.png",
  "size": 123456,
  "url": "/static/uploads/c6ceef15288d.png"
}
```

**错误：**
- `422` - 缺少文件参数

---

## 2. AI 图层分离

### `POST /api/separate/`

将上传的图片分离为多个语义图层。

**请求：**
```json
{
  "image_id": "c6ceef15288d",
  "target_layers": ["hair_back", "body", "hair_front", "face", "eye_L", "eye_R", "eyebrow_L", "eyebrow_R", "mouth", "accessory"],
  "edge_refine": true
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image_id | string | 是 | 上传图片返回的 ID |
| target_layers | string[] | 否 | 目标图层列表，默认全部 |
| edge_refine | boolean | 否 | 是否边缘精修，默认 true |

**响应：**
```json
{
  "image_id": "c6ceef15288d",
  "layers": [
    {
      "label": "body",
      "texture_url": "/static/output/c6ceef15288d/layers/body.png",
      "mask_url": "/static/output/c6ceef15288d/layers/body_mask.png",
      "bbox": [100, 200, 800, 1200]
    },
    {
      "label": "face",
      "texture_url": "/static/output/c6ceef15288d/layers/face.png",
      "mask_url": "/static/output/c6ceef15288d/layers/face_mask.png",
      "bbox": [350, 100, 300, 300]
    }
  ],
  "processing_time_ms": 1234.5
}
```

**图层标签说明：**
| 标签 | 说明 |
|------|------|
| hair_back | 后发 |
| body | 身体 |
| hair_front | 前发 |
| face | 脸部 |
| eye_L | 左眼 |
| eye_R | 右眼 |
| eyebrow_L | 左眉 |
| eyebrow_R | 右眉 |
| mouth | 嘴巴 |
| accessory | 装饰 |

**错误：**
- `404` - 图片不存在
- `400` - 图片诊断失败（太小/无前景等）
- `500` - 分离失败

---

## 3. 骨骼绑定

### `POST /api/rig/`

为分离的图层生成骨骼、网格和权重。

**请求：**
```json
{
  "image_id": "c6ceef15288d",
  "layers": [
    {
      "label": "body",
      "texture_url": "/static/output/c6ceef15288d/layers/body.png",
      "mask_url": "/static/output/c6ceef15288d/layers/body_mask.png",
      "bbox": [100, 200, 800, 1200]
    }
  ],
  "template": "catgirl",
  "mesh_density": "medium"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image_id | string | 是 | 图片 ID |
| layers | LayerResult[] | 是 | 分离后的图层数组 |
| template | string | 否 | 骨骼模板，默认 "catgirl" |
| mesh_density | string | 否 | 网格密度：low/medium/high |

**响应：**
```json
{
  "image_id": "c6ceef15288d",
  "skeleton": {
    "name": "root",
    "position": [1500, 2000],
    "children": [
      {
        "name": "body",
        "position": [1500, 2000],
        "children": [...]
      }
    ]
  },
  "mesh_count": 5,
  "meshes": [
    {
      "label": "body",
      "vertex_count": 150,
      "triangle_count": 280,
      "vertices": [[x, y], ...],
      "uvs": [[u, v], ...],
      "indices": [0, 1, 2, ...]
    }
  ],
  "weights": [
    {
      "label": "body",
      "bone_names": ["root", "body", "head"],
      "vertex_count": 150,
      "bone_count": 3,
      "weights": [[{"BoneIndex": 0, "Weight": 0.5}], ...]
    }
  ],
  "processing_time_ms": 567.8
}
```

**骨骼模板：**
| 模板 | 说明 |
|------|------|
| catgirl | 猫娘模板（默认） |
| human_female | 人类女性模板 |
| human_male | 人类男性模板 |

**错误：**
- `500` - 绑定失败（会使用默认回退）

---

## 4. 导出 Cubism 模型

### `POST /api/export/`

导出完整的 Cubism 模型包。

**请求：**
```json
{
  "image_id": "c6ceef15288d",
  "skeleton": {...},
  "layers": [...],
  "meshes": [...],
  "weights": [...],
  "canvas_width": 3000,
  "canvas_height": 4000,
  "texture_size": 2048,
  "generate_moc3": true
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image_id | string | 是 | 图片 ID |
| skeleton | BoneNode | 是 | 骨骼树 |
| layers | LayerResult[] | 是 | 图层数组 |
| meshes | MeshData[] | 否 | 网格数据 |
| weights | WeightData[] | 否 | 权重数据 |
| canvas_width | int | 否 | 画布宽度，默认 3000 |
| canvas_height | int | 否 | 画布高度，默认 4000 |
| texture_size | int | 否 | 纹理尺寸，默认 2048 |
| generate_moc3 | boolean | 否 | 是否生成 .moc3，默认 true |

**响应：**
```json
{
  "cmo3_url": "/static/output/c6ceef15288d/cubism/model.cmo3",
  "moc3_url": "/static/output/c6ceef15288d/cubism/model.moc3",
  "model3_json_url": "/static/output/c6ceef15288d/cubism/model.model3.json",
  "textures_urls": [
    "/static/output/c6ceef15288d/cubism/textures/body.png",
    "/static/output/c6ceef15288d/cubism/textures/face.png"
  ],
  "processing_time_ms": 234.5
}
```

**导出文件清单：**
| 文件 | 说明 |
|------|------|
| model.cmo3 | Cubism Editor 工程文件 |
| model.moc3 | 运行时二进制模型 |
| model.model3.json | SDK 配置文件 |
| model.physics3.json | 物理模拟配置 |
| model.displayinfo3.json | 中文参数名称 |
| model.zip | 全部打包 |
| textures/*.png | 图层纹理 |

---

## 5. 下载模型包

### `GET /api/export/download/{image_id}`

下载导出的模型 ZIP 包。

**请求：**
```http
GET /api/export/download/c6ceef15288d
```

**响应：**
- `200` - 返回 ZIP 文件流
- `404` - 模型不存在

---

## 6. 一键部署

### `POST /api/deploy/`

将模型部署到 AstralFox Unity 桌宠。

**请求：**
```json
{
  "model_id": "c6ceef15288d",
  "anim_params": {
    "idle": {"ParamBreath": {"target": 0.5, "speed": 0.3}},
    "speak": {"ParamMouthOpenY": {"target": 1.0, "speed": 0.5}}
  },
  "target_name": "my_catgirl"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model_id | string | 是 | 导出的模型 ID |
| anim_params | object | 否 | 动画参数覆盖 |
| target_name | string | 否 | 模型名称 |

**响应：**
```json
{
  "model_id": "c6ceef15288d",
  "deployed_path": "Assets/StreamingAssets/AstralFox/Models/my_catgirl",
  "reload_triggered": true,
  "configs_written": ["anim_params.json", "state_machine.json", "lipsync.json"],
  "processing_time_ms": 123.4
}
```

**错误：**
- `404` - 模型文件不存在
- `500` - 部署失败

---

## 7. 端到端全流程

### `POST /api/pipeline/`

一键执行完整流程：分离 → 绑定 → 导出 → 部署。

**请求：**
```json
{
  "image_id": "c6ceef15288d",
  "template": "catgirl",
  "mesh_density": "medium",
  "auto_deploy": false,
  "target_name": null
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image_id | string | 是 | 图片 ID |
| template | string | 否 | 骨骼模板 |
| mesh_density | string | 否 | 网格密度 |
| auto_deploy | boolean | 否 | 是否自动部署 |
| target_name | string | 否 | 部署名称 |

**响应：**
```json
{
  "separate": {...},
  "rig": {...},
  "export": {...},
  "deploy": null,
  "total_time_ms": 5678.9
}
```

**错误：**
- `404` - 图片不存在
- `400` - 图片诊断失败
- `500` - 流程失败（自动回滚清理）

---

## 8. ComfyUI 图生图

### `POST /api/generate`

将角色图片转换为标准解剖学立正位。

**请求：**
```http
POST /api/generate
Content-Type: multipart/form-data

image: <binary>           # 角色图片（必填）
prompt: "blue hair"       # 补充描述（可选）
negative_prompt: ""       # 负向提示（可选）
seed: 42                  # 随机种子（可选，-1 为随机）
```

**响应：**
```json
{
  "image_url": "/output/uploads/anatomical_a1b2c3d4e5f6.png",
  "filename": "anatomical_a1b2c3d4e5f6.png"
}
```

**默认正向提示词：**
```
(masterpiece, best quality:1.2), 1girl, standing, full body,
anatomical standing pose, strictly symmetrical, arms straight down,
legs together, palms facing forward, looking straight ahead, front view,
clean outline, perfect anatomy, symmetric joints, visible joint markers,
detailed body proportions, white background
```

**错误：**
- `400` - 文件类型无效
- `502` - ComfyUI 上传失败
- `504` - 生成超时
- `500` - 生成失败

---

## 9. 实时进度推送

### `GET /api/progress/{image_id}`

SSE (Server-Sent Events) 实时进度流。

**请求：**
```http
GET /api/progress/c6ceef15288d
Accept: text/event-stream
```

**响应（SSE 流）：**
```
data: {"image_id": "c6ceef15288d", "stage": "separate", "status": "started", "progress": 0.0, "message": "正在分离图层..."}

data: {"image_id": "c6ceef15288d", "stage": "separate", "status": "completed", "progress": 0.25, "message": "分离出 8 个图层"}

data: {"image_id": "c6ceef15288d", "stage": "rig", "status": "started", "progress": 0.25, "message": "正在生成骨骼和网格..."}

data: {"image_id": "c6ceef15288d", "stage": "rig", "status": "completed", "progress": 0.50, "message": "生成了 8 个网格"}

data: {"image_id": "c6ceef15288d", "stage": "export", "status": "completed", "progress": 0.75, "message": "导出完成"}

data: {"image_id": "c6ceef15288d", "stage": "pipeline", "status": "completed", "progress": 1.0, "message": "处理完成"}
```

**进度阶段：**
| 阶段 | 说明 |
|------|------|
| separate | 图层分离 |
| rig | 骨骼绑定 |
| export | 模型导出 |
| deploy | 部署 |

**状态值：**
| 状态 | 说明 |
|------|------|
| started | 开始 |
| progress | 进行中 |
| completed | 完成 |
| failed | 失败 |

---

## 10. 查询进度状态

### `GET /api/progress/{image_id}/status`

获取当前进度快照（非流式）。

**响应：**
```json
{
  "image_id": "c6ceef15288d",
  "stage": "rig",
  "status": "completed",
  "progress": 0.50,
  "message": "生成了 8 个网格",
  "timestamp": "2026-05-28T10:30:00"
}
```

---

## 11. 健康检查

### `GET /api/health`

检查服务是否正常运行。

**响应：**
```json
{
  "status": "ok"
}
```

---

## 数据模型

### BoneNode（骨骼节点）
```json
{
  "name": "string",
  "position": [x, y],
  "children": [BoneNode, ...]
}
```

### LayerResult（图层结果）
```json
{
  "label": "string",
  "texture_url": "string",
  "mask_url": "string",
  "bbox": [x, y, w, h]
}
```

### MeshData（网格数据）
```json
{
  "label": "string",
  "vertex_count": 150,
  "triangle_count": 280,
  "vertices": [[x, y], ...],
  "uvs": [[u, v], ...],
  "indices": [0, 1, 2, ...]
}
```

### WeightData（权重数据）
```json
{
  "label": "string",
  "bone_names": ["root", "body", "head"],
  "vertex_count": 150,
  "bone_count": 3,
  "weights": [[{"BoneIndex": 0, "Weight": 0.5}], ...]
}
```

---

## 错误响应格式

### 诊断错误（400）
```json
{
  "error_code": "NO_FOREGROUND",
  "message": "未检测到前景人物，请确保图片中有清晰的角色。",
  "detail": "Foreground too small: 2.1% of image",
  "recoverable": true
}
```

### 服务器错误（500）
```json
{
  "error_code": "UNKNOWN_ERROR",
  "message": "发生未知错误，请重试。",
  "detail": "具体错误信息"
}
```

### 错误码列表
| 错误码 | 说明 | 用户提示 |
|--------|------|----------|
| IMAGE_NOT_FOUND | 图片不存在 | 请重新上传 |
| IMAGE_FORMAT_INVALID | 格式不支持 | 请使用 PNG/JPG |
| IMAGE_TOO_SMALL | 图片太小 | 建议 512x512 以上 |
| IMAGE_TOO_LARGE | 图片太大 | 建议 4096x4096 以内 |
| IMAGE_CORRUPTED | 图片损坏 | 请检查后重新上传 |
| NO_FOREGROUND | 无前景人物 | 请确保有清晰角色 |
| SEPARATION_FAILED | 分离失败 | 图片质量不佳 |
| LAYERS_TOO_FEW | 图层太少 | 无法有效绑定 |
| RIGGING_FAILED | 绑定失败 | 请检查图片 |
| EXPORT_FAILED | 导出失败 | 请重试 |
| DEPLOY_FAILED | 部署失败 | 检查 Unity 路径 |

---

## 集成示例

### Python
```python
import requests

BASE_URL = "http://localhost:8001"

# 1. 上传图片
with open("character.png", "rb") as f:
    resp = requests.post(f"{BASE_URL}/api/upload", files={"file": f})
    image_id = resp.json()["image_id"]

# 2. 运行全流程
resp = requests.post(f"{BASE_URL}/api/pipeline/", json={
    "image_id": image_id,
    "template": "catgirl",
    "auto_deploy": False
})
result = resp.json()

# 3. 下载模型
resp = requests.get(f"{BASE_URL}/api/export/download/{image_id}")
with open("model.zip", "wb") as f:
    f.write(resp.content)
```

### JavaScript
```javascript
const BASE_URL = "http://localhost:8001";

// 上传图片
const formData = new FormData();
formData.append("image", file);
const uploadRes = await fetch(`${BASE_URL}/api/generate`, {
  method: "POST",
  body: formData
});
const { image_url, filename } = await uploadRes.json();

// 监听进度
const eventSource = new EventSource(`${BASE_URL}/api/progress/${imageId}`);
eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  console.log(`${progress.stage}: ${progress.message}`);
};
```

### cURL
```bash
# 上传
curl -X POST http://localhost:8001/api/upload -F "file=@character.png"

# 分离
curl -X POST http://localhost:8001/api/separate/ \
  -H "Content-Type: application/json" \
  -d '{"image_id": "abc123"}'

# 全流程
curl -X POST http://localhost:8001/api/pipeline/ \
  -H "Content-Type: application/json" \
  -d '{"image_id": "abc123", "template": "catgirl"}'

# 下载
curl -O http://localhost:8001/api/export/download/abc123
```

---

## 环境配置

### config.yaml
```yaml
server:
  host: "0.0.0.0"
  port: 8001

comfyui:
  base_url: "http://127.0.0.1:8188"
  timeout: 120

models:
  sam2:
    model_size: "vit_h"
    device: "cuda"

cubism:
  canvas_width: 3000
  canvas_height: 4000
  mesh_density: "medium"
```

### 启动命令
```bash
# 开发环境
uvicorn api.main:app --host 0.0.0.0 --port 8001 --reload

# 生产环境
uvicorn api.main:app --host 0.0.0.0 --port 8001 --workers 4
```
