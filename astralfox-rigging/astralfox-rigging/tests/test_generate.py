"""Tests for image generation API endpoint.

Uses mocks to simulate ComfyUI interactions.
Does not require a running ComfyUI server.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

from api.main import app
from ai_engine.image_generator import (
    ComfyUIImageGenerator,
    ComfyUIError,
    ComfyUITimeoutError,
    ComfyUIUploadError,
)

client = TestClient(app)


# ── Helpers ────────────────────────────────────────────────────────

def _make_test_png_bytes(size: int = 100) -> bytes:
    """Create a minimal valid PNG image as bytes."""
    from PIL import Image
    import io

    img = Image.new("RGBA", (size, size), (128, 128, 128, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _mock_comfyui_success():
    """Create mock ComfyUI generator that succeeds."""
    mock_gen = MagicMock(spec=ComfyUIImageGenerator)
    mock_gen.generate_anatomical_standpose.return_value = Path("output/uploads/anatomical_test123.png")
    return mock_gen


def _mock_comfyui_timeout():
    """Create mock ComfyUI generator that times out."""
    mock_gen = MagicMock(spec=ComfyUIImageGenerator)
    mock_gen.generate_anatomical_standpose.side_effect = ComfyUITimeoutError("Workflow timed out")
    return mock_gen


def _mock_comfyui_error():
    """Create mock ComfyUI generator that fails."""
    mock_gen = MagicMock(spec=ComfyUIImageGenerator)
    mock_gen.generate_anatomical_standpose.side_effect = ComfyUIError("ComfyUI connection failed")
    return mock_gen


# ── Tests ──────────────────────────────────────────────────────────

class TestGenerateEndpoint:
    """Test POST /api/generate endpoint."""

    @patch("api.routes.generate.ComfyUIImageGenerator")
    def test_generate_success(self, mock_generator_class):
        """Successful generation returns 200 with image_url and filename."""
        # Setup mock
        mock_gen = _mock_comfyui_success()
        mock_generator_class.from_config.return_value = mock_gen

        # Make request
        png_bytes = _make_test_png_bytes()
        response = client.post(
            "/api/generate",
            files={"image": ("test.png", png_bytes, "image/png")},
            data={"prompt": "test prompt", "seed": 42},
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "image_url" in data
        assert "filename" in data
        assert data["image_url"].startswith("/output/uploads/")
        assert data["filename"].endswith(".png")

        # Verify mock was called
        mock_gen.generate_anatomical_standpose.assert_called_once()

    def test_generate_missing_image(self):
        """Missing image field returns 422."""
        response = client.post("/api/generate")
        assert response.status_code == 422

    def test_generate_invalid_file_type(self):
        """Non-image file returns 400."""
        response = client.post(
            "/api/generate",
            files={"image": ("test.txt", b"not an image", "text/plain")},
        )
        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]

    @patch("api.routes.generate.ComfyUIImageGenerator")
    def test_generate_comfyui_timeout(self, mock_generator_class):
        """ComfyUI timeout returns 504."""
        mock_gen = _mock_comfyui_timeout()
        mock_generator_class.from_config.return_value = mock_gen

        png_bytes = _make_test_png_bytes()
        response = client.post(
            "/api/generate",
            files={"image": ("test.png", png_bytes, "image/png")},
        )

        assert response.status_code == 504
        assert "timed out" in response.json()["detail"].lower()

    @patch("api.routes.generate.ComfyUIImageGenerator")
    def test_generate_comfyui_error(self, mock_generator_class):
        """ComfyUI error returns 500."""
        mock_gen = _mock_comfyui_error()
        mock_generator_class.from_config.return_value = mock_gen

        png_bytes = _make_test_png_bytes()
        response = client.post(
            "/api/generate",
            files={"image": ("test.png", png_bytes, "image/png")},
        )

        assert response.status_code == 500
        assert "error" in response.json()["detail"].lower()

    @patch("api.routes.generate.ComfyUIImageGenerator")
    def test_generate_with_custom_prompt(self, mock_generator_class):
        """Custom prompt is passed to generator."""
        mock_gen = _mock_comfyui_success()
        mock_generator_class.from_config.return_value = mock_gen

        png_bytes = _make_test_png_bytes()
        custom_prompt = "blue hair, red eyes"

        response = client.post(
            "/api/generate",
            files={"image": ("test.png", png_bytes, "image/png")},
            data={"prompt": custom_prompt, "seed": 123},
        )

        assert response.status_code == 200

        # Verify the prompt was passed
        call_args = mock_gen.generate_anatomical_standpose.call_args
        assert call_args.kwargs.get("prompt") == custom_prompt or call_args[1].get("prompt") == custom_prompt

    @patch("api.routes.generate.ComfyUIImageGenerator")
    def test_generate_with_seed(self, mock_generator_class):
        """Seed parameter is passed to generator."""
        mock_gen = _mock_comfyui_success()
        mock_generator_class.from_config.return_value = mock_gen

        png_bytes = _make_test_png_bytes()
        response = client.post(
            "/api/generate",
            files={"image": ("test.png", png_bytes, "image/png")},
            data={"seed": 42},
        )

        assert response.status_code == 200

        # Verify the seed was passed
        call_args = mock_gen.generate_anatomical_standpose.call_args
        assert call_args.kwargs.get("seed") == 42 or call_args[1].get("seed") == 42


class TestComfyUIImageGenerator:
    """Test ComfyUIImageGenerator class."""

    def test_from_config_default(self):
        """from_config with no config file returns default."""
        gen = ComfyUIImageGenerator.from_config("nonexistent.yaml")
        assert gen.base_url == "http://127.0.0.1:8188"
        assert gen.timeout == 120

    def test_from_config_custom(self, tmp_path):
        """from_config reads values from config.yaml."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
comfyui:
  base_url: "http://192.168.1.100:8188"
  timeout: 60
""")

        gen = ComfyUIImageGenerator.from_config(config_file)
        assert gen.base_url == "http://192.168.1.100:8188"
        assert gen.timeout == 60

    def test_upload_image_file_not_found(self):
        """upload_image raises error for missing file."""
        gen = ComfyUIImageGenerator()
        with pytest.raises(ComfyUIUploadError, match="not found"):
            gen.upload_image("nonexistent.png")

    @patch("requests.post")
    def test_upload_image_success(self, mock_post):
        """upload_image returns filename on success."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"name": "uploaded_image.png"}
        mock_post.return_value = mock_response

        gen = ComfyUIImageGenerator()

        # Create a temp file
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(b"fake png data")
            temp_path = f.name

        try:
            result = gen.upload_image(temp_path)
            assert result == "uploaded_image.png"
        finally:
            Path(temp_path).unlink()

    @patch("requests.post")
    def test_queue_prompt_success(self, mock_post):
        """queue_prompt returns prompt_id on success."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"prompt_id": "test-123"}
        mock_post.return_value = mock_response

        gen = ComfyUIImageGenerator()
        result = gen.queue_prompt({"test": "workflow"})
        assert result == "test-123"

    @patch("requests.get")
    def test_wait_for_completion_timeout(self, mock_get):
        """wait_for_completion raises timeout error."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_get.return_value = mock_response

        gen = ComfyUIImageGenerator(timeout=1)  # 1 second timeout
        with pytest.raises(ComfyUITimeoutError):
            gen.wait_for_completion("test-prompt-id")
