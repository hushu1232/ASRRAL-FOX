"""Upload endpoint tests."""

import io
from PIL import Image


def _make_png(w=100, h=100) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (w, h), color=(255, 0, 0))
    img.save(buf, "PNG")
    buf.seek(0)
    return buf.read()


def _make_jpeg(w=100, h=100) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (w, h), color=(0, 255, 0))
    img.save(buf, "JPEG")
    buf.seek(0)
    return buf.read()


def test_upload_png(client, tmp_storage):
    png = _make_png()
    res = client.post(
        "/api/upload",
        files={"file": ("test.png", io.BytesIO(png), "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert "image_id" in data
    assert len(data["image_id"]) == 12
    assert data["filename"] == "test.png"
    assert data["size"] == len(png)


def test_upload_jpeg(client, tmp_storage):
    jpg = _make_jpeg()
    res = client.post(
        "/api/upload",
        files={"file": ("photo.jpg", io.BytesIO(jpg), "image/jpeg")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["filename"] == "photo.jpg"


def test_upload_rejects_bmp(client):
    buf = io.BytesIO(b"BM" + b"\x00" * 100)
    res = client.post(
        "/api/upload",
        files={"file": ("image.bmp", buf, "image/bmp")},
    )
    assert res.status_code == 422


def test_upload_rejects_corrupted(client):
    res = client.post(
        "/api/upload",
        files={"file": ("bad.png", io.BytesIO(b"not a real image"), "image/png")},
    )
    assert res.status_code == 422


def test_upload_rejects_too_large(client, monkeypatch):
    from core import config
    monkeypatch.setattr(config.settings, "MAX_UPLOAD_MB", 1)

    large = b"\x00" * (2 * 1024 * 1024)  # 2 MB when limit is 1 MB
    res = client.post(
        "/api/upload",
        files={"file": ("big.png", io.BytesIO(large), "image/png")},
    )
    assert res.status_code == 413


def test_upload_stores_file(client, tmp_storage):
    png = _make_png()
    res = client.post(
        "/api/upload",
        files={"file": ("store.png", io.BytesIO(png), "image/png")},
    )
    assert res.status_code == 200
    data = res.json()

    # Verify file is retrievable via /api/files/...
    url = data["url"]
    assert url.startswith("/api/files/")
    file_res = client.get(url)
    assert file_res.status_code == 200
    assert file_res.content == png


def test_files_404(client):
    res = client.get("/api/files/nonexistent/file.png")
    assert res.status_code == 404


def test_files_path_traversal_blocked(client):
    res = client.get("/api/files/../../../etc/passwd")
    assert res.status_code in (403, 404)
