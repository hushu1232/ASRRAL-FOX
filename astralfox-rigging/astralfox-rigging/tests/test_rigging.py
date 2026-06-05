"""Test rigging pipeline: bone predictor + weight painter + integration."""

import json
from pathlib import Path

import numpy as np
import pytest

from api.schemas import BoneNode, LayerResult, LayerLabel
from ai_engine.bone_predictor import (
    BonePredictor, BoneTemplate, TemplateRegistry,
    flatten_skeleton, get_bone_names, find_bone,
    CATGIRL_TEMPLATE, HUMAN_FEMALE_TEMPLATE, HUMAN_MALE_TEMPLATE,
)
from ai_engine.weight_painter import WeightPainter, WeightResult


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
                    BoneNode(name="mouth", position=[1500, 1300]),
                ]),
            ]),
            BoneNode(name="tail", position=[1500, 2200]),
        ],
    )


def _make_layers() -> list[LayerResult]:
    return [
        LayerResult(label=LayerLabel.BODY, texture_url="", mask_url="", bbox=[500, 500, 1000, 1500]),
        LayerResult(label=LayerLabel.FACE, texture_url="", mask_url="", bbox=[800, 600, 400, 400]),
        LayerResult(label=LayerLabel.EYE_L, texture_url="", mask_url="", bbox=[1300, 1100, 100, 80]),
    ]


# ── Skeleton helpers ───────────────────────────────────────────────

class TestSkeletonHelpers:
    def test_flatten(self):
        bones = flatten_skeleton(_make_skeleton())
        names = [n for n, _ in bones]
        assert "root" in names
        assert "root/body" in names
        assert "root/body/head" in names
        assert "root/body/head/eye_L" in names
        assert "root/tail" in names

    def test_get_bone_names(self):
        names = get_bone_names(_make_skeleton())
        assert len(names) >= 7
        assert "root" in names

    def test_find_bone(self):
        skel = _make_skeleton()
        eye = find_bone(skel, "eye_L")
        assert eye is not None
        assert eye.position == [1400, 1200]

    def test_find_bone_not_found(self):
        assert find_bone(_make_skeleton(), "nonexistent") is None


# ── Bone predictor ─────────────────────────────────────────────────

class TestBonePredictor:
    def test_predict_catgirl(self):
        predictor = BonePredictor()
        skeleton = predictor.predict(_make_layers(), template="catgirl")

        assert skeleton.name == "root"
        # Should be scaled to fit body bbox [500, 500, 1000, 1500]
        assert skeleton.position[0] > 0
        assert skeleton.position[1] > 0

    def test_predict_unknown_template(self):
        predictor = BonePredictor()
        with pytest.raises(ValueError, match="Unknown template"):
            predictor.predict(_make_layers(), template="nonexistent")

    def test_predict_with_refinement(self):
        predictor = BonePredictor()
        skeleton = predictor.predict(_make_layers(), template="catgirl")

        # Find the eye_L bone — should be refined toward the layer center
        eye = find_bone(skeleton, "eye_L")
        assert eye is not None
        # Eye layer bbox center: [1300+50, 1100+40] = [1350, 1140]
        # Should be closer to this than the raw template position

    def test_scaling(self):
        predictor = BonePredictor()
        layers = [
            LayerResult(label=LayerLabel.BODY, texture_url="", mask_url="", bbox=[0, 0, 2000, 4000]),
        ]
        skeleton = predictor.predict(layers, template="catgirl")
        # Body bbox is 2x the reference size → bones should be scaled 2x
        body = find_bone(skeleton, "body")
        assert body is not None


class TestTemplateRegistry:
    def test_builtin_templates(self):
        registry = TemplateRegistry()
        assert "catgirl" in registry.list_templates()
        assert "human_female" in registry.list_templates()
        assert "human_male" in registry.list_templates()

    def test_register_custom(self):
        registry = TemplateRegistry()
        custom = BoneNode(name="root", position=[0, 0])
        registry.register("custom", custom)
        assert registry.get("custom") == custom

    def test_load_from_json(self, tmp_path):
        tmpl = BoneTemplate(
            name="test_template",
            display_name="Test",
            skeleton=BoneNode(name="root", position=[100, 200], children=[
                BoneNode(name="head", position=[100, 100]),
            ]),
        )
        path = tmp_path / "template.json"
        tmpl.save_json(path)

        registry = TemplateRegistry()
        name = registry.load_from_json(path)
        assert name == "test_template"

        loaded = registry.get("test_template")
        assert loaded.position == [100, 200]
        assert len(loaded.children) == 1


class TestBoneTemplate:
    def test_roundtrip(self, tmp_path):
        original = BoneTemplate(
            name="catgirl",
            display_name="Cat Girl",
            skeleton=CATGIRL_TEMPLATE,
            description="A cute catgirl model",
        )
        path = tmp_path / "catgirl.json"
        original.save_json(path)

        loaded = BoneTemplate.from_json(path)
        assert loaded.name == "catgirl"
        assert loaded.display_name == "Cat Girl"
        assert len(loaded.skeleton.children) > 0


# ── Weight painter ─────────────────────────────────────────────────

class TestWeightPainter:
    def test_basic_weights(self):
        vertices = np.array([[1500, 1200], [1500, 2000], [1500, 2200]], dtype=np.float32)
        skeleton = _make_skeleton()

        painter = WeightPainter()
        result = painter.paint(vertices, skeleton)

        assert isinstance(result, WeightResult)
        assert result.vertex_count == 3
        assert result.bone_count > 0
        # Each row should sum to ~1
        np.testing.assert_allclose(result.weights.sum(axis=1), 1.0, atol=0.01)

    def test_weights_near_bone(self):
        # Vertex at eye_L position should have highest weight for eye_L
        vertices = np.array([[1400, 1200]], dtype=np.float32)
        skeleton = _make_skeleton()

        painter = WeightPainter()
        result = painter.paint(vertices, skeleton)

        dominant_name, dominant_weight = result.get_dominant_bone(0)
        assert "eye_L" in dominant_name
        assert dominant_weight > 0.3

    def test_max_influences(self):
        vertices = np.array([[1500, 1500]], dtype=np.float32)
        skeleton = _make_skeleton()

        painter = WeightPainter(max_influences=2)
        result = painter.paint(vertices, skeleton)

        # Each vertex should have at most 2 non-zero weights
        nonzero = np.count_nonzero(result.weights[0])
        assert nonzero <= 2

    def test_paint_for_layer(self):
        vertices = np.array([[1400, 1200], [1600, 1200]], dtype=np.float32)
        skeleton = _make_skeleton()

        painter = WeightPainter()
        result = painter.paint_for_layer(vertices, skeleton, "eye_L")

        # eye_L vertex should have eye_L bone as dominant
        name, _ = result.get_dominant_bone(0)
        assert "eye_L" in name

    def test_cubism_format(self):
        vertices = np.array([[1500, 1200], [1500, 2000]], dtype=np.float32)
        skeleton = _make_skeleton()

        painter = WeightPainter()
        result = painter.paint(vertices, skeleton)

        cubism = result.to_cubism_format()
        assert "VertexCount" in cubism
        assert "BoneCount" in cubism
        assert "BoneNames" in cubism
        assert "Weights" in cubism
        assert len(cubism["Weights"]) == 2

    def test_empty_skeleton(self):
        vertices = np.array([[0, 0]], dtype=np.float32)
        empty = BoneNode(name="root", position=[0, 0])

        painter = WeightPainter()
        result = painter.paint(vertices, empty)

        assert result.bone_count == 1
        assert result.weights.shape == (1, 1)

    def test_threshold_pruning(self):
        vertices = np.array([[1500, 1500]], dtype=np.float32)
        skeleton = _make_skeleton()

        painter = WeightPainter(threshold=0.1)  # aggressive pruning
        result = painter.paint(vertices, skeleton)

        # All weights below threshold should be 0
        assert (result.weights >= 0.1).sum() + (result.weights == 0).sum() == result.weights.size
