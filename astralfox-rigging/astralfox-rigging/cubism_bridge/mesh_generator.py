"""Delaunay triangulation mesh generator for Live2D art meshes.

Generates triangle meshes from layer masks with configurable density.
Output is compatible with Cubism SDK's ArtMesh vertex format.

Pipeline:
    1. Sample interior points on a density grid
    2. Extract and densify contour boundary points
    3. Delaunay triangulation of all points
    4. Prune triangles whose centroid falls outside the mask
    5. Compute UV coordinates (normalized 0-1)
    6. Optionally add border padding for anti-aliasing
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np
from scipy.spatial import Delaunay


@dataclass
class MeshData:
    """Complete mesh data for a single art mesh layer."""
    vertices: np.ndarray     # (N, 2) float32, pixel coordinates
    triangles: np.ndarray    # (M, 3) int32, vertex indices
    uvs: np.ndarray          # (N, 2) float32, UV coords [0, 1]
    vertex_count: int
    triangle_count: int

    def to_cubism_format(self) -> dict:
        """Convert to Cubism SDK ArtMesh vertex format."""
        return {
            "VertexCount": self.vertex_count,
            "TriangleCount": self.triangle_count,
            "Vertices": self.vertices.tolist(),
            "Uvs": self.uvs.tolist(),
            "Indices": self.triangles.flatten().tolist(),
        }


class MeshGenerator:
    """Generate triangle meshes for Live2D art meshes.

    Args:
        density: Mesh density level.
            "low"    → ~100 vertices  (fast, coarse)
            "medium" → ~300 vertices  (balanced)
            "high"   → ~800 vertices  (slow, detailed)
        border_padding: Extra border vertices around the mask edge
            for smoother alpha blending at edges.
    """

    DENSITY_SPACING = {
        "low": 40,
        "medium": 20,
        "high": 10,
    }

    def __init__(self, density: str = "medium", border_padding: int = 2):
        if density not in self.DENSITY_SPACING:
            raise ValueError(f"Unknown density: {density}. Use {list(self.DENSITY_SPACING)}")
        self.spacing = self.DENSITY_SPACING[density]
        self.border_padding = border_padding

    def generate(
        self,
        mask: np.ndarray,
        texture: Optional[np.ndarray] = None,
    ) -> MeshData:
        """Generate a mesh from a layer mask.

        Args:
            mask: uint8 alpha mask (H, W). Values > 128 are interior.
            texture: RGBA texture (H, W, 4). Used for size reference only.

        Returns:
            MeshData with vertices, triangles, and UVs.
        """
        h, w = mask.shape[:2]

        # Step 1: Sample interior points
        interior_pts = self._sample_interior(mask)

        # Step 2: Extract and densify contour
        contour_pts = self._extract_contour_dense(mask)

        # Step 3: Add corner/edge padding points
        padding_pts = self._generate_padding_points(mask)

        # Step 4: Combine all points, remove duplicates
        all_pts = self._merge_points(interior_pts, contour_pts, padding_pts)

        if len(all_pts) < 3:
            # Fallback: simple quad covering the mask bbox
            all_pts = self._fallback_quad(mask)

        # Step 5: Delaunay triangulation
        try:
            tri = Delaunay(all_pts)
            triangles = tri.simplices
        except Exception:
            # Degenerate points — fallback to quad
            all_pts = self._fallback_quad(mask)
            tri = Delaunay(all_pts)
            triangles = tri.simplices

        # Step 6: Prune triangles outside mask
        triangles = self._prune_outside(mask, all_pts, triangles)

        # If pruning killed everything, keep all triangles
        if len(triangles) == 0:
            triangles = tri.simplices

        # Step 7: Compute UVs
        uvs = self._compute_uvs(all_pts, w, h)

        return MeshData(
            vertices=all_pts.astype(np.float32),
            triangles=triangles.astype(np.int32),
            uvs=uvs.astype(np.float32),
            vertex_count=len(all_pts),
            triangle_count=len(triangles),
        )

    # ── Point sampling ──────────────────────────────────────────────

    def _sample_interior(self, mask: np.ndarray) -> np.ndarray:
        """Sample grid points that fall inside the mask."""
        h, w = mask.shape[:2]
        spacing = self.spacing

        ys = np.arange(spacing // 2, h, spacing)
        xs = np.arange(spacing // 2, w, spacing)
        grid_x, grid_y = np.meshgrid(xs, ys)
        gx = grid_x.ravel().astype(int)
        gy = grid_y.ravel().astype(int)

        # Filter: keep only points inside mask
        inside = mask[gy, gx] > 128
        if not np.any(inside):
            return np.empty((0, 2), dtype=np.float32)
        return np.column_stack([gx[inside].astype(np.float32),
                                gy[inside].astype(np.float32)])

    def _extract_contour_dense(self, mask: np.ndarray) -> np.ndarray:
        """Extract contour points with adaptive densification.

        Short edges get more points per unit length to ensure
        smooth curves. Long straight edges get fewer points.
        """
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not contours:
            return np.empty((0, 2), dtype=np.float32)

        # Take the largest contour by area
        contour = max(contours, key=cv2.contourArea)
        contour = contour.squeeze(1)  # (N, 2)

        if len(contour) < 3:
            return np.empty((0, 2), dtype=np.float32)

        # Adaptive sampling: sample every N points based on contour length
        # Target: ~200 contour points for medium density
        target_points = max(50, len(contour) // (self.spacing // 2))
        step = max(1, len(contour) // target_points)

        sampled = contour[::step].astype(np.float32)

        # Always include the first and last point
        if len(sampled) > 0:
            sampled = np.vstack([sampled, contour[0:1].astype(np.float32)])

        return sampled

    def _generate_padding_points(self, mask: np.ndarray) -> np.ndarray:
        """Generate border padding points outside the mask edge.

        These points help create smoother alpha transitions
        at mesh edges.
        """
        if self.border_padding <= 0:
            return np.empty((0, 2), dtype=np.float32)

        h, w = mask.shape[:2]

        # Dilate the mask to find the border region
        kernel = np.ones((3, 3), np.uint8)
        dilated = cv2.dilate(mask, kernel, iterations=self.border_padding)

        # Border = dilated - mask
        border = ((dilated > 128) & (mask <= 128))

        if not np.any(border):
            return np.empty((0, 2), dtype=np.float32)

        # Sample border points at half the normal spacing
        spacing = max(5, self.spacing // 2)
        ys = np.arange(0, h, spacing)
        xs = np.arange(0, w, spacing)
        grid_x, grid_y = np.meshgrid(xs, ys)
        gx = grid_x.ravel().astype(int)
        gy = grid_y.ravel().astype(int)

        on_border = border[gy, gx]
        if not np.any(on_border):
            return np.empty((0, 2), dtype=np.float32)

        return np.column_stack([gx[on_border].astype(np.float32),
                                gy[on_border].astype(np.float32)])

    # ── Point merging ───────────────────────────────────────────────

    def _merge_points(self, *arrays: np.ndarray) -> np.ndarray:
        """Merge point arrays and remove near-duplicates."""
        valid = [a for a in arrays if len(a) > 0]
        if not valid:
            return np.empty((0, 2), dtype=np.float32)

        merged = np.vstack(valid)

        # Remove duplicates (round to 1 decimal to handle float noise)
        merged = np.unique(np.round(merged, 1), axis=0)

        return merged.astype(np.float32)

    # ── Triangulation ───────────────────────────────────────────────

    def _prune_outside(
        self,
        mask: np.ndarray,
        vertices: np.ndarray,
        triangles: np.ndarray,
    ) -> np.ndarray:
        """Remove triangles whose centroid is outside the mask."""
        h, w = mask.shape[:2]

        # Compute centroids vectorized
        v0 = vertices[triangles[:, 0]]
        v1 = vertices[triangles[:, 1]]
        v2 = vertices[triangles[:, 2]]
        cx = (v0[:, 0] + v1[:, 0] + v2[:, 0]) / 3.0
        cy = (v0[:, 1] + v1[:, 1] + v2[:, 1]) / 3.0

        # Clip to image bounds
        ix = np.clip(cx.astype(int), 0, w - 1)
        iy = np.clip(cy.astype(int), 0, h - 1)

        # Check mask at centroid
        inside = mask[iy, ix] > 128

        return triangles[inside]

    # ── UV computation ──────────────────────────────────────────────

    def _compute_uvs(self, vertices: np.ndarray, w: int, h: int) -> np.ndarray:
        """Compute UV coordinates normalized to [0, 1]."""
        uvs = vertices.copy()
        uvs[:, 0] = uvs[:, 0] / w
        uvs[:, 1] = uvs[:, 1] / h
        # Clamp to [0, 1] (border padding points may be outside)
        uvs = np.clip(uvs, 0.0, 1.0)
        return uvs

    # ── Fallback ────────────────────────────────────────────────────

    @staticmethod
    def _fallback_quad(mask: np.ndarray) -> np.ndarray:
        """Generate a simple quad covering the mask's bounding box."""
        coords = cv2.findNonZero(mask)
        if coords is None:
            return np.array([[0, 0], [100, 0], [100, 100], [0, 100]], dtype=np.float32)
        x, y, w, h = cv2.boundingRect(coords)
        return np.array([
            [x, y], [x + w, y], [x + w, y + h], [x, y + h],
        ], dtype=np.float32)
