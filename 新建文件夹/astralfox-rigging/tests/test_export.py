"""Cubism export endpoint tests."""

import io
import json
from PIL import Image


def _make_png(w=200, h=300) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGBA", (w, h), color=(128, 64, 200, 255))
    img.save(buf, "PNG")
    buf.seek(0)
    return buf.read()


def _full_pipeline(client) -> dict:
    """Run upload → separate → rig, return the full result dict."""
    png = _make_png()
    res = client.post("/api/upload", files={
        "file": ("character.png", io.BytesIO(png), "image/png"),
    })
    assert res.status_code == 200
    image_id = res.json()["image_id"]

    res = client.post("/api/separate", json={
        "image_id": image_id,
        "target_layers": ["face", "body", "eye_L", "eye_R", "mouth"],
    })
    assert res.status_code == 200
    sep_data = res.json()

    layers_for_rig = [
        {"label": ly["label"], "bbox": ly["bbox"]}
        for ly in sep_data["layers"]
    ]

    res = client.post("/api/rig", json={
        "image_id": image_id,
        "layers": layers_for_rig,
    })
    assert res.status_code == 200
    rig_data = res.json()

    return {
        "image_id": image_id,
        "skeleton": rig_data["skeleton"],
        "layers": sep_data["layers"],
        "meshes": rig_data["meshes"],
        "weights": rig_data["weights"],
    }


def test_export_returns_all_urls(client, tmp_storage):
    ctx = _full_pipeline(client)

    res = client.post("/api/export", json={
        "image_id": ctx["image_id"],
        "skeleton": ctx["skeleton"],
        "layers": ctx["layers"],
        "meshes": ctx["meshes"],
        "weights": ctx["weights"],
    })
    assert res.status_code == 200
    data = res.json()

    assert data["cmo3_url"].endswith(".cmo3")
    assert data["moc3_url"].endswith(".moc3")
    assert data["model3_json_url"].endswith(".json")
    assert isinstance(data["textures_urls"], list)
    assert data["processing_time_ms"] >= 0


def test_export_moc3_is_downloadable(client, tmp_storage):
    ctx = _full_pipeline(client)

    res = client.post("/api/export", json={
        "image_id": ctx["image_id"],
        "skeleton": ctx["skeleton"],
        "layers": ctx["layers"],
        "meshes": ctx["meshes"],
        "weights": ctx["weights"],
    })
    moc3_url = res.json()["moc3_url"]

    file_res = client.get(moc3_url)
    assert file_res.status_code == 200
    content = file_res.content
    assert content[:4] == b"MOC3"  # magic header
    assert len(content) > 4


def test_export_model3_json_is_valid(client, tmp_storage):
    ctx = _full_pipeline(client)

    res = client.post("/api/export", json={
        "image_id": ctx["image_id"],
        "skeleton": ctx["skeleton"],
        "layers": ctx["layers"],
        "meshes": ctx["meshes"],
        "weights": ctx["weights"],
    })
    model3_url = res.json()["model3_json_url"]

    file_res = client.get(model3_url)
    assert file_res.status_code == 200
    doc = json.loads(file_res.content)
    assert doc["Version"] == 3
    assert "FileReferences" in doc
    assert "Groups" in doc
    assert "CanvasSize" in doc


def test_export_without_moc3(client, tmp_storage):
    ctx = _full_pipeline(client)

    res = client.post("/api/export", json={
        "image_id": ctx["image_id"],
        "skeleton": ctx["skeleton"],
        "layers": ctx["layers"],
        "meshes": ctx["meshes"],
        "weights": ctx["weights"],
        "generate_moc3": False,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["moc3_url"] is None
    assert data["model3_json_url"].endswith(".json")


def test_export_respects_canvas_size(client, tmp_storage):
    ctx = _full_pipeline(client)

    res = client.post("/api/export", json={
        "image_id": ctx["image_id"],
        "skeleton": ctx["skeleton"],
        "layers": ctx["layers"],
        "meshes": ctx["meshes"],
        "weights": ctx["weights"],
        "canvas_width": 1500,
        "canvas_height": 2000,
    })
    model3_url = res.json()["model3_json_url"]
    doc = json.loads(client.get(model3_url).content)
    assert doc["CanvasSize"]["Width"] == 1500
    assert doc["CanvasSize"]["Height"] == 2000


def test_export_cmo3_is_downloadable(client, tmp_storage):
    ctx = _full_pipeline(client)

    res = client.post("/api/export", json={
        "image_id": ctx["image_id"],
        "skeleton": ctx["skeleton"],
        "layers": ctx["layers"],
        "meshes": ctx["meshes"],
        "weights": ctx["weights"],
    })
    cmo3_url = res.json()["cmo3_url"]

    file_res = client.get(cmo3_url)
    assert file_res.status_code == 200
    doc = json.loads(file_res.content)
    assert doc["image_id"] == ctx["image_id"]
    assert "moc3_url" in doc


def test_export_download_zip(client, tmp_storage):
    import io as io_mod
    from PIL import Image
    buf = io_mod.BytesIO()
    Image.new("RGBA", (100, 150), color=(255, 0, 128, 255)).save(buf, "PNG")
    buf.seek(0)
    png = buf.read()

    res = client.post("/api/upload", files={
        "file": ("test.png", io.BytesIO(png), "image/png"),
    })
    image_id = res.json()["image_id"]

    res = client.post("/api/separate", json={
        "image_id": image_id, "target_layers": ["face"],
    })
    sep_data = res.json()
    layers = [{"label": ly["label"], "bbox": ly["bbox"]} for ly in sep_data["layers"]]

    res = client.post("/api/rig", json={
        "image_id": image_id, "layers": layers,
    })
    rig_data = res.json()

    res = client.post("/api/export", json={
        "image_id": image_id,
        "skeleton": rig_data["skeleton"],
        "layers": sep_data["layers"],
        "meshes": rig_data["meshes"],
        "weights": rig_data["weights"],
    })
    assert res.status_code == 200

    # Download ZIP
    zip_res = client.get(f"/api/export/download/{image_id}")
    assert zip_res.status_code == 200
    assert zip_res.headers["content-type"] == "application/zip"

    import zipfile
    zf = zipfile.ZipFile(io.BytesIO(zip_res.content))
    names = zf.namelist()
    assert len(names) >= 4  # moc3, model3.json, physics3.json, cmo3
    assert "model.moc3" in names
    assert "model.model3.json" in names


def test_export_download_zip_404(client):
    res = client.get("/api/export/download/nonexistent")
    assert res.status_code == 404
