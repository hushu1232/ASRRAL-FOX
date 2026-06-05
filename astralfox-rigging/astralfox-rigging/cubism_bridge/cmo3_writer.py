"""Cubism format writer — generates .model3.json and .cmo3 files.

.model3.json: Runtime configuration loaded by Cubism SDK at runtime.
    Contains FileReferences, Groups, HitAreas.

.cmo3: Cubism Editor project file (JSON-based, simplified).
    Contains the full model definition for editing in Cubism Editor.

Reference: Cubism SDK CubismModelJson.hpp, CubismModelSettingJson.hpp
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from api.schemas import BoneNode, LayerResult


# ── AstralFox standard parameter definitions ───────────────────────

ASTRALFOX_PARAMETERS = [
    # (Id, Name, Min, Max, Default, Group)
    ("ParamAngleX", "Head Angle X", -30, 30, 0, "Head"),
    ("ParamAngleY", "Head Angle Y", -30, 30, 0, "Head"),
    ("ParamAngleZ", "Head Angle Z", -30, 30, 0, "Head"),
    ("ParamBodyAngleX", "Body Angle X", -10, 10, 0, "Body"),
    ("ParamBodyAngleY", "Body Angle Y", -10, 10, 0, "Body"),
    ("ParamBodyAngleZ", "Body Angle Z", -10, 10, 0, "Body"),
    ("ParamEyeLOpen", "Left Eye Open", 0, 1, 1, "Eye"),
    ("ParamEyeROpen", "Right Eye Open", 0, 1, 1, "Eye"),
    ("ParamEyeBallX", "Eye Ball X", -1, 1, 0, "Eye"),
    ("ParamEyeBallY", "Eye Ball Y", -1, 1, 0, "Eye"),
    ("ParamBrowLY", "Left Brow Y", -1, 1, 0, "Brow"),
    ("ParamBrowRY", "Right Brow Y", -1, 1, 0, "Brow"),
    ("ParamMouthOpenY", "Mouth Open", 0, 1, 0, "Mouth"),
    ("ParamMouthForm", "Mouth Form", -1, 1, 0, "Mouth"),
    ("ParamBreath", "Breath", 0, 1, 0, "Body"),
    ("ParamTail", "Tail", -1, 1, 0, "Tail"),
    ("ParamEarL", "Left Ear", -1, 1, 0, "Ear"),
    ("ParamEarR", "Right Ear", -1, 1, 0, "Ear"),
    ("ParamHairFront", "Front Hair", -1, 1, 0, "Hair"),
    ("ParamHairSideL", "Left Hair", -1, 1, 0, "Hair"),
    ("ParamHairSideR", "Right Hair", -1, 1, 0, "Hair"),
]

# Chinese display names for parameters
PARAMETER_DISPLAY_NAMES: dict[str, str] = {
    "ParamAngleX": "头部左右旋转",
    "ParamAngleY": "头部上下点头",
    "ParamAngleZ": "头部左右倾斜",
    "ParamBodyAngleX": "身体左右旋转",
    "ParamBodyAngleY": "身体前后倾斜",
    "ParamBodyAngleZ": "身体左右倾斜",
    "ParamEyeLOpen": "左眼开合",
    "ParamEyeROpen": "右眼开合",
    "ParamEyeBallX": "眼球左右移动",
    "ParamEyeBallY": "眼球上下移动",
    "ParamBrowLY": "左眉上下",
    "ParamBrowRY": "右眉上下",
    "ParamMouthOpenY": "嘴巴张合",
    "ParamMouthForm": "嘴巴形状",
    "ParamBreath": "呼吸",
    "ParamTail": "尾巴摇摆",
    "ParamEarL": "左耳动",
    "ParamEarR": "右耳动",
    "ParamHairFront": "前发摇摆",
    "ParamHairSideL": "左侧头发",
    "ParamHairSideR": "右侧头发",
}

# Chinese display names for common layer parts
PART_DISPLAY_NAMES: dict[str, str] = {
    "body": "身体",
    "face": "脸部",
    "hair_back": "后发",
    "hair_front": "前发",
    "eye_L": "左眼",
    "eye_R": "右眼",
    "eyebrow_L": "左眉",
    "eyebrow_R": "右眉",
    "mouth": "嘴巴",
    "ear_L": "左耳",
    "ear_R": "右耳",
    "tail": "尾巴",
    "accessory": "装饰",
}


@dataclass
class CMO3Writer:
    """Generate Cubism format files from model data.

    Outputs:
        .model3.json — SDK runtime configuration (always generated)
        .cmo3 — Cubism Editor project file (optional, simplified)

    The .model3.json is the primary format. It tells the SDK:
    - Where to find the .moc3 binary
    - Which textures to load
    - Physics and pose file paths
    - Parameter groups and hit areas
    """

    canvas_width: int = 3000
    canvas_height: int = 4000
    texture_size: int = 2048
    model_name: str = "AstralFoxModel"

    def write_model3_json(
        self,
        skeleton: BoneNode,
        output_path: str | Path,
        texture_names: list[str] | None = None,
        has_physics: bool = True,
        has_pose: bool = False,
        expressions: list[dict] | None = None,
        motions: dict[str, list[dict]] | None = None,
        layers: list[LayerResult] | None = None,
    ) -> Path:
        """Write a .model3.json runtime configuration file.

        This is the file that Cubism SDK loads at runtime.

        Args:
            skeleton: Root bone node (used for HitAreas inference).
            output_path: Where to write the file.
            texture_names: Texture filenames. Default: ["texture_00.png"]
            has_physics: Whether a .physics3.json exists.
            has_pose: Whether a .pose3.json exists.
            expressions: Expression definitions [{Name, File}].
            motions: Motion group definitions {group: [{File, FadeInTime, FadeOutTime}]}.
            layers: Optional layer list for DisplayInfo part names.
        """
        output_path = Path(output_path)

        if texture_names is None:
            texture_names = ["texture_00.png"]

        model3 = self._build_model3_json(
            skeleton, texture_names, has_physics, has_pose, expressions, motions
        )
        output_path.write_text(
            json.dumps(model3, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        # Also generate DisplayInfo file
        display_info_path = output_path.parent / "model.displayinfo3.json"
        self.write_display_info(display_info_path, layers)

        return output_path

    def write_display_info(
        self,
        output_path: str | Path,
        layers: list[LayerResult] | None = None,
    ) -> Path:
        """Write a .displayinfo3.json file with Chinese display names.

        This file provides localized names for parameters and parts,
        making it easier for Chinese-speaking users to understand the model.

        Args:
            output_path: Where to write the file.
            layers: Optional layer list for part names.
        """
        output_path = Path(output_path)

        # Parameters with Chinese names
        parameters = []
        for pid, name, min_val, max_val, default, group in ASTRALFOX_PARAMETERS:
            parameters.append({
                "Id": pid,
                "Name": PARAMETER_DISPLAY_NAMES.get(pid, name),
            })

        # Parts with Chinese names
        parts = []
        if layers:
            for layer in layers:
                label = layer.label.value if hasattr(layer.label, 'value') else layer.label
                parts.append({
                    "Id": f"Part_{label}",
                    "Name": PART_DISPLAY_NAMES.get(label, label),
                })

        display_info = {
            "Version": 1,
            "Parameters": parameters,
            "Parts": parts,
        }

        output_path.write_text(
            json.dumps(display_info, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return output_path

    def write_cmo3(
        self,
        skeleton: BoneNode,
        layers: list[LayerResult],
        output_path: str | Path,
        meshes: list[dict] | None = None,
        weights: list[dict] | None = None,
    ) -> Path:
        """Write a .cmo3 Cubism Editor project file.

        This is a simplified .cmo3 that contains enough structure
        for Cubism Editor to open and edit. It references the same
        textures and parameters as the .model3.json.

        Args:
            skeleton: Root bone node with hierarchy.
            layers: Separated layer results.
            output_path: Where to write the file.
            meshes: Optional mesh data per layer (vertices, uvs, indices).
            weights: Optional weight data per layer (bone_names, weights).
        """
        output_path = Path(output_path)

        cmo3 = self._build_cmo3(skeleton, layers, meshes, weights)
        output_path.write_text(
            json.dumps(cmo3, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return output_path

    # ── .model3.json builder ────────────────────────────────────────

    def _build_model3_json(
        self,
        skeleton: BoneNode,
        texture_names: list[str],
        has_physics: bool,
        has_pose: bool,
        expressions: list[dict] | None,
        motions: dict[str, list[dict]] | None,
    ) -> dict[str, Any]:
        """Build the complete .model3.json structure."""

        # FileReferences
        file_refs: dict[str, Any] = {
            "Moc": "model.moc3",
            "Textures": texture_names,
        }
        if has_physics:
            file_refs["Physics"] = "model.physics3.json"
        if has_pose:
            file_refs["Pose"] = "model.pose3.json"
        file_refs["DisplayInfo"] = "model.displayinfo3.json"
        if expressions:
            file_refs["Expressions"] = expressions
        if motions:
            file_refs["Motions"] = motions

        # Groups — semantic groupings for SDK features
        groups = [
            {
                "Target": "Parameter",
                "Name": "EyeBlink",
                "Ids": ["ParamEyeLOpen", "ParamEyeROpen"],
            },
            {
                "Target": "Parameter",
                "Name": "LipSync",
                "Ids": ["ParamMouthOpenY", "ParamMouthForm"],
            },
            {
                "Target": "Parameter",
                "Name": "AstralFox",
                "Ids": [p[0] for p in ASTRALFOX_PARAMETERS],
            },
        ]

        # HitAreas — clickable regions for interaction
        hit_areas = self._infer_hit_areas(skeleton)

        return {
            "Version": 3,
            "FileReferences": file_refs,
            "Groups": groups,
            "HitAreas": hit_areas,
        }

    def _infer_hit_areas(self, skeleton: BoneNode) -> list[dict[str, str]]:
        """Infer hit areas from the skeleton tree."""
        areas = []
        bone_names = self._collect_bone_names(skeleton)

        if "head" in bone_names:
            areas.append({"Id": "HitAreaHead", "Name": "Head"})
        if "body" in bone_names:
            areas.append({"Id": "HitAreaBody", "Name": "Body"})
        if "tail" in bone_names:
            areas.append({"Id": "HitAreaTail", "Name": "Tail"})

        return areas

    @staticmethod
    def _collect_bone_names(bone: BoneNode) -> set[str]:
        """Collect all bone names in the tree."""
        names = {bone.name.lower()}
        for child in bone.children:
            names |= CMO3Writer._collect_bone_names(child)
        return names

    # ── .cmo3 builder ───────────────────────────────────────────────

    def _build_cmo3(
        self,
        skeleton: BoneNode,
        layers: list[LayerResult],
        meshes: list[dict] | None,
        weights: list[dict] | None = None,
    ) -> dict[str, Any]:
        """Build a simplified .cmo3 project file structure.

        The .cmo3 format is Cubism Editor's native project format.
        This simplified version includes:
        - Version and metadata
        - File references (textures)
        - Parameter definitions with default keyforms
        - Part definitions (one per layer)
        - Deformer hierarchy (from skeleton)
        - Mesh data (if provided)
        - Weight data (if provided)
        """

        # Parameters with default keyform
        parameters = []
        for pid, name, min_val, max_val, default, group in ASTRALFOX_PARAMETERS:
            param = {
                "Id": pid,
                "Name": name,
                "Group": group,
                "Min": min_val,
                "Max": max_val,
                "Default": default,
                "KeyForms": [
                    {"Value": default, "Time": 0.0}
                ],
            }
            parameters.append(param)

        # Parts — one per layer
        parts = []
        for i, layer in enumerate(layers):
            x, y, w, h = layer.bbox
            parts.append({
                "Id": f"Part_{layer.label.value if hasattr(layer.label, 'value') else layer.label}",
                "Name": layer.label.value if hasattr(layer.label, 'value') else layer.label,
                "Index": i,
                "Visible": True,
                "Bounds": {
                    "Left": x / self.canvas_width,
                    "Top": y / self.canvas_height,
                    "Right": (x + w) / self.canvas_width,
                    "Bottom": (y + h) / self.canvas_height,
                },
            })

        # Deformer hierarchy from skeleton
        deformers = self._build_deformer_tree(skeleton)

        # Art meshes (if mesh data provided)
        art_meshes = []
        if meshes:
            for i, (layer, mesh) in enumerate(zip(layers, meshes)):
                art_mesh = {
                    "Id": f"Mesh_{layer.label.value if hasattr(layer.label, 'value') else layer.label}",
                    "Name": layer.label.value if hasattr(layer.label, 'value') else layer.label,
                    "PartId": f"Part_{layer.label.value if hasattr(layer.label, 'value') else layer.label}",
                    "TextureIndex": i,
                    "VertexCount": mesh.get("VertexCount", mesh.get("vertex_count", 0)),
                    "TriangleCount": mesh.get("TriangleCount", mesh.get("triangle_count", 0)),
                    "Vertices": mesh.get("Vertices", mesh.get("vertices", [])),
                    "Uvs": mesh.get("Uvs", mesh.get("uvs", [])),
                    "Indices": mesh.get("Indices", mesh.get("indices", [])),
                }
                # Attach weight data if available
                if weights and i < len(weights):
                    w = weights[i]
                    art_mesh["VertexWeights"] = {
                        "BoneNames": w.get("BoneNames", w.get("bone_names", [])),
                        "BoneCount": w.get("BoneCount", w.get("bone_count", 0)),
                        "Weights": w.get("Weights", w.get("weights", [])),
                    }
                art_meshes.append(art_mesh)

        return {
            "Version": 3,
            "Meta": {
                "Name": self.model_name,
                "SizeW": self.canvas_width,
                "SizeH": self.canvas_height,
                "TextureCount": len(layers),
            },
            "FileReferences": {
                "Textures": [f"textures/{l.label}.png" for l in layers],
            },
            "Parameters": parameters,
            "Parts": parts,
            "Deformers": deformers,
            "ArtMeshes": art_meshes,
        }

    def _build_deformer_tree(self, bone: BoneNode, depth: int = 0) -> list[dict[str, Any]]:
        """Recursively build deformer hierarchy from bone tree.

        Each bone becomes a Deformer with:
        - Type: "Rotation" (has children) or "Point" (leaf)
        - Origin: bone position
        - Children: nested deformers
        """
        children = []
        for child in bone.children:
            children.extend(self._build_deformer_tree(child, depth + 1))

        deformer = {
            "Id": f"Deformer_{bone.name}",
            "Name": bone.name,
            "Type": "Rotation" if bone.children else "Point",
            "Origin": {
                "X": bone.position[0],
                "Y": bone.position[1],
            },
            "Angle": 0.0,
            "Scale": {"X": 1.0, "Y": 1.0},
            "Children": children,
        }

        return [deformer]
