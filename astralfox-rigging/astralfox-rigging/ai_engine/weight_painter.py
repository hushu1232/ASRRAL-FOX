"""Automatic weight painting: assign vertex weights to bones.

Uses distance-based heat diffusion from bone positions.
Supports parent-child bone relationships for smooth blending.

The algorithm:
    1. Flatten skeleton to get bone positions
    2. Compute distance from each vertex to each bone
    3. Apply falloff function (inverse distance weighting)
    4. Normalize weights per vertex
    5. Prune near-zero weights for efficiency
    6. Optionally limit influence per bone (max influences)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
from scipy.spatial.distance import cdist

from api.schemas import BoneNode


@dataclass
class WeightResult:
    """Result of weight painting."""
    bone_names: list[str]       # (M,) bone names
    weights: np.ndarray         # (N, M) weight matrix, rows sum to 1
    vertex_count: int
    bone_count: int

    def to_cubism_format(self) -> dict:
        """Convert to Cubism SDK vertex weight format."""
        # Cubism stores weights as sparse: per-vertex list of (bone_index, weight)
        sparse = []
        for i in range(self.vertex_count):
            row = self.weights[i]
            nonzero = np.nonzero(row)[0]
            entries = [{"BoneIndex": int(j), "Weight": float(row[j])} for j in nonzero]
            sparse.append(entries)

        return {
            "VertexCount": self.vertex_count,
            "BoneCount": self.bone_count,
            "BoneNames": self.bone_names,
            "Weights": sparse,
        }

    def get_dominant_bone(self, vertex_idx: int) -> tuple[str, float]:
        """Get the bone with highest weight for a vertex."""
        row = self.weights[vertex_idx]
        idx = np.argmax(row)
        return self.bone_names[idx], float(row[idx])


class WeightPainter:
    """Assign bone weights to mesh vertices using distance-based weighting.

    Args:
        falloff: Distance falloff exponent (higher = sharper influence).
            2.0 = inverse distance squared (good default).
        threshold: Minimum weight to keep (prune near-zero weights).
        max_influences: Maximum bones per vertex (0 = unlimited).
            4 is a common limit for real-time rendering.
        blend_parent: Whether to blend parent bone influence into children.
    """

    def __init__(
        self,
        falloff: float = 2.0,
        threshold: float = 0.01,
        max_influences: int = 0,
        blend_parent: bool = True,
    ):
        self.falloff = falloff
        self.threshold = threshold
        self.max_influences = max_influences
        self.blend_parent = blend_parent

    def paint(
        self,
        vertices: np.ndarray,
        skeleton: BoneNode,
    ) -> WeightResult:
        """Compute bone weights for each vertex.

        Args:
            vertices: (N, 2) array of vertex positions [x, y].
            skeleton: Root bone node.

        Returns:
            WeightResult with bone names and weight matrix.
        """
        # Flatten skeleton
        bones = self._flatten_bones(skeleton)
        bone_names = [name for name, _ in bones]
        bone_positions = np.array([pos for _, pos in bones])  # (M, 2)

        if len(bone_positions) == 0:
            return WeightResult(
                bone_names=[],
                weights=np.zeros((len(vertices), 0)),
                vertex_count=len(vertices),
                bone_count=0,
            )

        # Compute distance matrix
        dists = cdist(vertices, bone_positions)  # (N, M)

        # Apply falloff
        raw_weights = 1.0 / (np.power(dists, self.falloff) + 1e-8)

        # Optional: blend parent influence
        if self.blend_parent:
            parent_map = self._build_parent_map(skeleton)
            raw_weights = self._blend_parent_weights(raw_weights, bone_names, parent_map)

        # Normalize per vertex
        row_sums = raw_weights.sum(axis=1, keepdims=True)
        weights = raw_weights / row_sums

        # Prune near-zero weights
        weights[weights < self.threshold] = 0

        # Re-normalize after pruning
        row_sums = weights.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1  # avoid division by zero
        weights = weights / row_sums

        # Limit influences per vertex
        if self.max_influences > 0:
            weights = self._limit_influences(weights, self.max_influences)

        return WeightResult(
            bone_names=bone_names,
            weights=weights,
            vertex_count=len(vertices),
            bone_count=len(bone_names),
        )

    def paint_for_layer(
        self,
        vertices: np.ndarray,
        skeleton: BoneNode,
        layer_label: str,
    ) -> WeightResult:
        """Paint weights with bias toward the bone matching the layer label.

        Vertices are more strongly influenced by the bone that shares
        their layer's name (e.g., eye_L vertices → eye_L bone).
        """
        bones = self._flatten_bones(skeleton)
        bone_names = [name for name, _ in bones]
        bone_positions = np.array([pos for _, pos in bones])

        if len(bone_positions) == 0:
            return WeightResult(
                bone_names=[],
                weights=np.zeros((len(vertices), 0)),
                vertex_count=len(vertices),
                bone_count=0,
            )

        dists = cdist(vertices, bone_positions)

        # Boost the matching bone's influence
        raw_weights = 1.0 / (np.power(dists, self.falloff) + 1e-8)

        # Find the bone matching this layer
        matching_idx = None
        for i, name in enumerate(bone_names):
            # Match by leaf name (last component of path)
            leaf = name.split("/")[-1]
            if leaf == layer_label:
                matching_idx = i
                break

        if matching_idx is not None:
            # Boost matching bone by 3x
            raw_weights[:, matching_idx] *= 3.0

        # Normalize
        row_sums = raw_weights.sum(axis=1, keepdims=True)
        weights = raw_weights / row_sums

        # Prune and re-normalize
        weights[weights < self.threshold] = 0
        row_sums = weights.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1
        weights = weights / row_sums

        if self.max_influences > 0:
            weights = self._limit_influences(weights, self.max_influences)

        return WeightResult(
            bone_names=bone_names,
            weights=weights,
            vertex_count=len(vertices),
            bone_count=len(bone_names),
        )

    # ── Internal helpers ────────────────────────────────────────────

    @staticmethod
    def _flatten_bones(bone: BoneNode, prefix: str = "") -> list[tuple[str, list[float]]]:
        """Flatten bone tree into (full_path, position) list."""
        full_name = f"{prefix}/{bone.name}" if prefix else bone.name
        result = [(full_name, bone.position)]
        for child in bone.children:
            result.extend(WeightPainter._flatten_bones(child, full_name))
        return result

    @staticmethod
    def _build_parent_map(skeleton: BoneNode) -> dict[str, str]:
        """Build child_name → parent_name mapping."""
        parent_map: dict[str, str] = {}

        def walk(bone: BoneNode, parent: str = ""):
            if parent:
                parent_map[bone.name] = parent
            for child in bone.children:
                walk(child, bone.name)

        walk(skeleton)
        return parent_map

    def _blend_parent_weights(
        self,
        weights: np.ndarray,
        bone_names: list[str],
        parent_map: dict[str, str],
    ) -> np.ndarray:
        """Blend a portion of parent bone weight into child bones.

        This creates smoother transitions at joints.
        """
        result = weights.copy()
        name_to_idx = {name: i for i, name in enumerate(bone_names)}

        for child_name, parent_name in parent_map.items():
            if child_name in name_to_idx and parent_name in name_to_idx:
                child_idx = name_to_idx[child_name]
                parent_idx = name_to_idx[parent_name]
                # Blend 20% of parent influence into child
                blend = result[:, parent_idx] * 0.2
                result[:, child_idx] += blend

        return result

    @staticmethod
    def _limit_influences(weights: np.ndarray, max_inf: int) -> np.ndarray:
        """Keep only the top N influences per vertex."""
        result = np.zeros_like(weights)
        for i in range(weights.shape[0]):
            row = weights[i]
            if np.count_nonzero(row) <= max_inf:
                result[i] = row
            else:
                top_indices = np.argsort(row)[-max_inf:]
                result[i, top_indices] = row[top_indices]

        # Re-normalize
        row_sums = result.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1
        result = result / row_sums

        return result
