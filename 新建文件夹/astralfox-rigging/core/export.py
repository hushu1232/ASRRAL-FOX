"""Cubism model export — mock moc3 + real model3.json + texture collection."""

import json
import time
import struct
from io import BytesIO
from loguru import logger

from api.dependencies import get_storage


def _generate_model3_json(
    image_id: str,
    skeleton: dict,
    meshes: list[dict],
    weights: list[dict],
    texture_urls: list[str],
    canvas_width: int,
    canvas_height: int,
) -> bytes:
    """Generate a Cubism model3.json metadata file."""
    doc = {
        "Version": 3,
        "FileReferences": {
            "Moc": f"{image_id}.moc3",
            "Textures": [f"textures/{i:03d}.png" for i in range(len(texture_urls))],
            "Physics": f"{image_id}.physics3.json",
            "DisplayInfo": f"{image_id}.cdi3.json",
        },
        "Groups": [
            {
                "Target": "Parameter",
                "Name": "ParamBodyAngleX",
                "Ids": ["ParamBodyAngleX"],
            },
            {
                "Target": "Parameter",
                "Name": "ParamBodyAngleY",
                "Ids": ["ParamBodyAngleY"],
            },
            {
                "Target": "Parameter",
                "Name": "ParamEyeBallX",
                "Ids": ["ParamEyeBallX"],
            },
            {
                "Target": "Parameter",
                "Name": "ParamEyeBallY",
                "Ids": ["ParamEyeBallY"],
            },
            {
                "Target": "Parameter",
                "Name": "ParamAngleZ",
                "Ids": ["ParamAngleZ"],
            },
            {
                "Target": "Parameter",
                "Name": "ParamEyeLOpen",
                "Ids": ["ParamEyeLOpen"],
            },
            {
                "Target": "Parameter",
                "Name": "ParamEyeROpen",
                "Ids": ["ParamEyeROpen"],
            },
            {
                "Target": "Parameter",
                "Name": "ParamMouthOpenY",
                "Ids": ["ParamMouthOpenY"],
            },
            {
                "Target": "Parameter",
                "Name": "ParamBreath",
                "Ids": ["ParamBreath"],
            },
        ],
        "HitAreas": [],
        "CanvasSize": {
            "Width": canvas_width,
            "Height": canvas_height,
        },
    }
    return json.dumps(doc, indent=2, ensure_ascii=False).encode("utf-8")


def _generate_mock_moc3() -> bytes:
    """Generate a minimal valid moc3 placeholder.

    Real moc3 is a proprietary binary format. This creates a placeholder
    that Unity's Cubism SDK can detect as "needs regeneration."
    """
    buf = BytesIO()
    # Magic header
    buf.write(b"MOC3")
    buf.write(struct.pack("<I", 3))  # version 3
    buf.write(struct.pack("<I", 0))  # flags
    buf.write(struct.pack("<I", 1))  # part count (placeholder)
    buf.write(struct.pack("<I", 0))  # parameter count
    buf.write(struct.pack("<I", 0))  # part opacity count
    buf.write(struct.pack("<I", 0))  # deformers count
    buf.write(struct.pack("<I", 0))  # artmesh count
    return buf.getvalue()


def _generate_mock_physics3(image_id: str) -> bytes:
    """Generate a minimal physics3.json file."""
    doc = {
        "Version": 3,
        "Meta": {
            "PhysicsSettingCount": 1,
            "TotalInputCount": 1,
            "TotalOutputCount": 1,
            "VertexCount": 0,
            "EffectiveForces": {
                "Gravity": {"X": 0, "Y": -1},
                "Wind": {"X": 0, "Y": 0},
            },
            "PhysicsDictionary": [
                {"Id": f"{image_id}_physics", "Name": "Default Physics"},
            ],
        },
        "PhysicsSettings": [],
    }
    return json.dumps(doc, indent=2).encode("utf-8")


def export_model(
    image_id: str,
    skeleton: dict,
    layers: list[dict],
    meshes: list[dict],
    weights: list[dict],
    canvas_width: int = 3000,
    canvas_height: int = 4000,
    texture_size: int = 2048,
    generate_moc3: bool = True,
) -> dict:
    """Export Cubism model artifacts.

    Returns dict with URLs to all generated files.
    """
    start = time.perf_counter()
    storage = get_storage()

    # Collect texture URLs from layers
    texture_urls = []
    for i, layer in enumerate(layers):
        texture_urls.append(layer.get("texture_url", ""))

    # Generate model3.json
    model3_bytes = _generate_model3_json(
        image_id, skeleton, meshes, weights,
        texture_urls, canvas_width, canvas_height,
    )
    model3_key = f"export/{image_id}/model.model3.json"
    model3_url = storage.upload(model3_key, model3_bytes, "application/json")

    # Generate mock moc3
    moc3_url = None
    if generate_moc3:
        moc3_bytes = _generate_mock_moc3()
        moc3_key = f"export/{image_id}/model.moc3"
        moc3_url = storage.upload(moc3_key, moc3_bytes, "application/octet-stream")

    # Generate physics3.json placeholder
    physics3_bytes = _generate_mock_physics3(image_id)
    physics3_key = f"export/{image_id}/model.physics3.json"
    storage.upload(physics3_key, physics3_bytes, "application/json")

    # Generate cmo3 (combined archive — mock as JSON descriptor)
    cmo3_doc = {
        "image_id": image_id,
        "moc3_url": moc3_url,
        "model3_url": model3_url,
        "texture_count": len(texture_urls),
        "canvas_width": canvas_width,
        "canvas_height": canvas_height,
    }
    cmo3_key = f"export/{image_id}/model.cmo3"
    cmo3_url = storage.upload(cmo3_key, json.dumps(cmo3_doc).encode(), "application/json")

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    logger.info(f"exported model {image_id} in {elapsed_ms}ms")

    return {
        "cmo3_url": cmo3_url,
        "moc3_url": moc3_url,
        "model3_json_url": model3_url,
        "textures_urls": texture_urls,
        "processing_time_ms": elapsed_ms,
    }
