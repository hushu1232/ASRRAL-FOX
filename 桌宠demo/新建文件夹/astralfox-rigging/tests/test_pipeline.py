"""Pipeline orchestration endpoint tests."""

import io
from PIL import Image


def _make_png(w=200, h=300) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGBA", (w, h), color=(128, 64, 200, 255))
    img.save(buf, "PNG")
    buf.seek(0)
    return buf.read()


def _upload(client) -> str:
    png = _make_png()
    res = client.post("/api/upload", files={
        "file": ("character.png", io.BytesIO(png), "image/png"),
    })
    assert res.status_code == 200
    return res.json()["image_id"]


def test_pipeline_returns_all_stages(client, tmp_storage):
    image_id = _upload(client)

    res = client.post("/api/pipeline", json={"image_id": image_id})
    assert res.status_code == 200
    data = res.json()

    assert "separate" in data
    assert "rig" in data
    assert "export" in data
    assert data["deploy"] is None  # auto_deploy defaults to False
    assert data["total_time_ms"] >= 0

    # Verify each stage result
    assert data["separate"]["image_id"] == image_id
    assert len(data["separate"]["layers"]) == 10
    assert data["rig"]["skeleton"]["name"] == "root"
    assert data["rig"]["mesh_count"] == 10
    assert data["export"]["moc3_url"].endswith(".moc3")
    assert data["export"]["model3_json_url"].endswith(".json")


def test_pipeline_with_auto_deploy(client, tmp_storage):
    image_id = _upload(client)

    res = client.post("/api/pipeline", json={
        "image_id": image_id,
        "auto_deploy": True,
    })
    assert res.status_code == 200
    data = res.json()

    assert data["deploy"] is not None
    assert data["deploy"]["model_id"] == image_id
    assert data["deploy"]["reload_triggered"] is False
    assert len(data["deploy"]["configs_written"]) > 0


def test_pipeline_with_template_and_density(client, tmp_storage):
    image_id = _upload(client)

    res = client.post("/api/pipeline", json={
        "image_id": image_id,
        "template": "female",
        "mesh_density": "high",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["total_time_ms"] >= 0


def test_pipeline_missing_image_returns_404(client):
    res = client.post("/api/pipeline", json={"image_id": "nonexistent"})
    assert res.status_code == 404


def test_pipeline_with_target_name(client, tmp_storage):
    image_id = _upload(client)

    res = client.post("/api/pipeline", json={
        "image_id": image_id,
        "auto_deploy": True,
        "target_name": "desktop_pet_v2",
    })
    assert res.status_code == 200
    assert "desktop_pet_v2" in res.json()["deploy"]["deployed_path"]


def test_pipeline_total_time_is_reasonable(client, tmp_storage):
    image_id = _upload(client)

    res = client.post("/api/pipeline", json={"image_id": image_id})
    data = res.json()

    # Pipeline should complete within 30s for mock CPU path
    assert data["total_time_ms"] < 30000
    assert data["total_time_ms"] >= 0
