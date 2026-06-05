"""Shared test fixtures."""

import pytest
from fastapi.testclient import TestClient
from api.main import app
from api.dependencies import get_storage
from core.config import settings


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def tmp_storage(tmp_path):
    """Override storage dir with temp path."""
    original = settings.STORAGE_DIR
    settings.STORAGE_DIR = str(tmp_path)
    get_storage.cache_clear()
    yield str(tmp_path)
    get_storage.cache_clear()
    settings.STORAGE_DIR = original
