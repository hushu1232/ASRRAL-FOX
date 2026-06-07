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
MOC3_VERSION = 6  # Cubism Core 6 (06.00.0001) compatible

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
    """Manages the string table for all IDs in the .moc3 file.

    Cubism Core 6 format: strings stored in 64-byte aligned slots
    with null termination and zero padding.
    """
    SLOT_SIZE = 64
    _strings: list[tuple[int, bytes]] = field(default_factory=list)  # (slot_start, data)
    _offsets: dict[str, int] = field(default_factory=dict)
    _current_slot: int = 0

    def add(self, s: str) -> tuple[int, int]:
        """Add a string and return (offset, length). Offset = slot start."""
        if s in self._offsets:
            return self._offsets[s], len(s.encode("utf-8"))

        encoded = s.encode("utf-8") + b"\x00"  # null-terminated
        # Calculate required slots (round up to 64-byte boundary)
        slots_needed = (len(encoded) + self.SLOT_SIZE - 1) // self.SLOT_SIZE
        if slots_needed == 0:
            slots_needed = 1

        slot_start = self._current_slot
        self._strings.append((slot_start, encoded))
        self._offsets[s] = slot_start
        self._current_slot += slots_needed * self.SLOT_SIZE
        return slot_start, len(encoded) - 1  # length excludes null

    def to_bytes(self) -> bytes:
        """Encode string table with 64-byte slot alignment."""
        total_size = self._current_slot
        buf = bytearray(total_size)
        for slot_start, data in self._strings:
            buf[slot_start:slot_start + len(data)] = data
        return bytes(buf)


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
        """Build the complete .moc3 binary in Cubism Core 6 format.

        V6 layout (reverse-engineered from SDK reference Ren.moc3):
            Header (64 bytes): magic(4) + version(4) + zeros(56)
            Offset Table: N x uint32 flat offsets (4 bytes each)
            Section Data: 12+ sections in fixed order
               [0] Parts
               [1] Canvas info (floats)
               [2] Padding (zeros)
               [3] Part IDs — 64-byte aligned string slots
               [4] Parameters
               [5-8] Config/index sections
               [9] Sentinel (0xFFFFFFFF)
               [10] Padding
               [11] Warp deformers
            String Table: 64-byte aligned, null-terminated strings
        """
        # ── String table (shared across sections) ──────────
        str_table = StringTable()
        all_sections: list[bytearray] = []

        # ── Build 12 sections matching v6 reference layout ──

        # [0] Parts: count(uint32) + N x (id_offset:uint16, padding:uint16) + padding
        # Part ID strings are stored in section [3] in 64-byte slots
        # id_offset is a byte offset into the Part ID table (section [3])
        p_count = len(parts)
        parts_buf = bytearray()
        parts_buf.extend(struct.pack("<I", p_count))
        for i in range(p_count):
            parts_buf.extend(struct.pack("<HH", i * 64, 0))  # 64-byte slot offset + padding
        all_sections.append(parts_buf)

        # [1] Canvas metadata: 8 floats (w, h, ox, oy, ppu, ?, ?, ?)
        canvas_buf = bytearray()
        canvas_buf.extend(struct.pack("<f", canvas_w))
        canvas_buf.extend(struct.pack("<f", canvas_h))
        canvas_buf.extend(struct.pack("<f", 0.0))  # origin X
        canvas_buf.extend(struct.pack("<f", 0.0))  # origin Y
        canvas_buf.extend(struct.pack("<f", 1.0))  # pixels per unit
        canvas_buf.extend(struct.pack("<f", canvas_w))  # repeat w
        canvas_buf.extend(struct.pack("<f", canvas_h))  # repeat h
        canvas_buf.extend(struct.pack("<f", 0.0))  # reserved
        all_sections.append(canvas_buf)

        # [2] Padding (>= 64 bytes of zeros)
        pad_buf = bytearray(128)
        all_sections.append(pad_buf)

        # [3] Part ID string table (64-byte slots, same as str_table format)
        partid_buf = bytearray()
        for p in parts:
            name = p.get("Id", "Part")
            encoded = name.encode("utf-8") + b"\x00"
            slot_start = len(partid_buf)
            slots = (len(encoded) + 63) // 64
            partid_buf.extend(encoded)
            partid_buf.extend(b"\x00" * (slots * 64 - len(encoded)))
        # Pad to at least 256 bytes
        while len(partid_buf) < 256:
            partid_buf.extend(b"\x00" * 64)
        all_sections.append(partid_buf)

        # [4] Parameters: count(N) + N x entry(24 bytes each: id_off, id_len, min, max, default, keycount, keyoffset)
        param_count = len(parameters)
        params_buf = bytearray()
        params_buf.extend(struct.pack("<I", param_count))
        for p in parameters:
            off, length = str_table.add(p.get("Id", "Param"))
            min_val = float(p.get("Min", 0))
            max_val = float(p.get("Max", 1))
            default = float(p.get("Default", 0))
            params_buf.extend(struct.pack("<IIfffII", off, length, min_val, max_val, default, 0, 0))
        # Pad to 256 bytes
        while len(params_buf) < 256:
            params_buf.extend(b"\x00")
        all_sections.append(params_buf)

        # [5] Index mapping: count(N) + N x uint32 (sequential indices)
        idx_buf = bytearray()
        idx_buf.extend(struct.pack("<I", max(p_count, param_count)))
        for i in range(max(p_count, param_count)):
            idx_buf.extend(struct.pack("<I", i))
        all_sections.append(idx_buf)

        # [6] Config A: count + N x uint32 (flat values)
        cfg_a = bytearray()
        cfg_a.extend(struct.pack("<I", 2))
        cfg_a.extend(struct.pack("<I", 1))
        cfg_a.extend(struct.pack("<I", 1))
        cfg_a.extend(b"\x00" * 64)  # pad
        all_sections.append(cfg_a)

        # [7] Config B: count + N x uint32
        cfg_b = bytearray()
        cfg_b.extend(struct.pack("<I", 1))
        cfg_b.extend(struct.pack("<I", 1))
        cfg_b.extend(b"\x00" * 64)
        all_sections.append(cfg_b)

        # [8] Config C: count + N x uint32
        cfg_c = bytearray()
        cfg_c.extend(struct.pack("<I", 1))
        cfg_c.extend(struct.pack("<I", 1))
        cfg_c.extend(b"\x00" * 64)
        all_sections.append(cfg_c)

        # [9] Sentinel: 0xFFFFFFFF
        sentinel_buf = bytearray()
        sentinel_buf.extend(struct.pack("<I", 0xFFFFFFFF))
        sentinel_buf.extend(b"\x00" * 64)
        all_sections.append(sentinel_buf)

        # [10] Padding (>= 64 bytes)
        pad2 = bytearray(256)
        all_sections.append(pad2)

        # [11] Warp deformers: "Warp" marker + zeros
        warp_buf = bytearray()
        warp_buf.extend(b"Warp")
        warp_buf.extend(b"\x00" * 4)
        warp_buf.extend(b"\x00" * 192)
        all_sections.append(warp_buf)

        # ── Now add ArtMesh data after section [11] ─────────
        # Drawables: SoA layout as additional sections
        d_count = len(drawables)
        if d_count > 0:
            # Drawable count section
            dm_count_buf = bytearray()
            dm_count_buf.extend(struct.pack("<I", d_count))
            all_sections.append(dm_count_buf)

            # Drawable IDs
            for d in drawables:
                dm_id = bytearray()
                off, length = str_table.add(d.get("Id", "ArtMesh"))
                dm_id.extend(struct.pack("<II", off, length))
                all_sections.append(dm_id)

            # ConstantFlags (all 0)
            dm_flags = bytearray()
            for d in drawables:
                dm_flags.extend(struct.pack("<I", 0))
            all_sections.append(dm_flags)

            # Texture indices
            for d in drawables:
                dm_tex = bytearray()
                dm_tex.extend(struct.pack("<I", d.get("TextureIndex", 0)))
                all_sections.append(dm_tex)

            # Draw orders
            for d in drawables:
                dm_order = bytearray()
                dm_order.extend(struct.pack("<I", d.get("DrawOrder", 0)))
                all_sections.append(dm_order)

            # Opacities
            for d in drawables:
                dm_op = bytearray()
                dm_op.extend(struct.pack("<f", float(d.get("Opacity", 1.0))))
                all_sections.append(dm_op)

            # DrawOrder indices
            for d in drawables:
                dm_doi = bytearray()
                dm_doi.extend(struct.pack("<I", 0))
                all_sections.append(dm_doi)

            # Vertex counts + collect data
            all_positions = []
            all_uvs = []
            for d in drawables:
                vc = bytearray()
                vc.extend(struct.pack("<I", d.get("VertexCount", 0)))
                all_sections.append(vc)
                for v in d.get("Vertices", []):
                    all_positions.extend([float(v[0]), float(v[1])])
                for uv in d.get("Uvs", []):
                    all_uvs.extend([float(uv[0]), float(uv[1])])

            # All positions (SoA)
            if all_positions:
                pos_buf = bytearray()
                for v in all_positions:
                    pos_buf.extend(struct.pack("<f", v))
                all_sections.append(pos_buf)

            # All UVs (SoA)
            if all_uvs:
                uv_buf = bytearray()
                for uv in all_uvs:
                    uv_buf.extend(struct.pack("<f", uv))
                all_sections.append(uv_buf)

            # Triangle counts + indices
            all_indices = []
            for d in drawables:
                tc = bytearray()
                tc.extend(struct.pack("<I", d.get("TriangleCount", 0)))
                all_sections.append(tc)
                for idx in d.get("Indices", []):
                    all_indices.append(int(idx))

            if all_indices:
                idx_buf2 = bytearray()
                for idx in all_indices:
                    idx_buf2.extend(struct.pack("<I", idx))
                all_sections.append(idx_buf2)

            # DynamicFlags
            for d in drawables:
                df = bytearray()
                df.extend(struct.pack("<I", 0x01))
                all_sections.append(df)

        # ── Write v6 header (64 bytes, magic+version+zeros) ──
        header_buf = bytearray(64)
        struct.pack_into("<4sI", header_buf, 0, MOC3_MAGIC, MOC3_VERSION)
        buf = bytearray()
        buf.extend(header_buf)

        # ── Offset table (flat uint32 array) ───────────────
        section_count = len(all_sections)
        ot_start = len(buf)
        buf.extend(b"\x00" * (section_count * 4))

        # ── Section data ────────────────────────────────────
        section_offsets = []
        for data in all_sections:
            section_offsets.append(len(buf))
            buf.extend(data)

        # ── Global string table ─────────────────────────────
        str_bytes = str_table.to_bytes()
        buf.extend(str_bytes)

        # ── Patch offset table ──────────────────────────────
        for i, off in enumerate(section_offsets):
            struct.pack_into("<I", buf, ot_start + i * 4, off)

        # ── File size ───────────────────────────────────────
        struct.pack_into("<I", buf, 16, len(buf))

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
