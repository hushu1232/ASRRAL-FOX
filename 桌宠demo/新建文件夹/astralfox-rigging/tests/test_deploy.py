"""Deploy endpoint tests."""

import io
import json
from PIL import Image


def _make_png(w=200, h=300) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGBA", (w, h), color=(128, 64, 200, 255))
    img.save(buf, "PNG")
    buf.seek(0)
    return buf.read()


def _full_pipeline_through_export(client) -> dict:
    """Run upload -> separate -> rig -> export, return export result."""
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

    res = client.post("/api/export", json={
        "image_id": image_id,
        "skeleton": rig_data["skeleton"],
        "layers": sep_data["layers"],
        "meshes": rig_data["meshes"],
        "weights": rig_data["weights"],
    })
    assert res.status_code == 200

    return {"image_id": image_id, "export": res.json()}


def test_deploy_succeeds(client, tmp_storage):
    ctx = _full_pipeline_through_export(client)

    res = client.post("/api/deploy", json={
        "model_id": ctx["image_id"],
    })
    assert res.status_code == 200
    data = res.json()
    assert data["model_id"] == ctx["image_id"]
    assert data["reload_triggered"] is False  # no Unity client in tests
    assert len(data["configs_written"]) > 0
    assert data["processing_time_ms"] >= 0


def test_deploy_with_target_name(client, tmp_storage):
    ctx = _full_pipeline_through_export(client)

    res = client.post("/api/deploy", json={
        "model_id": ctx["image_id"],
        "target_name": "my_custom_pet",
    })
    assert res.status_code == 200
    data = res.json()
    assert "my_custom_pet" in data["deployed_path"]


def test_deploy_with_anim_params(client, tmp_storage):
    ctx = _full_pipeline_through_export(client)

    custom_params = {"ParamEyeLOpen": {"min": 0, "max": 1, "default": 0.5}}
    res = client.post("/api/deploy", json={
        "model_id": ctx["image_id"],
        "anim_params": custom_params,
    })
    assert res.status_code == 200

    # Verify config file uses custom params
    config_file = [k for k in res.json()["configs_written"] if k.endswith("pet_config.json")][0]
    config_data = json.loads(client.get(f"/api/files/{config_file}").content)
    assert config_data["animation_params"] == custom_params


def test_deploy_missing_model_returns_404(client):
    res = client.post("/api/deploy", json={
        "model_id": "nonexistent_model_42",
    })
    assert res.status_code == 404


def test_deploy_config_is_valid_json(client, tmp_storage):
    ctx = _full_pipeline_through_export(client)

    res = client.post("/api/deploy", json={
        "model_id": ctx["image_id"],
    })
    config_keys = [k for k in res.json()["configs_written"] if k.endswith("pet_config.json")]
    assert len(config_keys) == 1

    config_res = client.get(f"/api/files/{config_keys[0]}")
    assert config_res.status_code == 200
    config = json.loads(config_res.content)
    assert "model_name" in config
    assert "moc3_path" in config
    assert "animation_params" in config


def test_deploy_copies_all_export_files(client, tmp_storage):
    ctx = _full_pipeline_through_export(client)

    res = client.post("/api/deploy", json={
        "model_id": ctx["image_id"],
    })
    data = res.json()
    # Should have copied moc3, model3.json, physics3.json, cmo3 + config
    assert len(data["configs_written"]) >= 5

    # All copied files should be downloadable
    for key in data["configs_written"]:
        file_res = client.get(f"/api/files/{key}")
        assert file_res.status_code == 200, f"file {key} should be retrievable"
