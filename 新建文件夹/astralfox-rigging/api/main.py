"""AstralFox Rigging — AI Live2D Rigging Microservice."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.middleware.timing import TimingMiddleware
from api.middleware.error_handler import register_error_handlers
from api.routes import health, upload, files, separate, rig, export_route, deploy_route, pipeline_route, metrics
from core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    from loguru import logger
    from core.gpu_monitor import detect_gpu
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"GPU enabled: {settings.GPU_ENABLED}, CPU fallback: {settings.CPU_FALLBACK}")
    logger.info(f"Storage: {settings.STORAGE_DIR}")
    gpu_info = detect_gpu()
    logger.info(f"GPU detection result: {gpu_info}")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TimingMiddleware)

# Error handlers
register_error_handlers(app)

# Routes
app.include_router(health.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(separate.router, prefix="/api")
app.include_router(rig.router, prefix="/api")
app.include_router(export_route.router, prefix="/api")
app.include_router(deploy_route.router, prefix="/api")
app.include_router(pipeline_route.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")


@app.get("/")
async def root():
    return {"service": settings.APP_NAME, "version": settings.APP_VERSION}
