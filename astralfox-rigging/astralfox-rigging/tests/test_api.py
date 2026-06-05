"""Test API routes end-to-end."""

import io
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

import numpy as np
import pytest
from fastapi.testclient import TestClient

from api.main import app
from ai_engine.layer_separator import SeparatedLayer


client = TestClient(app)


# ── Helpers ────────────────────────────────────────────────────────

def _make_test_png_bytes(size: int = 512) -> bytes:
    """Create a minimal valid PNG image as bytes."""
    from PIL import Image
    import numpy as np

    # Create image with gradient to avoid single-color detection
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    for i in range(size):
        for j in range(size):
            arr[i, j] = [i % 256, j % 256, (i + j) % 256, 255]

    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_mock_layers() -> list[SeparatedLayer]:
    """Create mock separated layers for testing."""
    return [
        SeparatedLayer(
            label="body",
            texture=np.ones((100, 100, 4), dtype=np.uint8) * 128,
            mask=np.ones((100, 100), dtype=np.uint8) * 255,
            bbox=[0, 0, 100, 100],
            score=0.9,
        ),
        SeparatedLayer(
            label="face",
            texture=np.ones((100, 100, 4), dtype=np.uint8) * 200,
            mask=np.ones((100, 100), dtype=np.uint8) * 200,
            bbox=[20, 10, 60, 60],
            score=0.8,
        ),
    ]


# ── Health check ───────────────────────────────────────────────────

def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ── Upload ─────────────────────────────────────────────────────────

def test_upload_image():
    png_bytes = _make_test_png_bytes()
    resp = client.post(
        "/api/upload",
        files={"file": ("test.png", png_bytes, "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "image_id" in data
    assert data["filename"] == "test.png"
    assert data["size"] > 0
    assert "url" in data


def test_upload_returns_unique_ids():
    png = _make_test_png_bytes()
    r1 = client.post("/api/upload", files={"file": ("a.png", png, "image/png")})
    r2 = client.post("/api/upload", files={"file": ("b.png", png, "image/png")})
    assert r1.json()["image_id"] != r2.json()["image_id"]


# ── Separate ───────────────────────────────────────────────────────

def test_separate_not_found():
    resp = client.post("/api/separate/", json={"image_id": "nonexistent"})
    assert resp.status_code == 404


@patch("api.routes.separate._get_separator")
def test_separate_basic(mock_get_sep):
    # Upload first
    png = _make_test_png_bytes()
    upload_resp = client.post("/api/upload", files={"file": ("test.png", png, "image/png")})
    image_id = upload_resp.json()["image_id"]

    # Mock separator
    mock_sep = MagicMock()
    mock_sep.separate.return_value = _make_mock_layers()
    mock_get_sep.return_value = mock_sep

    # Separate
    resp = client.post("/api/separate/", json={"image_id": image_id})
    assert resp.status_code == 200
    data = resp.json()

    assert data["image_id"] == image_id
    assert len(data["layers"]) == 2
    assert data["layers"][0]["label"] == "body"
    assert data["layers"][1]["label"] == "face"
    assert data["processing_time_ms"] > 0


@patch("api.routes.separate._get_separator")
def test_separate_custom_layers(mock_get_sep):
    png = _make_test_png_bytes()
    upload_resp = client.post("/api/upload", files={"file": ("test.png", png, "image/png")})
    image_id = upload_resp.json()["image_id"]

    mock_sep = MagicMock()
    # Return at least 2 layers to pass validation
    mock_sep.separate.return_value = _make_mock_layers()
    mock_get_sep.return_value = mock_sep

    resp = client.post("/api/separate/", json={
        "image_id": image_id,
        "target_layers": ["body", "face"],
        "edge_refine": False,
    })
    assert resp.status_code == 200
    mock_sep.separate.assert_called_once()


# ── Rig ────────────────────────────────────────────────────────────

def test_rig_basic():
    resp = client.post("/api/rig/", json={
        "image_id": "test",
        "layers": [],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "skeleton" in data
    assert "mesh_count" in data
    assert "meshes" in data
    assert "weights" in data
    assert isinstance(data["meshes"], list)
    assert isinstance(data["weights"], list)


# ── Export ──────────────────────────────────────────────────────────

def test_export_basic():
    resp = client.post("/api/export/", json={
        "image_id": "test_export",
        "skeleton": {"name": "root", "position": [1500, 2000], "children": []},
        "layers": [],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "cmo3_url" in data
    assert "model3_json_url" in data
    assert data["moc3_url"] is not None  # generate_moc3 defaults to True


def test_export_with_meshes_and_weights():
    """Test that export accepts and processes mesh/weight data."""
    resp = client.post("/api/export/", json={
        "image_id": "test_export_mw",
        "skeleton": {"name": "root", "position": [1500, 2000], "children": []},
        "layers": [],
        "meshes": [
            {
                "label": "body",
                "vertex_count": 4,
                "triangle_count": 2,
                "vertices": [[0, 0], [100, 0], [100, 100], [0, 100]],
                "uvs": [[0, 0], [1, 0], [1, 1], [0, 1]],
                "indices": [0, 1, 2, 0, 2, 3],
            },
        ],
        "weights": [
            {
                "label": "body",
                "bone_names": ["root"],
                "vertex_count": 4,
                "bone_count": 1,
                "weights": [
                    [{"BoneIndex": 0, "Weight": 1.0}],
                    [{"BoneIndex": 0, "Weight": 1.0}],
                    [{"BoneIndex": 0, "Weight": 1.0}],
                    [{"BoneIndex": 0, "Weight": 1.0}],
                ],
            },
        ],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "cmo3_url" in data
