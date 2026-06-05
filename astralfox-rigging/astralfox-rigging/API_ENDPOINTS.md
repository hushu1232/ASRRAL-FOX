# AstralFox Rigging Pipeline - API Endpoints Quick Reference

## 接口流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           主项目集成流程                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────┐
                              │  上传图片  │
                              │ POST     │
                              │ /upload  │
                              └────┬─────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │         选择处理模式           │
                    └──────────────────────────────┘
                           │                │
                           ▼                ▼
                    ┌──────────┐     ┌──────────────┐
                    │ 分步处理  │     │  一键全流程    │
                    └──────────┘     │  POST        │
                           │         │  /pipeline/  │
                           │         └──────┬───────┘
                           │                │
           ┌───────────────┼────────────────┤
           │               │                │
           ▼               ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ 图层分离  │    │ 骨骼绑定  │    │ 模型导出  │
    │ POST     │    │ POST     │    │ POST     │
    │ /separate│    │ /rig/    │    │ /export/ │
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
         └───────────────┴───────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  下载/部署    │
                  │  GET /export/│
                  │  download/id │
                  └──────────────┘
```

---

## 接口清单表

| # | 方法 | 端点 | 功能 | 请求格式 | 响应格式 |
|---|------|------|------|----------|----------|
| 1 | POST | `/api/upload` | 上传图片 | multipart/form-data | JSON |
| 2 | POST | `/api/separate/` | AI 图层分离 | JSON | JSON |
| 3 | POST | `/api/rig/` | 骨骼绑定 | JSON | JSON |
| 4 | POST | `/api/export/` | 导出 Cubism 模型 | JSON | JSON |
| 5 | GET | `/api/export/download/{id}` | 下载 ZIP 包 | - | binary |
| 6 | POST | `/api/deploy/` | 一键部署到 Unity | JSON | JSON |
| 7 | POST | `/api/pipeline/` | 端到端全流程 | JSON | JSON |
| 8 | POST | `/api/generate` | ComfyUI 图生图 | multipart/form-data | JSON |
| 9 | GET | `/api/progress/{id}` | SSE 进度流 | - | text/event-stream |
| 10 | GET | `/api/progress/{id}/status` | 查询进度状态 | - | JSON |
| 11 | GET | `/api/health` | 健康检查 | - | JSON |

---

## 核心接口参数速查

### POST /api/upload
```
Request:  file=<binary>
Response: {image_id, filename, size, url}
```

### POST /api/separate/
```
Request:  {image_id, target_layers?, edge_refine?}
Response: {image_id, layers[], processing_time_ms}
```

### POST /api/rig/
```
Request:  {image_id, layers[], template?, mesh_density?}
Response: {image_id, skeleton, mesh_count, meshes[], weights[], processing_time_ms}
```

### POST /api/export/
```
Request:  {image_id, skeleton, layers[], meshes?, weights?, canvas_width?, canvas_height?, texture_size?, generate_moc3?}
Response: {cmo3_url, moc3_url, model3_json_url, textures_urls[], processing_time_ms}
```

### POST /api/pipeline/
```
Request:  {image_id, template?, mesh_density?, auto_deploy?, target_name?}
Response: {separate, rig, export, deploy, total_time_ms}
```

### POST /api/generate
```
Request:  image=<binary>, prompt?, negative_prompt?, seed?
Response: {image_url, filename}
```

---

## 数据模型

### LayerResult
```json
{
  "label": "body|face|hair_back|hair_front|eye_L|eye_R|eyebrow_L|eyebrow_R|mouth|accessory",
  "texture_url": "/static/output/{id}/layers/{label}.png",
  "mask_url": "/static/output/{id}/layers/{label}_mask.png",
  "bbox": [x, y, w, h]
}
```

### BoneNode
```json
{
  "name": "root|body|head|eye_L|eye_R|...",
  "position": [x, y],
  "children": [BoneNode, ...]
}
```

### MeshData
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

---

## 错误码

| 错误码 | HTTP | 说明 |
|--------|------|------|
| IMAGE_NOT_FOUND | 404 | 图片不存在 |
| IMAGE_FORMAT_INVALID | 400 | 格式不支持 |
| IMAGE_TOO_SMALL | 400 | 图片太小 |
| NO_FOREGROUND | 400 | 无前景人物 |
| SEPARATION_FAILED | 500 | 分离失败 |
| RIGGING_FAILED | 500 | 绑定失败 |
| EXPORT_FAILED | 500 | 导出失败 |

---

## 静态资源路径

| 路径 | 说明 |
|------|------|
| `/static/uploads/{filename}` | 上传的原始图片 |
| `/static/output/{id}/layers/{label}.png` | 分离后的图层纹理 |
| `/static/output/{id}/layers/{label}_mask.png` | 图层遮罩 |
| `/static/output/{id}/cubism/model.cmo3` | Cubism 工程文件 |
| `/static/output/{id}/cubism/model.moc3` | 运行时模型 |
| `/static/output/{id}/cubism/model.model3.json` | SDK 配置 |
| `/static/output/{id}/cubism/model.zip` | 完整打包 |
| `/output/uploads/anatomical_*.png` | 生成的图片 |

---

## 配置项 (config.yaml)

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

astralfox:
  unity_project_path: ""
  websocket_url: "ws://localhost:8080"
```

---

## 快速集成代码

### Python 客户端
```python
import requests

class AstralFoxClient:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url

    def upload(self, filepath):
        with open(filepath, "rb") as f:
            resp = requests.post(f"{self.base_url}/api/upload", files={"file": f})
        return resp.json()

    def pipeline(self, image_id, template="catgirl"):
        resp = requests.post(f"{self.base_url}/api/pipeline/", json={
            "image_id": image_id,
            "template": template
        })
        return resp.json()

    def download(self, image_id, output_path):
        resp = requests.get(f"{self.base_url}/api/export/download/{image_id}")
        with open(output_path, "wb") as f:
            f.write(resp.content)

# 使用
client = AstralFoxClient()
result = client.upload("character.png")
pipeline_result = client.pipeline(result["image_id"])
client.download(result["image_id"], "model.zip")
```

### JavaScript/TypeScript
```typescript
const API_BASE = "http://localhost:8001";

async function uploadImage(file: File): Promise<{image_id: string}> {
  const formData = new FormData();
  formData.append("image", file);
  const resp = await fetch(`${API_BASE}/api/upload`, {method: "POST", body: formData});
  return resp.json();
}

async function runPipeline(imageId: string) {
  const resp = await fetch(`${API_BASE}/api/pipeline/`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({image_id: imageId})
  });
  return resp.json();
}

// SSE 进度监听
function watchProgress(imageId: string, onUpdate: Function) {
  const es = new EventSource(`${API_BASE}/api/progress/${imageId}`);
  es.onmessage = (e) => onUpdate(JSON.parse(e.data));
  es.onerror = () => es.close();
  return es;
}
```
