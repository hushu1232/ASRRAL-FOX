"""Pydantic schemas — mirror of web-management's src/lib/rigging/types.ts."""

from pydantic import BaseModel, Field
from typing import Optional


# ── Enums ──────────────────────────────────────────────

LayerLabel = str  # 'hair_back' | 'body' | 'hair_front' | 'face' | ...
MeshDensity = str  # 'low' | 'medium' | 'high'
PipelineStage = str  # 'uploading' | 'separating' | 'rigging' | 'exporting' | 'deploying' | 'pulling_assets'


# ── Sub-types ──────────────────────────────────────────

class LayerResult(BaseModel):
    label: str
    texture_url: str
    mask_url: str
    bbox: tuple[float, float, float, float]


class BoneNode(BaseModel):
    name: str
    position: tuple[float, float]
    children: list["BoneNode"] = []


class MeshData(BaseModel):
    label: str
    vertex_count: int
    triangle_count: int
    vertices: list[tuple[float, float]]
    uvs: list[tuple[float, float]]
    indices: list[int]


class WeightData(BaseModel):
    label: str
    bone_names: list[str]
    vertex_count: int
    bone_count: int
    weights: list[list[dict[str, float]]]


# ── Request schemas ────────────────────────────────────

class SeparateRequest(BaseModel):
    image_id: str
    target_layers: list[str] = [
        "hair_back", "body", "hair_front", "face",
        "eye_L", "eye_R", "eyebrow_L", "eyebrow_R",
        "mouth", "accessory",
    ]
    edge_refine: bool = True


class RigRequest(BaseModel):
    image_id: str
    layers: list[dict]
    template: str = "catgirl"
    mesh_density: str = "medium"


class ExportRequest(BaseModel):
    image_id: str
    skeleton: dict
    layers: list[dict]
    meshes: list[dict]
    weights: list[dict]
    canvas_width: int = 3000
    canvas_height: int = 4000
    texture_size: int = 2048
    generate_moc3: bool = True


class DeployRequest(BaseModel):
    model_id: str
    anim_params: dict = {}
    target_name: Optional[str] = None


class PipelineRequest(BaseModel):
    image_id: str
    template: str = "catgirl"
    mesh_density: str = "medium"
    auto_deploy: bool = False
    target_name: Optional[str] = None


# ── Response schemas ───────────────────────────────────

class UploadResponse(BaseModel):
    image_id: str
    filename: str
    size: int
    url: str


class SeparateResponse(BaseModel):
    image_id: str
    layers: list[LayerResult]
    processing_time_ms: int


class RigResponse(BaseModel):
    image_id: str
    skeleton: BoneNode
    mesh_count: int
    meshes: list[dict]
    weights: list[dict]
    processing_time_ms: int


class ExportResponse(BaseModel):
    cmo3_url: str
    moc3_url: Optional[str] = None
    model3_json_url: str
    textures_urls: list[str]
    processing_time_ms: int


class DeployResponse(BaseModel):
    model_id: str
    deployed_path: str
    reload_triggered: bool
    configs_written: list[str]
    processing_time_ms: int


class PipelineResponse(BaseModel):
    separate: dict
    rig: dict
    export: dict
    deploy: Optional[dict] = None
    total_time_ms: int


class HealthResponse(BaseModel):
    status: str
    version: str
    gpu_available: bool
