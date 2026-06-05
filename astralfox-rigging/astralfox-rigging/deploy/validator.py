"""Validate exported model files before deployment.

Checks:
- Required files exist (.moc3, .model3.json)
- .moc3 binary header valid (magic, version, size)
- .model3.json structure valid (FileReferences, Groups)
- textures/ directory has valid PNGs (power-of-2 square)
- .physics3.json structure valid (if present)
- .cmo3 structure valid (if present)
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from cubism_bridge.moc3_encoder import MOC3Validator


@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]
    warnings: list[str]

    def __str__(self) -> str:
        status = "PASS" if self.valid else "FAIL"
        lines = [f"[{status}]"]
        for e in self.errors:
            lines.append(f"  ERROR: {e}")
        for w in self.warnings:
            lines.append(f"  WARN:  {w}")
        return "\n".join(lines)


class ModelValidator:
    """Validate a complete model export before deploying to AstralFox."""

    def validate(self, model_dir: str | Path) -> ValidationResult:
        """Run all validation checks on a model directory.

        Expected structure:
            model_dir/
            ├── model.moc3
            ├── model.model3.json
            ├── model.cmo3
            ├── model.physics3.json (optional)
            └── textures/
                └── *.png
        """
        model_dir = Path(model_dir)
        errors: list[str] = []
        warnings: list[str] = []

        # 1. Check required files
        required = ["model.moc3", "model.model3.json"]
        for f in required:
            if not (model_dir / f).exists():
                errors.append(f"Missing required file: {f}")

        # 2. Validate .moc3
        moc3_path = model_dir / "model.moc3"
        if moc3_path.exists():
            self._validate_moc3(moc3_path, errors, warnings)

        # 3. Validate .model3.json
        model3_path = model_dir / "model.model3.json"
        if model3_path.exists():
            self._validate_model3_json(model3_path, errors, warnings)

        # 4. Validate textures
        tex_dir = model_dir / "textures"
        if not tex_dir.exists():
            errors.append("Missing textures/ directory")
        else:
            self._validate_textures(tex_dir, errors, warnings)

        # 5. Validate .physics3.json (optional)
        physics_path = model_dir / "model.physics3.json"
        if physics_path.exists():
            self._validate_physics(physics_path, errors, warnings)

        # 6. Validate .cmo3 (optional)
        cmo3_path = model_dir / "model.cmo3"
        if cmo3_path.exists():
            self._validate_cmo3(cmo3_path, errors, warnings)

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )

    def _validate_moc3(self, path: Path, errors: list, warnings: list) -> None:
        """Validate .moc3 binary file."""
        valid, msg = MOC3Validator.validate(path)
        if not valid:
            errors.append(f"Invalid .moc3: {msg}")

    def _validate_model3_json(self, path: Path, errors: list, warnings: list) -> None:
        """Validate .model3.json structure."""
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"model3.json invalid JSON: {e}")
            return

        # Check required top-level keys
        if "FileReferences" not in data:
            errors.append("model3.json missing FileReferences")
            return

        refs = data["FileReferences"]

        # Moc reference
        if "Moc" not in refs:
            errors.append("model3.json FileReferences missing Moc")

        # Textures
        textures = refs.get("Textures", [])
        if not textures:
            warnings.append("model3.json FileReferences.Textures is empty")
        elif not isinstance(textures, list):
            errors.append("model3.json FileReferences.Textures should be an array")

        # Groups (optional but recommended)
        if "Groups" not in data:
            warnings.append("model3.json missing Groups (EyeBlink/LipSync)")
        else:
            groups = data["Groups"]
            group_names = [g.get("Name", "") for g in groups] if isinstance(groups, list) else []
            if "EyeBlink" not in group_names:
                warnings.append("model3.json Groups missing EyeBlink")
            if "LipSync" not in group_names:
                warnings.append("model3.json Groups missing LipSync")

        # Version
        if "Version" not in data:
            warnings.append("model3.json missing Version field")

    def _validate_textures(self, tex_dir: Path, errors: list, warnings: list) -> None:
        """Validate texture files."""
        pngs = list(tex_dir.glob("*.png"))
        if not pngs:
            warnings.append("textures/ directory is empty")
            return

        from PIL import Image

        for png in pngs:
            try:
                img = Image.open(png)
                w, h = img.size
                # Check power-of-2
                if w != h:
                    warnings.append(f"{png.name}: {w}x{h} is not square")
                elif (w & (w - 1)) != 0:
                    warnings.append(f"{png.name}: size {w} is not power-of-2")
                # Check minimum size
                if w < 64 or h < 64:
                    warnings.append(f"{png.name}: size {w}x{h} is very small (<64px)")
                # Check has alpha
                if img.mode not in ("RGBA", "LA", "PA"):
                    warnings.append(f"{png.name}: no alpha channel (mode={img.mode})")
            except Exception as e:
                errors.append(f"{png.name}: cannot open — {e}")

    def _validate_physics(self, path: Path, errors: list, warnings: list) -> None:
        """Validate .physics3.json structure."""
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"physics3.json invalid JSON: {e}")
            return

        # Version check
        version = data.get("Version")
        if version is None:
            warnings.append("physics3.json missing Version")
        elif version != 2:
            warnings.append(f"physics3.json Version={version}, expected 2")

        # PhysicsSettings
        settings = data.get("PhysicsSettings", [])
        if not settings:
            warnings.append("physics3.json has no PhysicsSettings")
        elif not isinstance(settings, list):
            errors.append("physics3.json PhysicsSettings should be an array")
        else:
            for i, s in enumerate(settings):
                if "Input" not in s:
                    errors.append(f"PhysicsSettings[{i}] missing Input")
                if "Output" not in s:
                    errors.append(f"PhysicsSettings[{i}] missing Output")
                if "Vertices" not in s:
                    warnings.append(f"PhysicsSettings[{i}] missing Vertices")

    def _validate_cmo3(self, path: Path, errors: list, warnings: list) -> None:
        """Validate .cmo3 JSON structure."""
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"cmo3 invalid JSON: {e}")
            return

        # Check top-level structure
        if "Parameters" not in data:
            warnings.append("cmo3 missing Parameters")
        if "Parts" not in data:
            warnings.append("cmo3 missing Parts")
        if "Deformers" not in data:
            warnings.append("cmo3 missing Deformers")
        if "ArtMeshes" not in data:
            warnings.append("cmo3 missing ArtMeshes")
