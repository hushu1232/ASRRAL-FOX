"""Layer separation endpoint tests."""

import io
from PIL import Image


def _make_png(w=200, h=300) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGBA", (w, h), color=(128, 64, 200, 255))
    img.save(buf, "PNG")
    buf.seek(0)
    return buf.read()


def _upload_test_image(client) -> str:
    png = _make_png()
    res = client.post(
        "/api/upload",
        files={"file": ("character.png", io.BytesIO(png), "image/png")},
    )
    assert res.status_code == 200
    return res.json()["image_id"]


def test_separate_all_layers_returns_10(client, tmp_storage):
    image_id = _upload_test_image(client)

    res = client.post("/api/separate", json={"image_id": image_id})
    assert res.status_code == 200
    data = res.json()
    assert data["image_id"] == image_id
    assert len(data["layers"]) == 10
    assert data["processing_time_ms"] >= 0

    labels = [lyr["label"] for lyr in data["layers"]]
    for name in ["hair_back", "body", "hair_front", "face",
                 "eye_L", "eye_R", "eyebrow_L", "eyebrow_R",
                 "mouth", "accessory"]:
        assert name in labels


def test_separate_subset_of_layers(client, tmp_storage):
    image_id = _upload_test_image(client)

    res = client.post("/api/separate", json={
        "image_id": image_id,
        "target_layers": ["face", "body", "eye_L"],
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data["layers"]) == 3
    labels = [lyr["label"] for lyr in data["layers"]]
    assert sorted(labels) == ["body", "eye_L", "face"]


def test_separate_layer_has_required_fields(client, tmp_storage):
    image_id = _upload_test_image(client)

    res = client.post("/api/separate", json={
        "image_id": image_id,
        "target_layers": ["face"],
    })
    assert res.status_code == 200
    layer = res.json()["layers"][0]
    assert layer["label"] == "face"
    assert layer["texture_url"].endswith(".png")
    assert layer["mask_url"].endswith(".png")
    assert len(layer["bbox"]) == 4


def test_separate_no_edge_refine(client, tmp_storage):
    image_id = _upload_test_image(client)

    res = client.post("/api/separate", json={
        "image_id": image_id,
        "target_layers": ["body"],
        "edge_refine": False,
    })
    assert res.status_code == 200
    assert len(res.json()["layers"]) == 1


def test_separate_missing_image_returns_404(client):
    res = client.post("/api/separate", json={"image_id": "nonexistent42"})
    assert res.status_code == 404


def test_separate_result_files_are_retrievable(client, tmp_storage):
    image_id = _upload_test_image(client)

    res = client.post("/api/separate", json={
        "image_id": image_id,
        "target_layers": ["face"],
    })
    data = res.json()
    layer = data["layers"][0]

    # Texture is served via /api/files/...
    texture_res = client.get(layer["texture_url"])
    assert texture_res.status_code == 200
    assert texture_res.headers["content-type"] == "image/png"

    # Mask is also a PNG
    mask_res = client.get(layer["mask_url"])
    assert mask_res.status_code == 200
    assert mask_res.headers["content-type"] == "image/png"


def test_separate_texture_is_valid_png(client, tmp_storage):
    image_id = _upload_test_image(client)

    res = client.post("/api/separate", json={
        "image_id": image_id,
        "target_layers": ["body"],
    })
    url = res.json()["layers"][0]["texture_url"]
    png_data = client.get(url).content

    img = Image.open(io.BytesIO(png_data))
    assert img.mode == "RGBA"
    assert img.width > 0 and img.height > 0
