"""Cubism .moc3 binary encoder.

.moc3 is Live2D's binary format for runtime model data.
This encoder generates .moc3 files loadable by Cubism SDK.

Binary layout (v3):
    Header (64 bytes): magic + version + layout info + counts
    Section Table: array of 16-byte entries (offset, length, id)
    String Table: length-prefixed UTF-8 strings for all IDs
    Section Data: Parts, Parameters, Drawables (Structure-of-Arrays)

The .moc3 format uses **Structure of Arrays** (SoA) layout:
all values of one field are stored contiguously across all drawables,
then all values of the next field, etc.

Reference: CubismNativeFramework (CubismModelMoc.cpp, CubismMoc.cpp)
"""

from __future__ import annotations

import json
import struct
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from api.schemas import BoneNode


# ── Constants ──────────────────────────────────────────────────────

MOC3_MAGIC = b"MOC3"
MOC3_VERSION = 3

# Section IDs
SECTION_PARTS = 0x00
SECTION_DEFORMERS = 0x01
SECTION_ART_MESHES = 0x02
SECTION_PARAMETERS = 0x03
SECTION_PART_COLORS = 0x04
SECTION_MASKS = 0x05
SECTION_SHAPES = 0x06
SECTION_LAYOUTS = 0x07
SECTION_PART_OPACITIES = 0x08
SECTION_USER_DATA = 0x09
SECTION_PART_IDS = 0x0A

SECTION_IDS = [
    SECTION_PARTS,
    SECTION_DEFORMERS,
    SECTION_ART_MESHES,
    SECTION_PARAMETERS,
    SECTION_PART_COLORS,
    SECTION_MASKS,
    SECTION_SHAPES,
    SECTION_LAYOUTS,
    SECTION_PART_OPACITIES,
    SECTION_USER_DATA,
    SECTION_PART_IDS,
]


@dataclass
class StringTable:
    """Manages the string table for all IDs in the .moc3 file."""
    _strings: list[bytes] = field(default_factory=list)
    _offsets: dict[str, int] = field(default_factory=dict)
    _current_offset: int = 0

    def add(self, s: str) -> tuple[int, int]:
        """Add a string and return (offset, length)."""
        if s in self._offsets:
            idx = self._offsets[s]
            return idx, len(s.encode("utf-8"))

        encoded = s.encode("utf-8")
        offset = self._current_offset
        self._strings.append(encoded)
        self._offsets[s] = offset
        self._current_offset += len(encoded)
        return offset, len(encoded)

    def to_bytes(self) -> bytes:
        return b"".join(self._strings)


class MOC3Encoder:
    """Encode model data into .moc3 binary format."""

    def encode(
        self,
        cmo3_path: str | Path,
        output_path: str | Path,
    ) -> Path:
        """Encode a .cmo3 project to .moc3 binary.

        Args:
            cmo3_path: Path to the .cmo3 JSON project file.
            output_path: Where to write the .moc3 binary.

        Returns:
            Path to the written .moc3 file.
        """
        import json

        cmo3_path = Path(cmo3_path)
        output_path = Path(output_path)

        with open(cmo3_path, encoding="utf-8") as f:
            cmo3 = json.load(f)

        binary = self._encode_cmo3(cmo3)
        output_path.write_bytes(binary)

        return output_path

    def encode_from_data(
        self,
        output_path: str | Path,
        canvas_width: float = 3000.0,
        canvas_height: float = 4000.0,
        parameters: list[dict] | None = None,
        parts: list[dict] | None = None,
        drawables: list[dict] | None = None,
    ) -> Path:
        """Encode directly from structured data (no .cmo3 dependency).

        Args:
            output_path: Where to write the .moc3 binary.
            canvas_width/height: Canvas dimensions.
            parameters: List of parameter dicts with Id, Min, Max, Default, KeyValues.
            parts: List of part dicts with Id.
            drawables: List of drawable dicts with Id, Vertices, Uvs, Indices, TextureIndex, etc.

        Returns:
            Path to the written .moc3 file.
        """
        output_path = Path(output_path)
        binary = self._encode_data(canvas_width, canvas_height, parameters or [], parts or [], drawables or [])
        output_path.write_bytes(binary)
        return output_path

    def _encode_cmo3(self, cmo3: dict[str, Any]) -> bytes:
        """Encode .cmo3 dict into .moc3 binary."""
        params = cmo3.get("Parameters", [])
        parts = cmo3.get("Parts", [])
        meta = cmo3.get("Meta", {})
        canvas_w = meta.get("SizeW", 3000)
        canvas_h = meta.get("SizeH", 4000)

        # Extract drawables from ArtMeshes
        art_meshes = cmo3.get("ArtMeshes", [])
        drawables = []
        for mesh in art_meshes:
            drawables.append({
                "Id": mesh.get("Id", mesh.get("Name", "")),
                "VertexCount": mesh.get("VertexCount", mesh.get("vertex_count", 0)),
                "TriangleCount": mesh.get("TriangleCount", mesh.get("triangle_count", 0)),
                "TextureIndex": mesh.get("TextureIndex", 0),
                "DrawOrder": 0,
                "Opacity": 1.0,
                "Vertices": mesh.get("Vertices", mesh.get("vertices", [])),
                "Uvs": mesh.get("Uvs", mesh.get("uvs", [])),
                "Indices": mesh.get("Indices", mesh.get("indices", [])),
            })

        return self._encode_data(canvas_w, canvas_h, params, parts, drawables)

    def _encode_data(
        self,
        canvas_w: float,
        canvas_h: float,
        parameters: list[dict],
        parts: list[dict],
        drawables: list[dict],
    ) -> bytes:
        """Build the complete .moc3 binary.

        Layout follows Cubism SDK's Structure-of-Arrays (SoA) format:
        - Section data stores all values of one field contiguously
        - Then all values of the next field, etc.
        """
        buf = bytearray()
        str_table = StringTable()

        # ── Reserve space for header (64 bytes) ─────────────────────
        header_buf = bytearray(64)

        # ── Build section data ──────────────────────────────────────
        section_data: dict[int, bytearray] = {}

        # Parts section (SoA)
        parts_buf = bytearray()
        parts_buf.extend(struct.pack("<I", len(parts)))
        for p in parts:
            name = p.get("Id", "")
            off, length = str_table.add(name)
            parts_buf.extend(struct.pack("<II", off, length))
        section_data[SECTION_PARTS] = parts_buf

        # Parameters section (SoA)
        params_buf = bytearray()
        params_buf.extend(struct.pack("<I", len(parameters)))
        for p in parameters:
            name = p.get("Id", "")
            off, length = str_table.add(name)
            min_val = float(p.get("Min", 0))
            max_val = float(p.get("Max", 1))
            default = float(p.get("Default", 0))
            key_values = p.get("KeyValues", [default])
            kv_offset = 0  # simplified: inline key values
            params_buf.extend(struct.pack("<IIfffII", off, length, min_val, max_val, default, len(key_values), kv_offset))
        section_data[SECTION_PARAMETERS] = params_buf

        # Deformers section (from cmo3 data if available)
        deformers_buf = bytearray()
        deformers_buf.extend(struct.pack("<I", 0))  # placeholder: no deformers in basic encoding
        section_data[SECTION_DEFORMERS] = deformers_buf

        # ── ArtMeshes / Drawables section (SoA layout) ──────────────
        # The Cubism SDK reads drawable data in SoA order:
        # 1. Count
        # 2. For each drawable: ID (string table ref)
        # 3. For each drawable: ConstantFlags
        # 4. For each drawable: TextureIndex
        # 5. For each drawable: DrawOrder (initial)
        # 6. For each drawable: Opacity (initial)
        # 7. For each drawable: DrawOrderIndex
        # 8. For each drawable: PartIndex
        # 9. For each drawable: IsInvertedMask
        # 10. For each drawable: MaskCount
        # 11. For each drawable: MaskIndices (offset)
        # 12. For each drawable: VertexCount
        # 13. For ALL drawables' vertices: positions (x,y pairs)
        # 14. For ALL drawables' vertices: uvs (u,v pairs)
        # 15. For each drawable: TriangleIndexCount
        # 16. For ALL drawables' indices: triangle indices
        # 17. For each drawable: DynamicFlags

        d_count = len(drawables)
        meshes_buf = bytearray()
        meshes_buf.extend(struct.pack("<I", d_count))

        # Collect all vertex/index data across all drawables
        all_positions = []
        all_uvs = []
        all_indices = []

        # Per-drawable metadata (SoA fields 2-12)
        for d in drawables:
            name = d.get("Id", "")
            off, length = str_table.add(name)
            meshes_buf.extend(struct.pack("<II", off, length))

        for d in drawables:
            meshes_buf.extend(struct.pack("<I", 0))  # ConstantFlags

        for d in drawables:
            tex_idx = d.get("TextureIndex", 0)
            meshes_buf.extend(struct.pack("<I", tex_idx))

        for d in drawables:
            draw_order = d.get("DrawOrder", 0)
            meshes_buf.extend(struct.pack("<I", draw_order))

        for d in drawables:
            opacity = float(d.get("Opacity", 1.0))
            meshes_buf.extend(struct.pack("<f", opacity))

        for d in drawables:
            meshes_buf.extend(struct.pack("<I", 0))  # DrawOrderIndex

        for d in drawables:
            meshes_buf.extend(struct.pack("<I", 0))  # PartIndex

        for d in drawables:
            meshes_buf.extend(struct.pack("<I", 0))  # IsInvertedMask

        for d in drawables:
            meshes_buf.extend(struct.pack("<I", 0))  # MaskCount

        for d in drawables:
            meshes_buf.extend(struct.pack("<I", 0))  # MaskIndices offset

        for d in drawables:
            vert_count = d.get("VertexCount", 0)
            meshes_buf.extend(struct.pack("<I", vert_count))
            # Collect positions and UVs
            verts = d.get("Vertices", [])
            uvs = d.get("Uvs", [])
            for v in verts:
                all_positions.extend([float(v[0]), float(v[1])])
            for uv in uvs:
                all_uvs.extend([float(uv[0]), float(uv[1])])

        # Vertex positions for ALL drawables (SoA: all positions, then all UVs)
        for val in all_positions:
            meshes_buf.extend(struct.pack("<f", val))

        # Vertex UVs for ALL drawables
        for val in all_uvs:
            meshes_buf.extend(struct.pack("<f", val))

        # Triangle indices per drawable
        for d in drawables:
            tri_count = d.get("TriangleCount", 0)
            meshes_buf.extend(struct.pack("<I", tri_count))
            indices = d.get("Indices", [])
            for idx in indices:
                all_indices.append(int(idx))

        # All triangle indices
        for idx in all_indices:
            meshes_buf.extend(struct.pack("<I", idx))

        # DynamicFlags per drawable
        for d in drawables:
            meshes_buf.extend(struct.pack("<I", 0x01))  # visible

        section_data[SECTION_ART_MESHES] = meshes_buf

        # Empty sections
        for sid in [SECTION_PART_COLORS, SECTION_MASKS, SECTION_SHAPES,
                     SECTION_LAYOUTS, SECTION_PART_OPACITIES, SECTION_USER_DATA,
                     SECTION_PART_IDS]:
            empty = bytearray()
            empty.extend(struct.pack("<I", 0))
            section_data[sid] = empty

        # ── Write header ────────────────────────────────────────────
        struct.pack_into("<4sI", header_buf, 0, MOC3_MAGIC, MOC3_VERSION)
        struct.pack_into("<I", header_buf, 8, 0)  # endianness (little)
        struct.pack_into("<I", header_buf, 12, 0)  # consistency flags
        # FileSize at offset 16 — will patch later
        struct.pack_into("<f", header_buf, 20, canvas_w)
        struct.pack_into("<f", header_buf, 24, canvas_h)
        struct.pack_into("<f", header_buf, 28, 0.0)  # canvas origin X
        struct.pack_into("<f", header_buf, 32, 0.0)  # canvas origin Y
        struct.pack_into("<f", header_buf, 36, 1.0)  # pixels per unit
        struct.pack_into("<I", header_buf, 40, len(parts))
        struct.pack_into("<I", header_buf, 44, len(parameters))
        struct.pack_into("<I", header_buf, 48, d_count)
        struct.pack_into("<I", header_buf, 52, d_count)  # ArtMeshCount
        struct.pack_into("<I", header_buf, 56, 1)  # TextureCount
        struct.pack_into("<I", header_buf, 60, 0)  # reserved

        buf.extend(header_buf)

        # ── Write section table ─────────────────────────────────────
        section_table_start = len(buf)  # should be 64
        section_table_size = len(SECTION_IDS) * 16
        buf.extend(b"\x00" * section_table_size)

        # ── Write string table ──────────────────────────────────────
        string_table_offset = len(buf)
        str_bytes = str_table.to_bytes()
        buf.extend(str_bytes)

        # ── Write section data ──────────────────────────────────────
        section_offsets: dict[int, int] = {}
        for sid in SECTION_IDS:
            section_offsets[sid] = len(buf)
            data = section_data.get(sid, struct.pack("<I", 0))
            buf.extend(data)

        # ── Patch section table ─────────────────────────────────────
        for i, sid in enumerate(SECTION_IDS):
            entry_offset = section_table_start + i * 16
            data_offset = section_offsets[sid]
            data_length = len(section_data.get(sid, b""))
            struct.pack_into("<IIII", buf, entry_offset,
                             data_offset, data_length, sid, 0)

        # ── Patch file size in header ───────────────────────────────
        total_size = len(buf)
        struct.pack_into("<I", buf, 16, total_size)

        return bytes(buf)


class MOC3Validator:
    """Validate a .moc3 file's basic structure."""

    @staticmethod
    def validate(path: str | Path) -> tuple[bool, str]:
        """Check if a file is a valid .moc3.

        Returns:
            (is_valid, message)
        """
        path = Path(path)
        if not path.exists():
            return False, f"File not found: {path}"

        data = path.read_bytes()
        if len(data) < 64:
            return False, f"File too small ({len(data)} bytes), minimum 64"

        # Check magic
        if data[:4] != MOC3_MAGIC:
            return False, f"Invalid magic: {data[:4]!r}, expected {MOC3_MAGIC!r}"

        # Check version
        version = struct.unpack_from("<I", data, 4)[0]
        if version != MOC3_VERSION:
            return False, f"Version mismatch: {version}, expected {MOC3_VERSION}"

        # Check file size
        file_size = struct.unpack_from("<I", data, 16)[0]
        if file_size != len(data):
            return False, f"Size mismatch: header says {file_size}, actual {len(data)}"

        # Check canvas dimensions are reasonable
        canvas_w = struct.unpack_from("<f", data, 20)[0]
        canvas_h = struct.unpack_from("<f", data, 24)[0]
        if canvas_w <= 0 or canvas_h <= 0:
            return False, f"Invalid canvas size: {canvas_w}x{canvas_h}"

        # Check counts
        part_count = struct.unpack_from("<I", data, 40)[0]
        param_count = struct.unpack_from("<I", data, 44)[0]
        drawable_count = struct.unpack_from("<I", data, 48)[0]

        if part_count > 10000 or param_count > 10000 or drawable_count > 10000:
            return False, f"Suspiciously large counts: {part_count} parts, {param_count} params, {drawable_count} drawables"

        return True, f"Valid .moc3 v{version}: {part_count} parts, {param_count} params, {drawable_count} drawables"


@dataclass
class MOC3Data:
    """Parsed data from a .moc3 file."""
    version: int
    canvas_width: float
    canvas_height: float
    part_count: int
    parameter_count: int
    drawable_count: int
    parameters: list[dict] = field(default_factory=list)
    parts: list[str] = field(default_factory=list)
    drawables: list[dict] = field(default_factory=list)


class MOC3Reader:
    """Read and parse .moc3 binary files for validation."""

    @staticmethod
    def read(path: str | Path) -> MOC3Data:
        """Read a .moc3 file and return parsed data."""
        path = Path(path)
        data = path.read_bytes()

        if len(data) < 64:
            raise ValueError(f"File too small: {len(data)} bytes")

        if data[:4] != MOC3_MAGIC:
            raise ValueError(f"Invalid magic: {data[:4]!r}")

        version = struct.unpack_from("<I", data, 4)[0]
        canvas_w = struct.unpack_from("<f", data, 20)[0]
        canvas_h = struct.unpack_from("<f", data, 24)[0]
        part_count = struct.unpack_from("<I", data, 40)[0]
        param_count = struct.unpack_from("<I", data, 44)[0]
        drawable_count = struct.unpack_from("<I", data, 48)[0]

        # Parse section table (starts at offset 64, 16 bytes per entry)
        sections = {}
        for i in range(len(SECTION_IDS)):
            entry_offset = 64 + i * 16
            if entry_offset + 16 <= len(data):
                offset, length, sid, _ = struct.unpack_from("<IIII", data, entry_offset)
                sections[sid] = (offset, length)

        # Read parameters from header (we already have counts)
        # For detailed parameter data, we'd need to parse the section
        # For now, return header-level info
        result = MOC3Data(
            version=version,
            canvas_width=canvas_w,
            canvas_height=canvas_h,
            part_count=part_count,
            parameter_count=param_count,
            drawable_count=drawable_count,
        )

        return result

    @staticmethod
    def compare_with_json(moc3_path: str | Path, cmo3_path: str | Path) -> tuple[bool, list[str]]:
        """Compare moc3 binary with cmo3 JSON for consistency.

        Returns:
            (is_consistent, list_of_differences)
        """
        moc3_data = MOC3Reader.read(moc3_path)

        with open(cmo3_path, encoding="utf-8") as f:
            cmo3 = json.load(f)

        differences = []

        # Compare canvas dimensions
        json_w = cmo3.get("Meta", {}).get("SizeW", 3000)
        json_h = cmo3.get("Meta", {}).get("SizeH", 4000)
        if abs(moc3_data.canvas_width - json_w) > 0.01:
            differences.append(f"Canvas width: moc3={moc3_data.canvas_width}, json={json_w}")
        if abs(moc3_data.canvas_height - json_h) > 0.01:
            differences.append(f"Canvas height: moc3={moc3_data.canvas_height}, json={json_h}")

        # Compare parameter count
        json_params = cmo3.get("Parameters", [])
        if moc3_data.parameter_count != len(json_params):
            differences.append(f"Parameter count: moc3={moc3_data.parameter_count}, json={len(json_params)}")

        # Compare parts count
        json_parts = cmo3.get("Parts", [])
        if moc3_data.part_count != len(json_parts):
            differences.append(f"Part count: moc3={moc3_data.part_count}, json={len(json_parts)}")

        # Compare drawable/artmesh count
        json_meshes = cmo3.get("ArtMeshes", [])
        if moc3_data.drawable_count != len(json_meshes):
            differences.append(f"Drawable count: moc3={moc3_data.drawable_count}, json={len(json_meshes)}")

        return len(differences) == 0, differences
