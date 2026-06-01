"""Static file serving — images, textures, model files."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from loguru import logger

from api.dependencies import get_storage

router = APIRouter(tags=["files"])

MIME_MAP = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".json": "application/json",
    ".moc3": "application/octet-stream",
    ".cmo3": "application/octet-stream",
    ".zip": "application/zip",
}


def _content_type(path: str) -> str:
    for ext, mime in MIME_MAP.items():
        if path.lower().endswith(ext):
            return mime
    return "application/octet-stream"


@router.get("/files/{path:path}")
async def serve_file(path: str):
    storage = get_storage()
    try:
        data = storage.download(path)
    except FileNotFoundError:
        raise HTTPException(404, f"File not found: {path}")
    except ValueError as e:
        raise HTTPException(403, str(e))

    from fastapi.responses import Response
    return Response(content=data, media_type=_content_type(path))
