"""Test Cubism bridge modules."""

import json
import struct
from pathlib import Path

import numpy as np
import pytest

from api.schemas import BoneNode, LayerResult, LayerLabel
from cubism_bridge.cmo3_writer import CMO3Writer, ASTRALFOX_PARAMETERS
from cubism_bridge.moc3_encoder import MOC3Encoder, MOC3Validator, MOC3Reader, MOC3_MAGIC, MOC3_VERSION
from cubism_bridge.physics_config import PhysicsConfig, PhysicsPreset
from cubism_bridge.mesh_generator import MeshGenerator, MeshData


# ── Fixtures ───────────────────────────────────────────────────────

def _make_skeleton() -> BoneNode:
    return BoneNode(
        name="root",
        position=[1500, 2000],
        children=[
            BoneNode(name="body", position=[1500, 2000], children=[
                BoneNode(name="head", position=[1500, 1200], children=[
                    BoneNode(name="eye_L", position=[1400, 1200]),
                    BoneNode(name="eye_R", position=[1600, 1200]),
                ]),
            ]),
            BoneNode(name="tail", position=[1500, 2200]),
        ],
    )


def _make_layers() -> list[LayerResult]:
    return [
        LayerResult(
            label=LayerLabel.BODY,
            texture_url="/test/body.png",
            mask_url="/test/body_mask.png",
            bbox=[500, 500, 1000, 1500],
        ),
        LayerResult(
            label=LayerLabel.FACE,
            texture_url="/test/face.png",
            mask_url="/test/face_mask.png",
            bbox=[800, 600, 400, 400],
        ),
        LayerResult(
            label=LayerLabel.EYE_L,
            texture_url="/test/eye_L.png",
            mask_url="/test/eye_L_mask.png",
            bbox=[1300, 1100, 100, 80],
        ),
    ]


# ── .model3.json tests ─────────────────────────────────────────────

class TestModel3Json:
    def test_write_basic(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.model3.json"
        writer.write_model3_json(_make_skeleton(), out)

        assert out.exists()
        data = json.loads(out.read_text(encoding="utf-8"))

        assert data["Version"] == 3
        assert data["FileReferences"]["Moc"] == "model.moc3"
        assert "Textures" in data["FileReferences"]
        assert data["FileReferences"]["Physics"] == "model.physics3.json"

    def test_has_groups(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.model3.json"
        writer.write_model3_json(_make_skeleton(), out)

        data = json.loads(out.read_text(encoding="utf-8"))
        groups = {g["Name"]: g for g in data["Groups"]}

        assert "EyeBlink" in groups
        assert "LipSync" in groups
        assert "AstralFox" in groups
        assert "ParamEyeLOpen" in groups["EyeBlink"]["Ids"]

    def test_has_hit_areas(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.model3.json"
        writer.write_model3_json(_make_skeleton(), out)

        data = json.loads(out.read_text(encoding="utf-8"))
        hit_ids = [h["Id"] for h in data["HitAreas"]]
        assert "HitAreaHead" in hit_ids
        assert "HitAreaBody" in hit_ids

    def test_custom_textures(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.model3.json"
        writer.write_model3_json(
            _make_skeleton(), out,
            texture_names=["tex_a.png", "tex_b.png"],
        )

        data = json.loads(out.read_text(encoding="utf-8"))
        assert len(data["FileReferences"]["Textures"]) == 2

    def test_with_expressions_and_motions(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.model3.json"
        writer.write_model3_json(
            _make_skeleton(), out,
            expressions=[{"Name": "happy", "File": "expressions/h.exp3.json"}],
            motions={"idle": [{"File": "motions/idle.motion3.json"}]},
        )

        data = json.loads(out.read_text(encoding="utf-8"))
        assert len(data["FileReferences"]["Expressions"]) == 1
        assert "idle" in data["FileReferences"]["Motions"]

    def test_generates_display_info(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.model3.json"
        writer.write_model3_json(_make_skeleton(), out)

        display_info_path = tmp_path / "model.displayinfo3.json"
        assert display_info_path.exists()

        data = json.loads(display_info_path.read_text(encoding="utf-8"))
        assert data["Version"] == 1
        assert "Parameters" in data
        assert "Parts" in data

    def test_display_info_chinese_names(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.model3.json"
        writer.write_model3_json(_make_skeleton(), out, layers=_make_layers())

        display_info_path = tmp_path / "model.displayinfo3.json"
        data = json.loads(display_info_path.read_text(encoding="utf-8"))

        # Check Chinese names exist
        param_names = {p["Id"]: p["Name"] for p in data["Parameters"]}
        assert param_names["ParamAngleX"] == "头部左右旋转"
        assert param_names["ParamTail"] == "尾巴摇摆"

    def test_display_info_has_all_parameters(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.model3.json"
        writer.write_model3_json(_make_skeleton(), out)

        display_info_path = tmp_path / "model.displayinfo3.json"
        data = json.loads(display_info_path.read_text(encoding="utf-8"))

        from cubism_bridge.cmo3_writer import ASTRALFOX_PARAMETERS
        assert len(data["Parameters"]) == len(ASTRALFOX_PARAMETERS)


# ── .cmo3 tests ────────────────────────────────────────────────────

class TestCMO3:
    def test_write_basic(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), out)

        assert out.exists()
        data = json.loads(out.read_text(encoding="utf-8"))

        assert data["Version"] == 3
        assert data["Meta"]["Name"] == "AstralFoxModel"
        assert data["Meta"]["SizeW"] == 3000
        assert data["Meta"]["SizeH"] == 4000

    def test_has_parameters(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), out)

        data = json.loads(out.read_text(encoding="utf-8"))
        param_ids = [p["Id"] for p in data["Parameters"]]

        assert "ParamAngleX" in param_ids
        assert "ParamTail" in param_ids
        assert "ParamMouthOpenY" in param_ids
        assert len(param_ids) == len(ASTRALFOX_PARAMETERS)

    def test_has_parts(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), out)

        data = json.loads(out.read_text(encoding="utf-8"))
        part_ids = [p["Id"] for p in data["Parts"]]

        assert "Part_body" in part_ids
        assert "Part_face" in part_ids
        assert "Part_eye_L" in part_ids

    def test_has_deformers(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), out)

        data = json.loads(out.read_text(encoding="utf-8"))
        assert len(data["Deformers"]) > 0

        # Check deformer tree structure
        root_def = data["Deformers"][0]
        assert root_def["Id"] == "Deformer_root"
        assert root_def["Type"] == "Rotation"  # has children
        assert len(root_def["Children"]) > 0

    def test_with_meshes(self, tmp_path):
        writer = CMO3Writer()
        meshes = [
            {"VertexCount": 4, "TriangleCount": 2, "Vertices": [[0,0],[1,0],[1,1],[0,1]], "Uvs": [[0,0],[1,0],[1,1],[0,1]], "Indices": [0,1,2,0,2,3]},
            {"VertexCount": 4, "TriangleCount": 2, "Vertices": [[0,0],[1,0],[1,1],[0,1]], "Uvs": [[0,0],[1,0],[1,1],[0,1]], "Indices": [0,1,2,0,2,3]},
            {"VertexCount": 4, "TriangleCount": 2, "Vertices": [[0,0],[1,0],[1,1],[0,1]], "Uvs": [[0,0],[1,0],[1,1],[0,1]], "Indices": [0,1,2,0,2,3]},
        ]
        out = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), out, meshes=meshes)

        data = json.loads(out.read_text(encoding="utf-8"))
        assert len(data["ArtMeshes"]) == 3
        assert data["ArtMeshes"][0]["VertexCount"] == 4

    def test_with_meshes_and_weights(self, tmp_path):
        writer = CMO3Writer()
        meshes = [
            {"vertex_count": 4, "triangle_count": 2, "vertices": [[0,0],[1,0],[1,1],[0,1]], "uvs": [[0,0],[1,0],[1,1],[0,1]], "indices": [0,1,2,0,2,3]},
        ]
        weights = [
            {
                "bone_names": ["root", "body"],
                "bone_count": 2,
                "weights": [
                    [{"BoneIndex": 0, "Weight": 1.0}],
                    [{"BoneIndex": 0, "Weight": 0.5}, {"BoneIndex": 1, "Weight": 0.5}],
                    [{"BoneIndex": 1, "Weight": 1.0}],
                    [{"BoneIndex": 1, "Weight": 1.0}],
                ],
            },
        ]
        out = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers()[:1], out, meshes=meshes, weights=weights)

        data = json.loads(out.read_text(encoding="utf-8"))
        mesh = data["ArtMeshes"][0]
        assert "VertexWeights" in mesh
        assert mesh["VertexWeights"]["BoneCount"] == 2
        assert len(mesh["VertexWeights"]["BoneNames"]) == 2
        assert len(mesh["VertexWeights"]["Weights"]) == 4

    def test_parameter_keyforms(self, tmp_path):
        writer = CMO3Writer()
        out = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), out)

        data = json.loads(out.read_text(encoding="utf-8"))
        angle_x = next(p for p in data["Parameters"] if p["Id"] == "ParamAngleX")
        assert angle_x["Min"] == -30
        assert angle_x["Max"] == 30
        assert angle_x["Default"] == 0
        assert len(angle_x["KeyForms"]) >= 1


# ── .moc3 tests ────────────────────────────────────────────────────

class TestMOC3Encoder:
    def test_encode_from_cmo3(self, tmp_path):
        writer = CMO3Writer()
        cmo3_path = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), cmo3_path)

        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode(cmo3_path, moc3_path)

        assert moc3_path.exists()
        assert moc3_path.stat().st_size >= 64

    def test_encode_from_data(self, tmp_path):
        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode_from_data(
            moc3_path,
            canvas_width=3000,
            canvas_height=4000,
            parameters=[{"Id": "ParamAngleX", "Min": -30, "Max": 30, "Default": 0}],
            parts=[{"Id": "Part_body"}],
            drawables=[{
                "Id": "Mesh_body",
                "VertexCount": 4,
                "TriangleCount": 2,
                "TextureIndex": 0,
                "Vertices": [[0, 0], [100, 0], [100, 100], [0, 100]],
                "Uvs": [[0, 0], [1, 0], [1, 1], [0, 1]],
                "Indices": [0, 1, 2, 0, 2, 3],
            }],
        )

        assert moc3_path.exists()
        valid, msg = MOC3Validator.validate(moc3_path)
        assert valid, msg

    def test_valid_header(self, tmp_path):
        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode_from_data(moc3_path)

        data = moc3_path.read_bytes()
        assert data[:4] == MOC3_MAGIC
        version = struct.unpack_from("<I", data, 4)[0]
        assert version == MOC3_VERSION

    def test_canvas_dimensions(self, tmp_path):
        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode_from_data(moc3_path, canvas_width=2000, canvas_height=3000)

        data = moc3_path.read_bytes()
        w = struct.unpack_from("<f", data, 20)[0]
        h = struct.unpack_from("<f", data, 24)[0]
        assert w == 2000.0
        assert h == 3000.0


class TestMOC3Validator:
    def test_valid_file(self, tmp_path):
        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode_from_data(moc3_path)

        valid, msg = MOC3Validator.validate(moc3_path)
        assert valid
        assert "Valid .moc3" in msg

    def test_nonexistent_file(self):
        valid, msg = MOC3Validator.validate("/nonexistent/model.moc3")
        assert not valid
        assert "not found" in msg.lower()

    def test_invalid_magic(self, tmp_path):
        bad_file = tmp_path / "bad.moc3"
        bad_file.write_bytes(b"NOPE" + b"\x00" * 100)
        valid, msg = MOC3Validator.validate(bad_file)
        assert not valid
        assert "magic" in msg.lower()

    def test_too_small(self, tmp_path):
        bad_file = tmp_path / "small.moc3"
        bad_file.write_bytes(b"MOC3")
        valid, msg = MOC3Validator.validate(bad_file)
        assert not valid


# ── Physics tests ──────────────────────────────────────────────────

class TestPhysicsConfig:
    def test_default_astralfox(self, tmp_path):
        config = PhysicsConfig.default_astralfox()
        settings = config.build_settings()

        ids = [s.id for s in settings]
        assert "PhysicsTail" in ids
        assert "PhysicsEarL" in ids
        assert "PhysicsEarR" in ids
        assert "PhysicsHairFront" in ids

    def test_write_json(self, tmp_path):
        config = PhysicsConfig.default_astralfox()
        out = tmp_path / "physics.json"
        config.write(out)

        assert out.exists()
        data = json.loads(out.read_text(encoding="utf-8"))

        assert data["Version"] == 2
        assert "Meta" in data
        assert "PhysicsSettings" in data
        assert data["Meta"]["PhysicsSettingCount"] == len(data["PhysicsSettings"])

    def test_pendulum_chain(self):
        config = PhysicsConfig()
        vertices = config._make_pendulum_chain(
            segments=5, stiffness=0.5, damping=0.3, length=1.2
        )
        assert len(vertices) == 6  # segments + 1
        # First vertex is anchor
        assert vertices[0].delay == 0.0
        # Last vertex has max delay
        assert vertices[-1].delay > vertices[0].delay

    def test_input_output_format(self, tmp_path):
        config = PhysicsConfig.default_astralfox()
        out = tmp_path / "physics.json"
        config.write(out)

        data = json.loads(out.read_text(encoding="utf-8"))
        setting = data["PhysicsSettings"][0]

        # Input is an array
        assert isinstance(setting["Input"], list)
        assert setting["Input"][0]["Source"] == "Parameter"
        assert "SourceId" in setting["Input"][0]

        # Output is an array
        assert isinstance(setting["Output"], list)
        assert "SourceId" in setting["Output"][0]
        assert "VertexIndex" in setting["Output"][0]

    def test_from_json_preset(self, tmp_path):
        preset_data = {
            "hair": {"stiffness": 0.7, "damping": 0.2, "mass": 0.8, "pendulum_length": 1.5},
            "tail": {"stiffness": 0.4, "damping": 0.6, "mass": 2.0, "pendulum_length": 2.0},
            "ear": {"stiffness": 0.8, "damping": 0.3, "mass": 0.5, "pendulum_length": 0.3},
        }
        preset_path = tmp_path / "preset.json"
        preset_path.write_text(json.dumps(preset_data))

        preset = PhysicsPreset.from_json(preset_path)
        assert preset.hair_stiffness == 0.7
        assert preset.tail_length == 2.0

        config = PhysicsConfig(preset=preset)
        settings = config.build_settings()
        assert len(settings) > 0


# ── Mesh generator tests ───────────────────────────────────────────

class TestMeshGenerator:
    def _make_circle_mask(self, size: int = 200, radius: int = 80) -> np.ndarray:
        """Create a circular mask for testing."""
        mask = np.zeros((size, size), dtype=np.uint8)
        center = size // 2
        cv2 = pytest.importorskip("cv2")
        cv2.circle(mask, (center, center), radius, 255, -1)
        return mask

    def test_generate_basic(self):
        mask = self._make_circle_mask()
        gen = MeshGenerator(density="medium")
        mesh = gen.generate(mask)

        assert isinstance(mesh, MeshData)
        assert mesh.vertex_count >= 3
        assert mesh.triangle_count >= 1
        assert mesh.vertices.shape == (mesh.vertex_count, 2)
        assert mesh.triangles.shape == (mesh.triangle_count, 3)
        assert mesh.uvs.shape == (mesh.vertex_count, 2)

    def test_uv_range(self):
        mask = self._make_circle_mask()
        gen = MeshGenerator(density="medium")
        mesh = gen.generate(mask)

        # UVs should be in [0, 1]
        assert mesh.uvs.min() >= 0.0
        assert mesh.uvs.max() <= 1.0

    def test_density_levels(self):
        mask = self._make_circle_mask(size=300)
        low = MeshGenerator(density="low").generate(mask)
        high = MeshGenerator(density="high").generate(mask)

        # Higher density should have more vertices
        assert high.vertex_count > low.vertex_count

    def test_invalid_density(self):
        with pytest.raises(ValueError, match="Unknown density"):
            MeshGenerator(density="ultra")

    def test_empty_mask(self):
        mask = np.zeros((100, 100), dtype=np.uint8)
        gen = MeshGenerator()
        mesh = gen.generate(mask)

        # Should fallback to quad
        assert mesh.vertex_count >= 3

    def test_cubism_format(self):
        mask = self._make_circle_mask()
        gen = MeshGenerator(density="low")
        mesh = gen.generate(mask)

        cubism = mesh.to_cubism_format()
        assert "VertexCount" in cubism
        assert "TriangleCount" in cubism
        assert "Vertices" in cubism
        assert "Uvs" in cubism
        assert "Indices" in cubism


# ── JSON-MOC3 Consistency Tests ────────────────────────────────

class TestJSONMOC3Consistency:
    """Verify that JSON and moc3 files contain consistent data."""

    def test_parameter_count_consistency(self, tmp_path):
        """Parameter count in JSON matches moc3 header."""
        writer = CMO3Writer()
        cmo3_path = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), cmo3_path)

        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode(cmo3_path, moc3_path)

        moc3_data = MOC3Reader.read(moc3_path)
        cmo3_data = json.loads(cmo3_path.read_text(encoding="utf-8"))

        assert moc3_data.parameter_count == len(cmo3_data["Parameters"])

    def test_part_count_consistency(self, tmp_path):
        """Part count in JSON matches moc3 header."""
        writer = CMO3Writer()
        cmo3_path = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), cmo3_path)

        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode(cmo3_path, moc3_path)

        moc3_data = MOC3Reader.read(moc3_path)
        cmo3_data = json.loads(cmo3_path.read_text(encoding="utf-8"))

        assert moc3_data.part_count == len(cmo3_data["Parts"])

    def test_drawable_count_consistency(self, tmp_path):
        """Drawable/ArtMesh count in JSON matches moc3 header."""
        writer = CMO3Writer()
        cmo3_path = tmp_path / "model.cmo3"

        meshes = [
            {"VertexCount": 4, "TriangleCount": 2, "Vertices": [[0,0],[1,0],[1,1],[0,1]], "Uvs": [[0,0],[1,0],[1,1],[0,1]], "Indices": [0,1,2,0,2,3]},
            {"VertexCount": 4, "TriangleCount": 2, "Vertices": [[0,0],[1,0],[1,1],[0,1]], "Uvs": [[0,0],[1,0],[1,1],[0,1]], "Indices": [0,1,2,0,2,3]},
        ]
        writer.write_cmo3(_make_skeleton(), _make_layers()[:2], cmo3_path, meshes=meshes)

        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode(cmo3_path, moc3_path)

        moc3_data = MOC3Reader.read(moc3_path)
        cmo3_data = json.loads(cmo3_path.read_text(encoding="utf-8"))

        assert moc3_data.drawable_count == len(cmo3_data["ArtMeshes"])

    def test_canvas_dimensions_consistency(self, tmp_path):
        """Canvas dimensions in JSON matches moc3 header."""
        writer = CMO3Writer()
        cmo3_path = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), cmo3_path)

        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode(cmo3_path, moc3_path)

        moc3_data = MOC3Reader.read(moc3_path)
        cmo3_data = json.loads(cmo3_path.read_text(encoding="utf-8"))

        assert abs(moc3_data.canvas_width - cmo3_data["Meta"]["SizeW"]) < 0.01
        assert abs(moc3_data.canvas_height - cmo3_data["Meta"]["SizeH"]) < 0.01

    def test_compare_with_json_method(self, tmp_path):
        """MOC3Reader.compare_with_json returns no differences."""
        writer = CMO3Writer()
        cmo3_path = tmp_path / "model.cmo3"
        writer.write_cmo3(_make_skeleton(), _make_layers(), cmo3_path)

        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode(cmo3_path, moc3_path)

        is_consistent, differences = MOC3Reader.compare_with_json(moc3_path, cmo3_path)
        assert is_consistent, f"Differences found: {differences}"

    def test_roundtrip_with_meshes(self, tmp_path):
        """Roundtrip test: generate with meshes, verify consistency."""
        writer = CMO3Writer()
        cmo3_path = tmp_path / "model.cmo3"

        meshes = [
            {"VertexCount": 4, "TriangleCount": 2, "Vertices": [[0,0],[100,0],[100,100],[0,100]], "Uvs": [[0,0],[1,0],[1,1],[0,1]], "Indices": [0,1,2,0,2,3]},
            {"VertexCount": 3, "TriangleCount": 1, "Vertices": [[0,0],[50,0],[25,50]], "Uvs": [[0,0],[1,0],[0.5,1]], "Indices": [0,1,2]},
        ]
        writer.write_cmo3(_make_skeleton(), _make_layers()[:2], cmo3_path, meshes=meshes)

        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"
        encoder.encode(cmo3_path, moc3_path)

        moc3_data = MOC3Reader.read(moc3_path)
        cmo3_data = json.loads(cmo3_path.read_text(encoding="utf-8"))

        # Verify all counts match
        assert moc3_data.parameter_count == len(cmo3_data["Parameters"])
        assert moc3_data.part_count == len(cmo3_data["Parts"])
        assert moc3_data.drawable_count == len(cmo3_data["ArtMeshes"])

        # Verify moc3 is valid
        valid, msg = MOC3Validator.validate(moc3_path)
        assert valid, msg

    def test_encode_from_data_consistency(self, tmp_path):
        """encode_from_data produces consistent moc3."""
        encoder = MOC3Encoder()
        moc3_path = tmp_path / "model.moc3"

        params = [
            {"Id": "ParamAngleX", "Min": -30, "Max": 30, "Default": 0},
            {"Id": "ParamAngleY", "Min": -30, "Max": 30, "Default": 0},
            {"Id": "ParamTail", "Min": 0, "Max": 1, "Default": 0.5},
        ]
        parts = [{"Id": "Part_body"}, {"Id": "Part_face"}]
        drawables = [{
            "Id": "Mesh_body",
            "VertexCount": 4,
            "TriangleCount": 2,
            "TextureIndex": 0,
            "Vertices": [[0, 0], [100, 0], [100, 100], [0, 100]],
            "Uvs": [[0, 0], [1, 0], [1, 1], [0, 1]],
            "Indices": [0, 1, 2, 0, 2, 3],
        }]

        encoder.encode_from_data(moc3_path, parameters=params, parts=parts, drawables=drawables)

        moc3_data = MOC3Reader.read(moc3_path)
        assert moc3_data.parameter_count == 3
        assert moc3_data.part_count == 2
        assert moc3_data.drawable_count == 1
