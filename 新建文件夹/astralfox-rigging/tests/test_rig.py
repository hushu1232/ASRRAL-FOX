"""Rigging endpoint tests."""

import io
from PIL import Image


def _make_png(w=200, h=300) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGBA", (w, h), color=(128, 64, 200, 255))
    img.save(buf, "PNG")
    buf.seek(0)
    return buf.read()


def _setup_image_and_layers(client) -> tuple[str, list[dict]]:
    """Upload image, run separation, return image_id and layers list."""
    png = _make_png()
    res = client.post(
        "/api/upload",
        files={"file": ("character.png", io.BytesIO(png), "image/png")},
    )
    assert res.status_code == 200
    image_id = res.json()["image_id"]

    res = client.post("/api/separate", json={
        "image_id": image_id,
        "target_layers": ["face", "body", "eye_L", "eye_R", "mouth"],
    })
    assert res.status_code == 200
    layers = res.json()["layers"]

    # Convert to minimal layer dicts for rig request
    layer_dicts = [
        {"label": ly["label"], "bbox": ly["bbox"]}
        for ly in layers
    ]
    return image_id, layer_dicts


def test_rig_returns_skeleton_and_meshes(client, tmp_storage):
    image_id, layers = _setup_image_and_layers(client)

    res = client.post("/api/rig", json={
        "image_id": image_id,
        "layers": layers,
    })
    assert res.status_code == 200
    data = res.json()

    assert data["image_id"] == image_id
    assert data["skeleton"]["name"] == "root"
    assert "children" in data["skeleton"]
    assert data["mesh_count"] == len(layers)
    assert len(data["meshes"]) == len(layers)
    assert len(data["weights"]) == len(layers)
    assert data["processing_time_ms"] >= 0


def test_rig_meshes_have_vertices_and_indices(client, tmp_storage):
    image_id, layers = _setup_image_and_layers(client)

    res = client.post("/api/rig", json={
        "image_id": image_id,
        "layers": layers,
    })
    data = res.json()

    for mesh in data["meshes"]:
        assert "label" in mesh
        assert len(mesh["vertices"]) == 4
        assert len(mesh["indices"]) == 6
        assert len(mesh["uvs"]) == 4
        assert mesh["vertex_count"] == 4
        assert mesh["triangle_count"] == 2


def test_rig_weights_map_to_bones(client, tmp_storage):
    image_id, layers = _setup_image_and_layers(client)

    res = client.post("/api/rig", json={
        "image_id": image_id,
        "layers": layers,
    })
    data = res.json()

    for w in data["weights"]:
        assert "bone_names" in w
        assert len(w["bone_names"]) >= 1
        assert w["vertex_count"] == 4
        assert len(w["weights"]) == 4
        for vw in w["weights"]:
            total = sum(entry["weight"] for entry in vw)
            assert abs(total - 1.0) < 0.01, f"weights must sum to ~1.0, got {total}"


def test_rig_with_template_and_density(client, tmp_storage):
    image_id, layers = _setup_image_and_layers(client)

    res = client.post("/api/rig", json={
        "image_id": image_id,
        "layers": layers,
        "template": "catgirl",
        "mesh_density": "high",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["mesh_count"] == len(layers)


def test_rig_missing_image_returns_404(client):
    res = client.post("/api/rig", json={
        "image_id": "nonexistent",
        "layers": [{"label": "face", "bbox": [10, 20, 50, 60]}],
    })
    assert res.status_code == 404


def test_rig_empty_layers_returns_zero_meshes(client, tmp_storage):
    image_id, _ = _setup_image_and_layers(client)

    res = client.post("/api/rig", json={
        "image_id": image_id,
        "layers": [],
    })
    assert res.status_code == 200
    data = res.json()
    assert data["mesh_count"] == 0
    assert data["meshes"] == []
    assert data["weights"] == []


def test_rig_skeleton_is_full_tree(client, tmp_storage):
    image_id, layers = _setup_image_and_layers(client)

    res = client.post("/api/rig", json={
        "image_id": image_id,
        "layers": [layers[0]],  # Just one layer
    })
    data = res.json()

    # Verify skeleton tree is a valid recursive structure
    def walk(node):
        assert "name" in node
        assert "position" in node
        assert isinstance(node["position"], list)
        assert len(node["position"]) == 2
        for child in node.get("children", []):
            walk(child)

    walk(data["skeleton"])
