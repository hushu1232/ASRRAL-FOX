"""Request timing middleware."""

import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from loguru import logger


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.1f}"

        if elapsed_ms > 1000:
            logger.warning(
                "slow request: {} {} — {:.0f}ms",
                request.method, request.url.path, elapsed_ms,
            )

        return response
