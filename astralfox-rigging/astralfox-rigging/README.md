# AstralFox Rigging Pipeline

AI-powered rigging pipeline that converts a single character illustration into a fully rigged Live2D model for the AstralFox desktop pet.

## Overview

AstralFox Rigging Pipeline automates the entire process of creating Live2D models:

```
Input Image → AI Layer Separation → Smart Rigging → Cubism Export → Deploy to Desktop Pet
```

### Key Features

- **AI Layer Separation**: Automatically splits a character illustration into 8-10 labeled layers (hair, face, eyes, body, etc.)
- **Smart Bone Prediction**: Template-based skeleton that adapts to different character proportions
- **Automatic Weight Painting**: Heat diffusion algorithm for smooth mesh deformation
- **Cubism Format Support**: Generates .moc3, .model3.json, .cmo3, and .physics3.json files
- **One-Click Deploy**: Direct integration with AstralFox Unity desktop pet
- **Real-Time Progress**: SSE-based progress updates for long-running operations

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       FastAPI Application                        │
├───────────┬───────────┬───────────┬───────────┬─────────────────┤
│  Separate │    Rig    │   Export  │   Deploy  │    Pipeline     │
│  /api/    │   /api/   │   /api/   │   /api/   │    /api/        │
│ separate  │    rig    │   export  │   deploy  │   pipeline      │
└───────────┴───────────┴───────────┴───────────┴─────────────────┘
      │           │           │           │
      ▼           ▼           ▼           ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ AI Engine │ │ AI Engine │ │  Cubism   │ │  Deploy   │
│ Separator │ │ Predictor │ │  Bridge   │ │  Module   │
│ Classifier│ │  Painter  │ │  Writer   │ │  Adapter  │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
```

## Modules

### API Layer (`api/`)

| Module | Description |
|--------|-------------|
| `main.py` | FastAPI application entry point, middleware, static files |
| `schemas.py` | Pydantic models for request/response validation |
| `routes/separate.py` | Layer separation endpoint |
| `routes/rig.py` | Bone prediction and weight painting endpoint |
| `routes/export.py` | Cubism format export endpoint |
| `routes/deploy.py` | One-click deploy endpoint |
| `routes/pipeline.py` | End-to-end pipeline with error recovery |
| `progress.py` | SSE-based real-time progress notifications |

### AI Engine (`ai_engine/`)

| Module | Description |
|--------|-------------|
| `layer_separator.py` | Image segmentation using SAM2 or rembg fallback |
| `semantic_classifier.py` | Classify masks into body part labels |
| `bone_predictor.py` | Template-based skeleton prediction |
| `weight_painter.py` | Heat diffusion weight painting |
| `expression_generator.py` | Geometric expression morph targets |

### Cubism Bridge (`cubism_bridge/`)

| Module | Description |
|--------|-------------|
| `cmo3_writer.py` | Generate .cmo3 and .model3.json files |
| `moc3_encoder.py` | Encode .moc3 binary format |
| `physics_config.py` | Generate .physics3.json for hair/tail physics |
| `mesh_generator.py` | Delaunay triangulation mesh generation |

### Deploy (`deploy/`)

| Module | Description |
|--------|-------------|
| `deployer.py` | Copy files to Unity and trigger hot reload |
| `validator.py` | Validate model files before deployment |

### AstralFox Adapter (`astralfox_adapter/`)

| Module | Description |
|--------|-------------|
| `param_mapper.py` | Map Cubism parameters to animation states |
| `anim_state_machine.py` | Animation state machine configuration |
| `lip_sync_config.py` | Lip sync parameter configuration |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload a character illustration |
| `POST` | `/api/separate/` | Separate image into labeled layers |
| `POST` | `/api/rig/` | Generate skeleton, meshes, and weights |
| `POST` | `/api/export/` | Export Cubism model package |
| `POST` | `/api/deploy/` | Deploy to AstralFox desktop pet |
| `POST` | `/api/pipeline/` | Run full pipeline end-to-end |
| `GET` | `/api/progress/{id}` | SSE stream for progress updates |
| `GET` | `/api/health` | Health check |

## Quick Start

### Prerequisites

- Python 3.10+
- CUDA-capable GPU (optional, for AI models)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/astralfox-rigging.git
cd astralfox-rigging

# Install dependencies
pip install -r requirements.txt

# Optional: Install SAM2 for better segmentation
pip install git+https://github.com/facebookresearch/sam2.git
```

### Running the Server

```bash
# Start the API server
uvicorn api.main:app --host 0.0.0.0 --port 8001

# Or with auto-reload for development
uvicorn api.main:app --host 0.0.0.0 --port 8001 --reload
```

### Using the Web UI

```bash
# Start the Gradio interface
python -m ui.app
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker compose up --build
```

## Usage Example

### Python API Client

```python
import requests

API_BASE = "http://localhost:8001"

# 1. Upload image
with open("character.png", "rb") as f:
    resp = requests.post(f"{API_BASE}/api/upload", files={"file": f})
    image_id = resp.json()["image_id"]

# 2. Run full pipeline
resp = requests.post(f"{API_BASE}/api/pipeline/", json={
    "image_id": image_id,
    "template": "catgirl",
    "mesh_density": "medium",
})
result = resp.json()

# 3. Download exported model
resp = requests.get(f"{API_BASE}/api/export/download/{image_id}")
with open("model.zip", "wb") as f:
    f.write(resp.content)
```

### cURL

```bash
# Upload
curl -X POST http://localhost:8001/api/upload \
  -F "file=@character.png"

# Run pipeline
curl -X POST http://localhost:8001/api/pipeline/ \
  -H "Content-Type: application/json" \
  -d '{"image_id": "abc123", "template": "catgirl"}'

# Download
curl -O http://localhost:8001/api/export/download/abc123
```

## Configuration

Edit `config.yaml` to customize:

```yaml
server:
  host: "0.0.0.0"
  port: 8001

models:
  sam2:
    model_size: "vit_h"
    device: "cuda"

cubism:
  canvas_width: 3000
  canvas_height: 4000
  mesh_density: "medium"

physics:
  hair_stiffness: 0.5
  tail_stiffness: 0.3
```

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=.

# Run specific test file
pytest tests/test_cubism.py -v
```

## License

This project is proprietary software. See [NOTICE.md](NOTICE.md) for third-party open source licenses.

## Acknowledgments

- [Live2D Cubism SDK](https://www.live2d.com/en/sdk/) - Model format specifications
- [SAM 2](https://github.com/facebookresearch/sam2) - Image segmentation
- [FastAPI](https://fastapi.tiangolo.com/) - Web framework
- [Gradio](https://gradio.app/) - Web UI framework
