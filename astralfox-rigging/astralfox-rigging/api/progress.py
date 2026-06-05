"""Progress tracking and SSE notifications for pipeline operations."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


@dataclass
class ProgressEvent:
    """A single progress event."""
    image_id: str
    stage: str
    status: str  # "started", "progress", "completed", "failed"
    progress: float  # 0.0 to 1.0
    message: str
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "image_id": self.image_id,
            "stage": self.stage,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
        }


class ProgressManager:
    """Manages progress events and SSE subscriptions."""

    def __init__(self):
        self._subscribers: dict[str, list[asyncio.Queue]] = {}
        self._current_progress: dict[str, ProgressEvent] = {}

    def subscribe(self, image_id: str) -> asyncio.Queue:
        """Subscribe to progress updates for an image."""
        if image_id not in self._subscribers:
            self._subscribers[image_id] = []

        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers[image_id].append(queue)

        # Send current progress if exists
        if image_id in self._current_progress:
            queue.put_nowait(self._current_progress[image_id])

        return queue

    def unsubscribe(self, image_id: str, queue: asyncio.Queue) -> None:
        """Unsubscribe from progress updates."""
        if image_id in self._subscribers:
            self._subscribers[image_id] = [
                q for q in self._subscribers[image_id] if q != queue
            ]
            if not self._subscribers[image_id]:
                del self._subscribers[image_id]

    def update(self, event: ProgressEvent) -> None:
        """Send a progress update to all subscribers."""
        self._current_progress[event.image_id] = event

        if event.image_id in self._subscribers:
            for queue in self._subscribers[event.image_id]:
                queue.put_nowait(event)

        logger.info(f"[{event.image_id}] {event.stage}: {event.message} ({event.progress:.0%})")

    def get_progress(self, image_id: str) -> ProgressEvent | None:
        """Get current progress for an image."""
        return self._current_progress.get(image_id)

    def clear(self, image_id: str) -> None:
        """Clear progress data for an image."""
        self._current_progress.pop(image_id, None)
        self._subscribers.pop(image_id, None)


# Global progress manager
progress_manager = ProgressManager()


async def progress_generator(image_id: str) -> AsyncGenerator[str, None]:
    """Generate SSE events for pipeline progress.

    Usage:
        @app.get("/api/progress/{image_id}")
        async def progress_stream(image_id: str):
            return StreamingResponse(
                progress_generator(image_id),
                media_type="text/event-stream",
            )
    """
    queue = progress_manager.subscribe(image_id)

    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                data = json.dumps(event.to_dict())
                yield f"data: {data}\n\n"

                # Stop on completion or failure
                if event.status in ("completed", "failed"):
                    break
            except asyncio.TimeoutError:
                # Send keepalive
                yield ": keepalive\n\n"
    finally:
        progress_manager.unsubscribe(image_id, queue)


def report_progress(
    image_id: str,
    stage: str,
    status: str,
    progress: float,
    message: str,
) -> None:
    """Helper to report progress."""
    progress_manager.update(ProgressEvent(
        image_id=image_id,
        stage=stage,
        status=status,
        progress=progress,
        message=message,
    ))
