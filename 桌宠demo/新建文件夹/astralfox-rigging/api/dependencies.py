"""FastAPI dependency injection — model loaders, storage adapters."""

from functools import lru_cache
from storage.local import LocalStorage
from core.config import settings


@lru_cache
def get_storage() -> LocalStorage:
    return LocalStorage(settings.STORAGE_DIR)
