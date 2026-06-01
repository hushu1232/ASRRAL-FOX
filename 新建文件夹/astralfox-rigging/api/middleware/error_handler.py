"""Unified error handler — maps Python exceptions to FastAPI JSON detail responses."""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from loguru import logger


def register_error_handlers(app: FastAPI):
    @app.exception_handler(Exception)
    async def catch_all(request, exc):
        logger.error("Unhandled error: {} — {}", type(exc).__name__, str(exc))
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc) or "Internal server error"},
        )
