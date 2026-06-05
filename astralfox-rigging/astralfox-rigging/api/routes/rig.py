"""Bone prediction and rigging API route with fallback mechanisms.

Integrates mesh_generator + bone_predictor + weight_painter
to produce a complete rigged model from separated layers.

Fallback mechanisms:
- Mesh generation failure → use default quad mesh
- Weight painting failure → use default uniform weights
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from PIL import Image

from api.schemas import (
    RigRequest, RigResponse, BoneNode, LayerResult,
    MeshData, WeightData,
)
from api.errors import ErrorCode, get_user_message
from ai_engine.bone_predictor import BonePredictor, flatten_skeleton
from ai_engine.weight_painter import WeightPainter
from cubism_bridge.mesh_generator import MeshGenerator

router = APIRouter()
logger = logging.getLogger(__name__)

_predictor: BonePredictor | None = None


def _get_predictor() -> BonePredictor:
    global _predictor
    if _predictor is None:
        _predictor = BonePredictor()
    return _predictor


def _create_default_mesh(label: str, bbox: list[int]) -> MeshData:
    """Create a default quad mesh as fallback.

    Used when mesh generation fails for a layer.
    """
    x, y, w, h = bbox if bbox and len(bbox) == 4 else [0, 0, 100, 100]

    return MeshData(
        label=label,
        vertex_count=4,
        triangle_count=2,
        vertices=[[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
        uvs=[[0, 0], [1, 0], [1, 1], [0, 1]],
        indices=[0, 1, 2, 0, 2, 3],
    )


def _create_default_weights(label: str, vertex_count: int, skeleton: BoneNode) -> WeightData:
    """Create default uniform weights as fallback.

    Used when weight painting fails.
    """
    bone_names = flatten_skeleton(skeleton)
    bone_count = len(bone_names)

    # Uniform weight distribution to root bone
    weights = [[{"BoneIndex": 0, "Weight": 1.0}] for _ in range(vertex_count)]

    return WeightData(
        label=label,
        bone_names=bone_names,
        vertex_count=vertex_count,
        bone_count=bone_count,
        weights=weights,
    )


@router.post("/", response_model=RigResponse)
async def rig_model(req: RigRequest) -> RigResponse:
    """Generate skeleton, meshes, and weights from separated layers.

    Pipeline:
        1. Predict skeleton from layer bboxes (template-based)
        2. For each layer: generate triangle mesh from mask
        3. For each mesh: compute bone weights
        4. Return complete rig data

    Fallback:
        - If mesh generation fails, use default quad mesh
        - If weight painting fails, use default uniform weights
    """
    t0 = time.perf_counter()

    predictor = _get_predictor()
    mesh_gen = MeshGenerator(density=req.mesh_density.value)
    weight_painter = WeightPainter(falloff=2.0, max_influences=4)

    # Step 1: Predict skeleton (with fallback to default template)
    try:
        skeleton = predictor.predict(layers=req.layers, template=req.template)
    except Exception as e:
        logger.warning(f"Skeleton prediction failed: {e}, using default template")
        skeleton = BonePredictor.get_template(req.template)

    # Step 2: Generate meshes and weights per layer
    meshes: list[MeshData] = []
    weights: list[WeightData] = []
    mesh_warnings: list[str] = []
    weight_warnings: list[str] = []

    for layer in req.layers:
        # Try to generate mesh, fallback to default
        mesh_data = None
        try:
            mesh_data = _generate_mesh_for_layer(layer, mesh_gen)
        except Exception as e:
            mesh_warnings.append(f"Mesh generation failed for {layer.label}: {e}")

        if mesh_data is None:
            logger.warning(f"Using default mesh for {layer.label}")
            mesh_data = _create_default_mesh(layer.label.value, layer.bbox)
            mesh_warnings.append(f"Used default mesh for {layer.label}")

        meshes.append(mesh_data)

        # Try to compute weights, fallback to default
        try:
            vertices = np.array(mesh_data.vertices, dtype=np.float32)
            weight_result = weight_painter.paint_for_layer(
                vertices, skeleton, layer.label.value,
            )
            cubism_weights = weight_result.to_cubism_format()
            weights.append(WeightData(
                label=layer.label.value,
                bone_names=weight_result.bone_names,
                vertex_count=weight_result.vertex_count,
                bone_count=weight_result.bone_count,
                weights=cubism_weights["Weights"],
            ))
        except Exception as e:
            logger.warning(f"Weight painting failed for {layer.label}: {e}, using defaults")
            default_weights = _create_default_weights(
                layer.label.value, mesh_data.vertex_count, skeleton
            )
            weights.append(default_weights)
            weight_warnings.append(f"Used default weights for {layer.label}")

    # Log warnings
    for w in mesh_warnings + weight_warnings:
        logger.warning(f"[{req.image_id}] {w}")

    elapsed = (time.perf_counter() - t0) * 1000
    return RigResponse(
        image_id=req.image_id,
        skeleton=skeleton,
        mesh_count=len(meshes),
        meshes=meshes,
        weights=weights,
        processing_time_ms=round(elapsed, 1),
    )


def _generate_mesh_for_layer(
    layer: LayerResult,
    mesh_gen: MeshGenerator,
) -> MeshData | None:
    """Generate mesh data for a single layer from its mask."""
    # Load mask
    mask_path = layer.mask_url.lstrip("/")
    if mask_path.startswith("static/"):
        mask_path = mask_path

    # Try to load the actual mask file
    full_path = Path(mask_path)
    if not full_path.exists():
        # Try relative to output dir
        full_path = Path("output") / mask_path.replace("static/output/", "")

    if not full_path.exists():
        return None

    mask = np.array(Image.open(full_path).convert("L"))

    # Check mask has enough content
    if np.sum(mask > 128) < 50:
        return None

    # Generate mesh
    mesh = mesh_gen.generate(mask)

    return MeshData(
        label=layer.label.value,
        vertex_count=mesh.vertex_count,
        triangle_count=mesh.triangle_count,
        vertices=mesh.vertices.tolist(),
        uvs=mesh.uvs.tolist(),
        indices=mesh.triangles.flatten().tolist(),
    )
