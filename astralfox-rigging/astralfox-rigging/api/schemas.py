"""Pydantic models for API request/response schemas.

This module defines the data models for the AstralFox Rigging Pipeline API.
All request/response types use Pydantic v2 for validation and serialization.

Key components:
    - LayerLabel: Semantic labels for character body parts
    - MeshDensity: Control triangle mesh resolution
    - AnimState: Animation states for the desktop pet
    - Request/Response models for each pipeline stage
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────

class LayerLabel(str, Enum):
    HAIR_BACK = "hair_back"
    BODY = "body"
    HAIR_FRONT = "hair_front"
    FACE = "face"
    EYE_L = "eye_L"
    EYE_R = "eye_R"
    EYEBROW_L = "eyebrow_L"
    EYEBROW_R = "eyebrow_R"
    MOUTH = "mouth"
    ACCESSORY = "accessory"


class MeshDensity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AnimState(str, Enum):
    IDLE = "idle"
    LISTEN = "listen"
    SPEAK = "speak"
    SLEEP = "sleep"
    DRAG = "drag"
    GREET = "greet"


# ── Layer Separation ───────────────────────────────────────────────

class SeparateRequest(BaseModel):
    """Request to separate an image into layers."""
    image_id: str = Field(description="Previously uploaded image ID")
    target_layers: list[LayerLabel] = Field(
        default_factory=lambda: list(LayerLabel),
        description="Layers to extract",
    )
    edge_refine: bool = Field(default=True, description="Apply alpha matting")


class LayerResult(BaseModel):
    label: LayerLabel
    texture_url: str = Field(description="URL to download the layer PNG")
    mask_url: str = Field(description="URL to download the raw mask")
    bbox: list[int] = Field(description="[x, y, w, h]")


class SeparateResponse(BaseModel):
    image_id: str
    layers: list[LayerResult]
    processing_time_ms: float


# ── Bone Prediction ───────────────────────────────────────────────

class BoneNode(BaseModel):
    name: str
    position: list[float] = Field(description="[x, y] in canvas coords")
    children: list[BoneNode] = Field(default_factory=list)


class RigRequest(BaseModel):
    image_id: str
    layers: list[LayerResult]
    template: str = Field(default="catgirl", description="Rigging template")
    mesh_density: MeshDensity = MeshDensity.MEDIUM


class MeshData(BaseModel):
    """Mesh data for a single layer."""
    label: str
    vertex_count: int
    triangle_count: int
    vertices: list[list[float]] = Field(description="[[x,y], ...] vertex positions")
    uvs: list[list[float]] = Field(description="[[u,v], ...] texture coordinates")
    indices: list[int] = Field(description="Triangle vertex indices (flat)")


class WeightData(BaseModel):
    """Weight data for a single layer's mesh."""
    label: str
    bone_names: list[str]
    vertex_count: int
    bone_count: int
    weights: list[list[dict]] = Field(
        description="Per-vertex sparse weights: [[{BoneIndex, Weight}, ...], ...]"
    )


class RigResponse(BaseModel):
    image_id: str
    skeleton: BoneNode
    mesh_count: int
    meshes: list[MeshData] = Field(default_factory=list)
    weights: list[WeightData] = Field(default_factory=list)
    processing_time_ms: float


# ── Export ─────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    image_id: str
    skeleton: BoneNode
    layers: list[LayerResult]
    meshes: list[MeshData] = Field(default_factory=list)
    weights: list[WeightData] = Field(default_factory=list)
    canvas_width: int = 3000
    canvas_height: int = 4000
    texture_size: int = 2048
    generate_moc3: bool = True


class ExportResponse(BaseModel):
    cmo3_url: str
    moc3_url: Optional[str] = None
    model3_json_url: str
    textures_urls: list[str]
    processing_time_ms: float


# ── Deploy ─────────────────────────────────────────────────────────

class DeployRequest(BaseModel):
    model_id: str = Field(description="Exported model ID")
    anim_params: dict[AnimState, dict] = Field(
        default_factory=dict,
        description="Per-state parameter overrides",
    )
    target_name: Optional[str] = Field(
        default=None,
        description="Name for the model in AstralFox",
    )


class DeployResponse(BaseModel):
    model_id: str
    deployed_path: str
    reload_triggered: bool
    configs_written: list[str] = Field(default_factory=list)
    processing_time_ms: float


# ── Pipeline (end-to-end) ─────────────────────────────────────────

class PipelineRequest(BaseModel):
    """Full pipeline: upload image → separate → rig → export → deploy."""
    image_id: str
    template: str = "catgirl"
    mesh_density: MeshDensity = MeshDensity.MEDIUM
    auto_deploy: bool = False
    target_name: Optional[str] = None


class PipelineResponse(BaseModel):
    separate: SeparateResponse
    rig: RigResponse
    export: ExportResponse
    deploy: Optional[DeployResponse] = None
    total_time_ms: float
