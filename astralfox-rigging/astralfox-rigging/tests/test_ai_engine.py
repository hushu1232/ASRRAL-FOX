"""Test AI engine modules."""

import numpy as np
import pytest

from ai_engine.layer_separator import (
    SeparatedLayer, SimpleLayerSeparator,
    SmartLayerSeparator, create_separator,
    get_bbox, mask_to_texture,
)
from ai_engine.semantic_classifier import (
    RuleBasedClassifier, PositionAwareClassifier,
    LABELS,
)
from ai_engine.expression_generator import (
    SimpleExpressionGenerator, ExpressionVariant,
)


# ── Fixtures ───────────────────────────────────────────────────────

def _make_test_image(size: int = 200) -> np.ndarray:
    """Create a simple test image with face-like features."""
    img = np.ones((size, size, 3), dtype=np.uint8) * 200  # gray bg

    # Face oval
    cv2 = pytest.importorskip("cv2")
    center = (size // 2, size // 2)
    cv2.ellipse(img, center, (60, 80), 0, 0, 360, (255, 200, 180), -1)

    # Eyes
    cv2.circle(img, (size // 2 - 25, size // 2 - 15), 8, (50, 50, 50), -1)
    cv2.circle(img, (size // 2 + 25, size // 2 - 15), 8, (50, 50, 50), -1)

    # Mouth
    cv2.ellipse(img, (size // 2, size // 2 + 25), (15, 8), 0, 0, 180, (50, 50, 50), 2)

    return img


def _make_circle_mask(size: int = 200, center: tuple = (100, 100), radius: int = 50) -> np.ndarray:
    mask = np.zeros((size, size), dtype=np.uint8)
    cv2 = pytest.importorskip("cv2")
    cv2.circle(mask, center, radius, 255, -1)
    return mask


# ── Utility tests ──────────────────────────────────────────────────

class TestUtils:
    def test_get_bbox(self):
        mask = np.zeros((100, 100), dtype=np.uint8)
        mask[20:50, 30:70] = 255
        bbox = get_bbox(mask)
        assert bbox == [30, 20, 40, 30]

    def test_get_bbox_empty(self):
        mask = np.zeros((100, 100), dtype=np.uint8)
        bbox = get_bbox(mask)
        assert bbox == [0, 0, 0, 0]

    def test_mask_to_texture(self):
        img = np.ones((10, 10, 3), dtype=np.uint8) * 128
        mask = np.ones((10, 10), dtype=np.uint8) * 255
        tex = mask_to_texture(img, mask)
        assert tex.shape == (10, 10, 4)
        assert (tex[:, :, 3] == 255).all()


# ── SeparatedLayer tests ──────────────────────────────────────────

class TestSeparatedLayer:
    def test_area(self):
        mask = np.zeros((100, 100), dtype=np.uint8)
        mask[10:20, 10:20] = 255
        layer = SeparatedLayer(label="test", texture=np.zeros((100, 100, 4), dtype=np.uint8), mask=mask)
        assert layer.area == 100

    def test_save(self, tmp_path):
        mask = np.ones((10, 10), dtype=np.uint8) * 255
        tex = np.ones((10, 10, 4), dtype=np.uint8) * 128
        layer = SeparatedLayer(label="body", texture=tex, mask=mask)

        layer.save_texture(tmp_path / "tex.png")
        layer.save_mask(tmp_path / "mask.png")
        assert (tmp_path / "tex.png").exists()
        assert (tmp_path / "mask.png").exists()


# ── Semantic classifier tests ─────────────────────────────────────

class TestRuleBasedClassifier:
    def test_classify_body(self):
        img = _make_test_image()
        # Large mask at bottom → body
        mask = np.zeros((200, 200), dtype=np.uint8)
        mask[120:200, :] = 255
        classifier = RuleBasedClassifier()
        label, score = classifier.classify(img, mask)
        assert label == "body"
        assert score > 0.5

    def test_classify_face(self):
        img = _make_test_image()
        mask = _make_circle_mask(center=(100, 100), radius=50)
        classifier = RuleBasedClassifier()
        label, score = classifier.classify(img, mask)
        # Should be a valid label (face or body depending on position)
        assert label in ("face", "eye_L", "eye_R", "mouth", "body")
        assert score > 0

    def test_classify_eyebrow(self):
        img = _make_test_image()
        # Small mask at upper-center → eyebrow
        mask = np.zeros((200, 200), dtype=np.uint8)
        mask[55:65, 65:95] = 255
        classifier = RuleBasedClassifier()
        label, score = classifier.classify(img, mask)
        assert "eyebrow" in label or "accessory" in label or "hair" in label

    def test_classify_returns_valid_label(self):
        img = _make_test_image()
        mask = _make_circle_mask()
        classifier = RuleBasedClassifier()
        label, score = classifier.classify(img, mask)
        assert label in LABELS
        assert 0 <= score <= 1


class TestPositionAwareClassifier:
    def test_classify_all_returns_valid_labels(self):
        img = _make_test_image()
        # Two masks at different positions
        mask1 = np.zeros((200, 200), dtype=np.uint8)
        mask1[10:60, 30:90] = 255
        mask2 = np.zeros((200, 200), dtype=np.uint8)
        mask2[10:60, 110:170] = 255

        classifier = PositionAwareClassifier()
        results = classifier.classify_all(img, [mask1, mask2])
        labels = [r[0] for r in results]

        # All labels should be valid
        for label in labels:
            assert label in LABELS
        # Should return same number of results as input masks
        assert len(results) == 2


# ── Expression generator tests ─────────────────────────────────────

class TestSimpleExpressionGenerator:
    def test_generate_all_targets(self):
        face = np.ones((200, 200, 4), dtype=np.uint8) * 128
        gen = SimpleExpressionGenerator()
        variants = gen.generate(face)
        assert len(variants) > 0
        names = [v.name for v in variants]
        assert "eye_close_L" in names
        assert "mouth_open" in names

    def test_generate_specific_target(self):
        face = np.ones((200, 200, 4), dtype=np.uint8) * 128
        gen = SimpleExpressionGenerator()
        variants = gen.generate(face, targets=["mouth_smile"])
        assert len(variants) == 1
        assert variants[0].name == "mouth_smile"

    def test_variant_has_correct_shape(self):
        face = np.ones((200, 200, 4), dtype=np.uint8) * 128
        gen = SimpleExpressionGenerator()
        variants = gen.generate(face, targets=["eye_close_L"])
        assert variants[0].texture.shape == (200, 200, 4)

    def test_blend_weight_range(self):
        face = np.ones((200, 200, 4), dtype=np.uint8) * 128
        gen = SimpleExpressionGenerator()
        for v in gen.generate(face):
            assert 0 <= v.blend_weight <= 1

    def test_custom_regions(self):
        face = np.ones((200, 200, 4), dtype=np.uint8) * 128
        gen = SimpleExpressionGenerator()
        variants = gen.generate(
            face,
            targets=["eye_close_L"],
            regions={"eye_close_L": (30, 50, 40, 25)},
        )
        assert len(variants) == 1
        assert variants[0].region == (30, 50, 40, 25)

    def test_estimate_region(self):
        gen = SimpleExpressionGenerator()
        r = gen._estimate_region(1000, 2000, "eye_close_L")
        assert r is not None
        x, y, w, h = r
        assert 0 <= x < 1000
        assert 0 <= y < 2000


# ── Factory test ───────────────────────────────────────────────────

class TestFactory:
    def test_create_simple(self):
        sep = create_separator(backend="simple")
        assert isinstance(sep, SimpleLayerSeparator)
