"""Cubism export endpoint."""

import io
import zipfile

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger

from api.dependencies import get_storage
from api.schemas import ExportRequest, ExportResponse
from core.export import export_model

router = APIRouter(tags=["export"])


@router.post("/export", response_model=ExportResponse)
async def export_cubism(body: ExportRequest):
    try:
        result = export_model(
            image_id=body.image_id,
            skeleton=body.skeleton,
            layers=body.layers,
            meshes=body.meshes,
            weights=body.weights,
            canvas_width=body.canvas_width,
            canvas_height=body.canvas_height,
            texture_size=body.texture_size,
            generate_moc3=body.generate_moc3,
        )
    except Exception as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(500, f"Export failed: {e}")

    return ExportResponse(**result)


@router.get("/export/download/{image_id}")
async def download_model_zip(image_id: str):
    """Download all exported model files as a ZIP archive."""
    storage = get_storage()
    export_prefix = f"export/{image_id}"

    if not storage.exists(export_prefix):
        raise HTTPException(404, f"No export found for image: {image_id}")

    files = storage.list(export_prefix)
    if not files:
        raise HTTPException(404, f"No export files found for image: {image_id}")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_key in files:
            data = storage.download(file_key)
            arcname = file_key[len(export_prefix):].lstrip("/\\")
            zf.writestr(arcname, data)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{image_id}_model.zip"'},
    )
