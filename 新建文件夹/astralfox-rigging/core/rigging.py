"""CPU mock rigging — skeleton generation + mesh creation + weight assignment."""

import time
import numpy as np
from PIL import Image
from io import BytesIO
from loguru import logger

from api.dependencies import get_storage
from core.config import settings

# ── Standard Live2D skeleton ──────────────────────────

STANDARD_SKELETON = {
    "name": "root",
    "position": (0.5, 1.0),
    "children": [
        {
            "name": "hip",
            "position": (0.5, 0.75),
            "children": [
                {
                    "name": "spine",
                    "position": (0.5, 0.55),
                    "children": [
                        {
                            "name": "chest",
                            "position": (0.5, 0.38),
                            "children": [
                                {
                                    "name": "neck",
                                    "position": (0.5, 0.25),
                                    "children": [
                                        {"name": "head", "position": (0.5, 0.12), "children": [
                                            {"name": "eye_L", "position": (0.42, 0.15), "children": []},
                                            {"name": "eye_R", "position": (0.58, 0.15), "children": []},
                                            {"name": "eyebrow_L", "position": (0.42, 0.10), "children": []},
                                            {"name": "eyebrow_R", "position": (0.58, 0.10), "children": []},
                                            {"name": "mouth", "position": (0.5, 0.22), "children": []},
                                        ]},
                                    ],
                                },
                            ],
                        },
                        {
                            "name": "clavicle_L",
                            "position": (0.38, 0.36),
                            "children": [
                                {"name": "upper_arm_L", "position": (0.28, 0.42), "children": [
                                    {"name": "forearm_L", "position": (0.18, 0.55), "children": [
                                        {"name": "hand_L", "position": (0.12, 0.65), "children": []},
                                    ]},
                                ]},
                            ],
                        },
                        {
                            "name": "clavicle_R",
                            "position": (0.62, 0.36),
                            "children": [
                                {"name": "upper_arm_R", "position": (0.72, 0.42), "children": [
                                    {"name": "forearm_R", "position": (0.82, 0.55), "children": [
                                        {"name": "hand_R", "position": (0.88, 0.65), "children": []},
                                    ]},
                                ]},
                            ],
                        },
                    ],
                },
                {
                    "name": "upper_leg_L",
                    "position": (0.42, 0.82),
                    "children": [
                        {"name": "lower_leg_L", "position": (0.40, 0.93), "children": [
                            {"name": "foot_L", "position": (0.38, 0.98), "children": []},
                        ]},
                    ],
                },
                {
                    "name": "upper_leg_R",
                    "position": (0.58, 0.82),
                    "children": [
                        {"name": "lower_leg_R", "position": (0.60, 0.93), "children": [
                            {"name": "foot_R", "position": (0.62, 0.98), "children": []},
                        ]},
                    ],
                },
            ],
        },
    ],
}

# Layer → responsible bone mapping
LAYER_BONE_MAP = {
    "body":       ["spine", "chest", "hip"],
    "face":       ["head", "neck"],
    "hair_back":  ["head"],
    "hair_front": ["head"],
    "eye_L":      ["eye_L"],
    "eye_R":      ["eye_R"],
    "eyebrow_L":  ["eyebrow_L"],
    "eyebrow_R":  ["eyebrow_R"],
    "mouth":      ["mouth"],
    "accessory":  ["head"],
}


def _flatten_bones(node: dict) -> list[dict]:
    """Flatten skeleton tree into list with parent refs."""
    bones = []
    def walk(n, parent=None):
        bones.append({"name": n["name"], "position": n["position"], "parent": parent})
        for child in n.get("children", []):
            walk(child, n["name"])
    walk(node)
    return bones


def _bone_positions() -> dict[str, tuple[float, float]]:
    """Return flat bone name → position map."""
    bones = _flatten_bones(STANDARD_SKELETON)
    return {b["name"]: b["position"] for b in bones}


def _generate_mesh(label: str, bbox: tuple[int, int, int, int],
                   canvas_w: int, canvas_h: int) -> dict:
    """Create a simple quad mesh for a layer."""
    x, y, w, h = bbox
    # Normalised coords
    nx, ny = x / canvas_w, y / canvas_h
    nw, nh = w / canvas_w, h / canvas_h

    vertices = [
        (nx, ny),
        (nx + nw, ny),
        (nx + nw, ny + nh),
        (nx, ny + nh),
    ]
    uvs = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    indices = [0, 1, 2, 0, 2, 3]

    return {
        "label": label,
        "vertex_count": len(vertices),
        "triangle_count": len(indices) // 3,
        "vertices": vertices,
        "uvs": uvs,
        "indices": indices,
    }


def _generate_weights(label: str, vertices: list[tuple[float, float]],
                      bone_map: dict[str, tuple[float, float]]) -> dict:
    """Assign per-vertex bone weights based on distance to bones."""
    target_bones = LAYER_BONE_MAP.get(label, ["spine"])

    weights = []
    for vx, vy in vertices:
        dists = {}
        for bname in target_bones:
            bx, by = bone_map.get(bname, (0.5, 0.5))
            dist = ((vx - bx) ** 2 + (vy - by) ** 2) ** 0.5
            dists[bname] = max(dist, 0.001)

        total = sum(1.0 / d for d in dists.values())
        vertex_weights = [{"bone": b, "weight": (1.0 / d) / total} for b, d in dists.items()]
        weights.append(vertex_weights)

    return {
        "label": label,
        "bone_names": target_bones,
        "vertex_count": len(vertices),
        "bone_count": len(target_bones),
        "weights": weights,
    }


def rig_layers(
    image_id: str,
    layers: list[dict],
    template: str = "catgirl",
    mesh_density: str = "medium",
) -> dict:
    """
    Generate skeleton, meshes, and weights from separated layers.

    Returns dict with skeleton, meshes, weights, processing_time_ms.
    """
    start = time.perf_counter()
    storage = get_storage()

    # Get canvas size from original image
    import os
    img_dir = storage._safe_path(f"images/{image_id}")
    files = [f for f in os.listdir(img_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    if not files:
        raise FileNotFoundError(f"No image found for {image_id}")

    raw = storage.download(f"images/{image_id}/{files[0]}")
    img = Image.open(BytesIO(raw))
    canvas_w, canvas_h = img.size

    bone_pos = _bone_positions()
    meshes = []
    weight_list = []

    for layer in layers:
        label = layer["label"]
        bbox = tuple(layer["bbox"])

        mesh = _generate_mesh(label, bbox, canvas_w, canvas_h)
        meshes.append(mesh)

        wdata = _generate_weights(label, mesh["vertices"], bone_pos)
        weight_list.append(wdata)

    skeleton = STANDARD_SKELETON

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    logger.info(f"rigged {len(layers)} layers in {elapsed_ms}ms (template={template}, density={mesh_density})")

    return {
        "image_id": image_id,
        "skeleton": skeleton,
        "mesh_count": len(meshes),
        "meshes": meshes,
        "weights": weight_list,
        "processing_time_ms": elapsed_ms,
    }
