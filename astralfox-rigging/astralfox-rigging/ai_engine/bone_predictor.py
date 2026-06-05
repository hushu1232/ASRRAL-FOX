"""Bone predictor: layer images → skeleton tree.

Uses semantic labels + image analysis to predict bone positions
for a Live2D-compatible skeleton.

Two modes:
- Template-based: scale/offset a predefined skeleton to fit the image
- CNN-based: predict keypoint positions from layer images (TODO)
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np

from api.schemas import BoneNode, LayerResult


# ── Skeleton templates ─────────────────────────────────────────────

CATGIRL_TEMPLATE = BoneNode(
    name="root",
    position=[1500, 2000],
    children=[
        BoneNode(name="body", position=[1500, 2000], children=[
            BoneNode(name="head", position=[1500, 1200], children=[
                BoneNode(name="hair_front", position=[1500, 1100]),
                BoneNode(name="eye_L", position=[1400, 1200]),
                BoneNode(name="eye_R", position=[1600, 1200]),
                BoneNode(name="eyebrow_L", position=[1400, 1150]),
                BoneNode(name="eyebrow_R", position=[1600, 1150]),
                BoneNode(name="mouth", position=[1500, 1300]),
                BoneNode(name="ear_L", position=[1350, 1050]),
                BoneNode(name="ear_R", position=[1650, 1050]),
            ]),
            BoneNode(name="arm_L", position=[1300, 1600]),
            BoneNode(name="arm_R", position=[1700, 1600]),
        ]),
        BoneNode(name="hair_back", position=[1500, 1000]),
        BoneNode(name="tail", position=[1500, 2200]),
    ],
)

HUMAN_FEMALE_TEMPLATE = BoneNode(
    name="root",
    position=[1500, 2000],
    children=[
        BoneNode(name="body", position=[1500, 2000], children=[
            BoneNode(name="head", position=[1500, 1200], children=[
                BoneNode(name="hair_front", position=[1500, 1100]),
                BoneNode(name="hair_side_L", position=[1350, 1150]),
                BoneNode(name="hair_side_R", position=[1650, 1150]),
                BoneNode(name="eye_L", position=[1400, 1200]),
                BoneNode(name="eye_R", position=[1600, 1200]),
                BoneNode(name="eyebrow_L", position=[1400, 1150]),
                BoneNode(name="eyebrow_R", position=[1600, 1150]),
                BoneNode(name="mouth", position=[1500, 1300]),
            ]),
            BoneNode(name="arm_L", position=[1300, 1600]),
            BoneNode(name="arm_R", position=[1700, 1600]),
        ]),
        BoneNode(name="hair_back", position=[1500, 1000]),
    ],
)

HUMAN_MALE_TEMPLATE = BoneNode(
    name="root",
    position=[1500, 2000],
    children=[
        BoneNode(name="body", position=[1500, 2000], children=[
            BoneNode(name="head", position=[1500, 1200], children=[
                BoneNode(name="hair_front", position=[1500, 1100]),
                BoneNode(name="eye_L", position=[1400, 1200]),
                BoneNode(name="eye_R", position=[1600, 1200]),
                BoneNode(name="eyebrow_L", position=[1400, 1150]),
                BoneNode(name="eyebrow_R", position=[1600, 1150]),
                BoneNode(name="mouth", position=[1500, 1300]),
            ]),
            BoneNode(name="arm_L", position=[1300, 1600]),
            BoneNode(name="arm_R", position=[1700, 1600]),
        ]),
        BoneNode(name="hair_back", position=[1500, 1000]),
    ],
)

BUILTIN_TEMPLATES: dict[str, BoneNode] = {
    "catgirl": CATGIRL_TEMPLATE,
    "human_female": HUMAN_FEMALE_TEMPLATE,
    "human_male": HUMAN_MALE_TEMPLATE,
}


# ── Template data model for JSON serialization ─────────────────────

@dataclass
class BoneTemplate:
    """Serializable bone template with metadata."""
    name: str
    display_name: str
    skeleton: BoneNode
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "displayName": self.display_name,
            "description": self.description,
            "skeleton": self._bone_to_dict(self.skeleton),
        }

    @staticmethod
    def _bone_to_dict(bone: BoneNode) -> dict:
        return {
            "name": bone.name,
            "position": bone.position,
            "children": [BoneTemplate._bone_to_dict(c) for c in bone.children],
        }

    @classmethod
    def from_dict(cls, data: dict) -> BoneTemplate:
        return cls(
            name=data["name"],
            display_name=data.get("displayName", data["name"]),
            description=data.get("description", ""),
            skeleton=cls._dict_to_bone(data["skeleton"]),
        )

    @staticmethod
    def _dict_to_bone(data: dict) -> BoneNode:
        return BoneNode(
            name=data["name"],
            position=data["position"],
            children=[BoneTemplate._dict_to_bone(c) for c in data.get("children", [])],
        )

    @classmethod
    def from_json(cls, path: str | Path) -> BoneTemplate:
        with open(path, encoding="utf-8") as f:
            return cls.from_dict(json.load(f))

    def save_json(self, path: str | Path) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)


# ── Template registry ──────────────────────────────────────────────

class TemplateRegistry:
    """Manage bone templates (built-in + user-defined)."""

    def __init__(self):
        self._templates: dict[str, BoneNode] = dict(BUILTIN_TEMPLATES)

    def get(self, name: str) -> BoneNode:
        if name not in self._templates:
            raise ValueError(f"Unknown template: {name}. Available: {list(self._templates)}")
        return self._templates[name]

    def register(self, name: str, skeleton: BoneNode) -> None:
        self._templates[name] = skeleton

    def load_from_json(self, path: str | Path) -> str:
        tmpl = BoneTemplate.from_json(path)
        self.register(tmpl.name, tmpl.skeleton)
        return tmpl.name

    def list_templates(self) -> list[str]:
        return list(self._templates.keys())


# Global registry
_registry = TemplateRegistry()


def get_registry() -> TemplateRegistry:
    return _registry


# ── BonePredictor ──────────────────────────────────────────────────

class BonePredictor:
    """Predict skeleton from separated layers.

    Template mode: scales a predefined skeleton to fit the image.
    CNN mode: predicts keypoint positions (TODO).
    """

    # Reference template dimensions (the template is designed for this size)
    REF_WIDTH = 1000
    REF_HEIGHT = 2000

    def __init__(
        self,
        checkpoint: Optional[str] = None,
        device: str = "cuda",
        template_registry: TemplateRegistry | None = None,
    ):
        self.device = device
        self.checkpoint = checkpoint
        self.registry = template_registry or _registry

    def predict(
        self,
        layers: list[LayerResult],
        template: str = "catgirl",
    ) -> BoneNode:
        """Predict skeleton for the given layers.

        Args:
            layers: Separated layer results with bboxes.
            template: Template name (e.g., "catgirl").

        Returns:
            Root BoneNode of the predicted skeleton.
        """
        if self.checkpoint:
            return self._predict_cnn(layers)

        tmpl_skeleton = self.registry.get(template)
        return self._fit_template(tmpl_skeleton, layers)

    def _fit_template(
        self, template: BoneNode, layers: list[LayerResult]
    ) -> BoneNode:
        """Scale and offset a template skeleton to fit the actual layer bboxes.

        The fitting uses the body layer's bbox as the primary reference,
        then adjusts specific bones based on their corresponding layer bboxes.
        """
        # Build label → bbox map
        bbox_map: dict[str, list[int]] = {}
        for l in layers:
            bbox_map[l.label.value] = l.bbox

        # Primary scaling from body layer
        body_bbox = bbox_map.get("body")
        if body_bbox and body_bbox[2] > 0 and body_bbox[3] > 0:
            scale_x = body_bbox[2] / self.REF_WIDTH
            scale_y = body_bbox[3] / self.REF_HEIGHT
            offset_x = body_bbox[0]
            offset_y = body_bbox[1]
        else:
            scale_x, scale_y = 1.0, 1.0
            offset_x, offset_y = 0, 0

        # Transform the entire skeleton
        skeleton = self._transform_bone(template, scale_x, scale_y, offset_x, offset_y)

        # Fine-tune specific bones using their layer bboxes
        skeleton = self._refine_from_layers(skeleton, bbox_map, scale_x, scale_y, offset_x, offset_y)

        return skeleton

    def _refine_from_layers(
        self,
        skeleton: BoneNode,
        bbox_map: dict[str, list[int]],
        sx: float, sy: float,
        ox: float, oy: float,
    ) -> BoneNode:
        """Refine bone positions using actual layer bbox centers.

        For each bone that has a corresponding layer, snap the bone
        to the center of that layer's bbox.
        """
        return self._refine_recursive(skeleton, bbox_map)

    def _refine_recursive(
        self, bone: BoneNode, bbox_map: dict[str, list[int]]
    ) -> BoneNode:
        """Recursively refine bone positions."""
        # If this bone has a matching layer, snap to its center
        if bone.name in bbox_map:
            bbox = bbox_map[bone.name]
            if bbox[2] > 0 and bbox[3] > 0:
                center_x = bbox[0] + bbox[2] / 2
                center_y = bbox[1] + bbox[3] / 2
                # Blend: 70% template position, 30% layer center
                bone = BoneNode(
                    name=bone.name,
                    position=[
                        bone.position[0] * 0.7 + center_x * 0.3,
                        bone.position[1] * 0.7 + center_y * 0.3,
                    ],
                    children=bone.children,
                )

        # Recurse into children
        children = [
            self._refine_recursive(c, bbox_map)
            for c in bone.children
        ]

        return BoneNode(name=bone.name, position=bone.position, children=children)

    def _predict_cnn(self, layers: list[LayerResult]) -> BoneNode:
        """CNN-based keypoint prediction (TODO: implement training)."""
        raise NotImplementedError("CNN bone predictor not yet trained")

    @staticmethod
    def _transform_bone(
        bone: BoneNode,
        sx: float, sy: float,
        ox: float, oy: float,
    ) -> BoneNode:
        """Recursively transform bone positions."""
        new_x = bone.position[0] * sx + ox
        new_y = bone.position[1] * sy + oy
        children = [
            BonePredictor._transform_bone(c, sx, sy, ox, oy)
            for c in bone.children
        ]
        return BoneNode(name=bone.name, position=[new_x, new_y], children=children)


# ── Helper: flatten skeleton ───────────────────────────────────────

def flatten_skeleton(bone: BoneNode, prefix: str = "") -> list[tuple[str, list[float]]]:
    """Flatten bone tree into (full_name, position) list."""
    full_name = f"{prefix}/{bone.name}" if prefix else bone.name
    result = [(full_name, bone.position)]
    for child in bone.children:
        result.extend(flatten_skeleton(child, full_name))
    return result


def get_bone_names(skeleton: BoneNode) -> list[str]:
    """Get flat list of all bone names."""
    return [name for name, _ in flatten_skeleton(skeleton)]


def find_bone(skeleton: BoneNode, name: str) -> BoneNode | None:
    """Find a bone by name in the tree."""
    if skeleton.name == name:
        return skeleton
    for child in skeleton.children:
        found = find_bone(child, name)
        if found:
            return found
    return None
