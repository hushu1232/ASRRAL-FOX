"""Cubism format export API route.

Generates the complete model package:
    model.moc3        — binary runtime data
    model.model3.json — SDK configuration
    model.cmo3        — Editor project file
    model.physics3.json — physics simulation
    textures/*.png    — layer textures
    model.zip         — all-in-one download
"""

from __future__ import annotations

import time
import zipfile
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from api.schemas import ExportRequest, ExportResponse
from cubism_bridge.cmo3_writer import CMO3Writer
from cubism_bridge.moc3_encoder import MOC3Encoder
from cubism_bridge.physics_config import PhysicsConfig

router = APIRouter()


@router.post("/", response_model=ExportResponse)
async def export_model(req: ExportRequest) -> ExportResponse:
    """Export skeleton + layers as a complete Cubism model package."""
    t0 = time.perf_counter()

    out_dir = Path("output") / req.image_id / "cubism"
    out_dir.mkdir(parents=True, exist_ok=True)

    writer = CMO3Writer(
        canvas_width=req.canvas_width,
        canvas_height=req.canvas_height,
        texture_size=req.texture_size,
    )

    # Texture names for model3.json
    texture_names = [f"textures/{l.label.value if hasattr(l.label, 'value') else l.label}.png" for l in req.layers]

    # 1. Generate .model3.json
    model3_path = out_dir / "model.model3.json"
    writer.write_model3_json(
        skeleton=req.skeleton,
        output_path=model3_path,
        texture_names=texture_names,
        has_physics=True,
    )

    # 2. Generate .cmo3 (with mesh + weight data)
    cmo3_path = out_dir / "model.cmo3"
    mesh_dicts = [m.model_dump() for m in req.meshes] if req.meshes else None
    weight_dicts = [w.model_dump() for w in req.weights] if req.weights else None
    writer.write_cmo3(
        skeleton=req.skeleton,
        layers=req.layers,
        output_path=cmo3_path,
        meshes=mesh_dicts,
        weights=weight_dicts,
    )

    # 3. Encode .moc3
    moc3_path = None
    if req.generate_moc3:
        encoder = MOC3Encoder()
        moc3_path = out_dir / "model.moc3"
        encoder.encode(cmo3_path=cmo3_path, output_path=moc3_path)

    # 4. Generate .physics3.json
    physics_path = out_dir / "model.physics3.json"
    physics = PhysicsConfig.default_astralfox()
    physics.write(physics_path)

    # 5. Copy textures
    tex_dir = out_dir / "textures"
    tex_dir.mkdir(exist_ok=True)
    textures = []
    for layer in req.layers:
        # Find source texture
        src = _find_layer_texture(req.image_id, layer.label.value)
        if src and src.exists():
            dst = tex_dir / f"{layer.label.value if hasattr(layer.label, 'value') else layer.label}.png"
            import shutil
            shutil.copy2(src, dst)
        textures.append(f"/static/output/{req.image_id}/cubism/textures/{layer.label.value if hasattr(layer.label, 'value') else layer.label}.png")

    # 6. Create ZIP package
    zip_path = out_dir / "model.zip"
    _create_zip(out_dir, zip_path)

    elapsed = (time.perf_counter() - t0) * 1000
    return ExportResponse(
        cmo3_url=f"/static/output/{req.image_id}/cubism/model.cmo3",
        moc3_url=f"/static/output/{req.image_id}/cubism/model.moc3" if moc3_path else None,
        model3_json_url=f"/static/output/{req.image_id}/cubism/model.model3.json",
        textures_urls=textures,
        processing_time_ms=round(elapsed, 1),
    )


@router.get("/download/{image_id}")
async def download_model(image_id: str):
    """Download the exported model as a ZIP file."""
    zip_path = Path("output") / image_id / "cubism" / "model.zip"
    if not zip_path.exists():
        return {"error": "Model not found. Run export first."}
    return FileResponse(zip_path, filename=f"astralfox_model_{image_id}.zip")


def _find_layer_texture(image_id: str, label: str) -> Path | None:
    """Find the texture file for a layer."""
    layers_dir = Path("output") / image_id / "layers"
    candidates = [
        layers_dir / f"{label}.png",
        layers_dir / f"{label}.jpg",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def _create_zip(source_dir: Path, zip_path: Path) -> None:
    """Create a ZIP archive of the model files."""
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in source_dir.rglob("*"):
            if file.is_file() and file.name != "model.zip":
                zf.write(file, file.relative_to(source_dir))
