"""Health check endpoint."""

from fastapi import APIRouter

from core.config import settings
from core.gpu_monitor import get_gpu_metrics

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    m = get_gpu_metrics()
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "gpu": m.to_dict(),
    }
