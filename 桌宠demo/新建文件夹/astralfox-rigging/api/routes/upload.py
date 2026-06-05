"""Image upload endpoint."""

import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from loguru import logger

from core.config import settings
from api.dependencies import get_storage

router = APIRouter(tags=["upload"])

ALLOWED_TYPES = {"image/png", "image/jpeg"}


def _max_size() -> int:
    return settings.MAX_UPLOAD_MB * 1024 * 1024


def _validate_image(data: bytes, content_type: str) -> None:
    from PIL import Image
    from io import BytesIO

    if content_type not in ALLOWED_TYPES:
        raise HTTPException(422, f"Invalid file type: {content_type}. Only PNG/JPEG allowed.")

    if len(data) > _max_size():
        raise HTTPException(413, f"File too large. Max {settings.MAX_UPLOAD_MB}MB.")

    try:
        img = Image.open(BytesIO(data))
        img.verify()
        if img.format and img.format.lower() not in ("png", "jpeg"):
            raise HTTPException(422, f"Invalid image format: {img.format}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Corrupted or unreadable image: {e}")


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    data = await file.read()
    filename = file.filename or "image.png"
    content_type = file.content_type or "application/octet-stream"

    _validate_image(data, content_type)

    image_id = uuid.uuid4().hex[:12]
    storage = get_storage()
    key = f"images/{image_id}/{filename}"
    url = storage.upload(key, data, content_type)

    logger.info("image uploaded: {} ({} bytes) → {}", image_id, len(data), key)

    return {
        "image_id": image_id,
        "filename": filename,
        "size": len(data),
        "url": url,
    }
