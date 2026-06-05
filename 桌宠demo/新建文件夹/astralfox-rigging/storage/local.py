"""Local filesystem storage adapter."""

import os
import shutil
from pathlib import Path
from loguru import logger


class LocalStorage:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _safe_path(self, key: str) -> Path:
        path = (self.base_dir / key).resolve()
        if not str(path).startswith(str(self.base_dir.resolve())):
            raise ValueError(f"Path traversal denied: {key}")
        return path

    def upload(self, key: str, data: bytes, content_type: str = "") -> str:
        path = self._safe_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        logger.debug("stored: {} ({} bytes)", key, len(data))
        return f"/api/files/{key}"

    def download(self, key: str) -> bytes:
        path = self._safe_path(key)
        if not path.exists():
            raise FileNotFoundError(key)
        return path.read_bytes()

    def exists(self, key: str) -> bool:
        return self._safe_path(key).exists()

    def delete(self, key: str) -> None:
        path = self._safe_path(key)
        if path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)

    def list(self, prefix: str) -> list[str]:
        dir_path = self._safe_path(prefix)
        if not dir_path.exists():
            return []
        return [str(p.relative_to(self.base_dir)) for p in dir_path.rglob("*") if p.is_file()]
