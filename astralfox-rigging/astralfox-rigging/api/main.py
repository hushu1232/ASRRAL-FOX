"""FastAPI application entry point."""

from __future__ import annotations

import uuid
from pathlib import Path

import yaml
from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from api.routes import separate, rig, export, deploy, pipeline, generate
from api.progress import progress_generator, progress_manager

# ── Config ─────────────────────────────────────────────────────────

CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"
with open(CONFIG_PATH, encoding="utf-8") as f:
    config = yaml.safe_load(f)

# ── App ────────────────────────────────────────────────────────────

app = FastAPI(
    title="AstralFox Rigging Pipeline",
    description="AI-powered rigging pipeline for AstralFox desktop pet",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config["server"]["cors_origins"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files (uploaded images, outputs) ───────────────────────

UPLOAD_DIR = Path("output/uploads")
OUTPUT_DIR = Path(config["output"]["dir"])
TEMP_DIR = Path("temp")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/static/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")
app.mount("/output", StaticFiles(directory="output"), name="output_root")

# ── Routes ─────────────────────────────────────────────────────────

app.include_router(separate.router, prefix="/api/separate", tags=["Separation"])
app.include_router(rig.router, prefix="/api/rig", tags=["Rigging"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(deploy.router, prefix="/api/deploy", tags=["Deploy"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["Pipeline"])
app.include_router(generate.router, tags=["Generate"])


# ── Upload endpoint ────────────────────────────────────────────────

@app.post("/api/upload", tags=["Upload"])
async def upload_image(file: UploadFile) -> dict:
    """Upload an image for processing. Returns an image_id."""
    image_id = uuid.uuid4().hex[:12]
    ext = Path(file.filename or "image.png").suffix
    dest = UPLOAD_DIR / f"{image_id}{ext}"

    content = await file.read()
    dest.write_bytes(content)

    return {
        "image_id": image_id,
        "filename": file.filename,
        "size": len(content),
        "url": f"/static/uploads/{image_id}{ext}",
    }


@app.get("/api/health", tags=["Health"])
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/progress/{image_id}", tags=["Progress"])
async def progress_stream(image_id: str):
    """SSE endpoint for real-time pipeline progress updates.

    Returns Server-Sent Events with progress data:
        data: {"image_id": "...", "stage": "separate", "status": "progress", "progress": 0.5, "message": "Processing..."}
    """
    return StreamingResponse(
        progress_generator(image_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/progress/{image_id}/status", tags=["Progress"])
async def progress_status(image_id: str) -> dict:
    """Get current progress status for an image."""
    event = progress_manager.get_progress(image_id)
    if event:
        return event.to_dict()
    return {"image_id": image_id, "status": "unknown", "progress": 0}


# ── Startup ────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    """Pre-load AI models at startup for faster first response."""
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    try:
        from ai_engine import preload_models
        await preload_models(config.get("models", {}))
        logger.info("AI models pre-loaded successfully")
    except Exception as e:
        logger.warning(f"AI model pre-loading failed: {e}")
