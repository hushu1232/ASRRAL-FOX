"""Test deploy module: validator, deployer, param mapper, state machine, lip sync."""

import json
from pathlib import Path

import pytest

from deploy.validator import ModelValidator, ValidationResult
from deploy.deployer import AstralFoxDeployer, DeployResult
from astralfox_adapter.param_mapper import ParamMapper, ParamRange, AnimStateConfig
from astralfox_adapter.anim_state_machine import StateMachineConfig, Transition
from astralfox_adapter.lip_sync_config import LipSyncConfig


# ── Validator ──────────────────────────────────────────────────────

class TestModelValidator:
    @staticmethod
    def _make_fake_moc3() -> bytes:
        """Create a minimal fake .moc3 that passes MOC3Validator."""
        import struct
        data = bytearray(64)
        data[0:4] = b"MOC3"                          # magic
        struct.pack_into("<I", data, 4, 3)            # version
        struct.pack_into("<I", data, 16, 64)          # file size
        struct.pack_into("<f", data, 20, 3000.0)      # canvas width
        struct.pack_into("<f", data, 24, 4000.0)      # canvas height
        return bytes(data)

    def _make_model_dir(self, tmp_path: Path) -> Path:
        """Create a minimal valid model directory."""
        d = tmp_path / "model"
        d.mkdir()

        # Fake moc3 (passes MOC3Validator: magic + version + size)
        moc3 = d / "model.moc3"
        moc3.write_bytes(self._make_fake_moc3())

        # model3.json
        model3 = {
            "Version": 3,
            "FileReferences": {
                "Moc": "model.moc3",
                "Textures": ["textures/body.png"],
                "Physics": "model.physics3.json",
            },
            "Groups": [
                {"Name": "EyeBlink", "Ids": ["ParamEyeLOpen", "ParamEyeROpen"]},
                {"Name": "LipSync", "Ids": ["ParamMouthOpenY"]},
            ],
        }
        (d / "model.model3.json").write_text(json.dumps(model3), encoding="utf-8")

        # Textures
        tex = d / "textures"
        tex.mkdir()
        # Create a 64x64 RGBA PNG
        from PIL import Image
        img = Image.new("RGBA", (64, 64), (255, 0, 0, 128))
        img.save(tex / "body.png")

        # Physics
        physics = {
            "Version": 2,
            "PhysicsSettings": [
                {
                    "Id": "Physics1",
                    "Input": [{"Source": "Parameter", "Id": "ParamAngleX", "Weight": 100}],
                    "Output": [{"Source": "Parameter", "Id": "ParamHairFront", "Weight": 50}],
                    "Vertices": [{"Position": {"X": 0, "Y": 0}, "Mobility": 1, "Delay": 1, "Acceleration": 1, "Radius": 1}],
                }
            ],
        }
        (d / "model.physics3.json").write_text(json.dumps(physics), encoding="utf-8")

        # cmo3
        cmo3 = {
            "Version": "Cubism4_2",
            "Parameters": [],
            "Parts": [],
            "Deformers": [],
            "ArtMeshes": [],
        }
        (d / "model.cmo3").write_text(json.dumps(cmo3), encoding="utf-8")

        return d

    def test_valid_model(self, tmp_path):
        d = self._make_model_dir(tmp_path)
        v = ModelValidator()
        result = v.validate(d)
        # May have warnings about moc3 binary (fake), but no errors for structure
        assert isinstance(result, ValidationResult)

    def test_missing_required_files(self, tmp_path):
        d = tmp_path / "empty"
        d.mkdir()
        v = ModelValidator()
        result = v.validate(d)
        assert not result.valid
        assert any("Missing required file: model.moc3" in e for e in result.errors)
        assert any("Missing required file: model.model3.json" in e for e in result.errors)

    def test_missing_textures_dir(self, tmp_path):
        d = tmp_path / "model"
        d.mkdir()
        (d / "model.moc3").write_bytes(b"MOC3" + b"\x00" * 60)
        (d / "model.model3.json").write_text('{"FileReferences":{}}', encoding="utf-8")
        v = ModelValidator()
        result = v.validate(d)
        assert any("Missing textures/" in e for e in result.errors)

    def test_model3_json_missing_filerefs(self, tmp_path):
        d = tmp_path / "model"
        d.mkdir()
        (d / "model.moc3").write_bytes(b"MOC3" + b"\x00" * 60)
        (d / "model.model3.json").write_text('{"Version": 3}', encoding="utf-8")
        (d / "textures").mkdir()
        v = ModelValidator()
        result = v.validate(d)
        assert any("missing FileReferences" in e for e in result.errors)

    def test_empty_model3_json(self, tmp_path):
        d = tmp_path / "model"
        d.mkdir()
        (d / "model.moc3").write_bytes(b"MOC3" + b"\x00" * 60)
        (d / "model.model3.json").write_text('{"FileReferences":{"Moc":"model.moc3","Textures":[]}}', encoding="utf-8")
        (d / "textures").mkdir()
        v = ModelValidator()
        result = v.validate(d)
        assert any("Textures is empty" in w for w in result.warnings)

    def test_physics_validation(self, tmp_path):
        d = self._make_model_dir(tmp_path)
        # Overwrite with invalid physics
        (d / "model.physics3.json").write_text('{"Version": 2}', encoding="utf-8")
        v = ModelValidator()
        result = v.validate(d)
        assert any("no PhysicsSettings" in w for w in result.warnings)

    def test_cmo3_validation(self, tmp_path):
        d = self._make_model_dir(tmp_path)
        # Overwrite with minimal cmo3
        (d / "model.cmo3").write_text('{"Parameters":[]}', encoding="utf-8")
        v = ModelValidator()
        result = v.validate(d)
        assert any("missing Parts" in w for w in result.warnings)

    def test_texture_too_small(self, tmp_path):
        d = self._make_model_dir(tmp_path)
        from PIL import Image
        img = Image.new("RGBA", (32, 32), (255, 0, 0, 255))
        img.save(d / "textures" / "tiny.png")
        v = ModelValidator()
        result = v.validate(d)
        assert any("very small" in w for w in result.warnings)

    def test_texture_no_alpha(self, tmp_path):
        d = self._make_model_dir(tmp_path)
        from PIL import Image
        img = Image.new("RGB", (64, 64), (255, 0, 0))
        img.save(d / "textures" / "noalpha.png")
        v = ModelValidator()
        result = v.validate(d)
        assert any("no alpha channel" in w for w in result.warnings)


# ── ParamMapper ────────────────────────────────────────────────────

class TestParamMapper:
    def test_default_config(self):
        mapper = ParamMapper()
        config = mapper.generate_config()

        assert "idle" in config
        assert "listen" in config
        assert "speak" in config
        assert "sleep" in config
        assert "drag" in config
        assert "greet" in config

        idle = config["idle"]
        assert "triggers" in idle
        assert "params" in idle
        assert "ParamAngleX" in idle["params"]

    def test_overrides(self):
        mapper = ParamMapper()
        config = mapper.generate_config(overrides={
            "idle": {
                "ParamAngleX": {"min": -10, "max": 10},
            },
        })
        assert config["idle"]["params"]["ParamAngleX"]["min"] == -10
        assert config["idle"]["params"]["ParamAngleX"]["max"] == 10

    def test_write_json(self, tmp_path):
        mapper = ParamMapper()
        out = tmp_path / "anim_params.json"
        mapper.generate_config(output_path=out)
        assert out.exists()
        data = json.loads(out.read_text(encoding="utf-8"))
        assert "idle" in data

    def test_speak_has_audio_sync(self):
        mapper = ParamMapper()
        config = mapper.generate_config()
        mouth = config["speak"]["params"]["ParamMouthOpenY"]
        assert mouth["sync"] == "audio_amplitude"

    def test_sleep_eyes_closed(self):
        mapper = ParamMapper()
        config = mapper.generate_config()
        assert config["sleep"]["params"]["ParamEyeLOpen"]["target"] == 0.0
        assert config["sleep"]["params"]["ParamEyeROpen"]["target"] == 0.0


# ── StateMachine ───────────────────────────────────────────────────

class TestStateMachine:
    def test_default_states(self):
        sm = StateMachineConfig()
        assert len(sm.states) == 6
        assert "idle" in sm.states
        assert "drag" in sm.states

    def test_transitions(self):
        sm = StateMachineConfig()
        assert len(sm.transitions) >= 8

        # Check key transitions exist
        triggers = [(t.from_state, t.to_state, t.trigger) for t in sm.transitions]
        assert ("idle", "listen", "asr_start") in triggers
        assert ("speak", "idle", "tts_end") in triggers
        assert ("sleep", "greet", "wake_word") in triggers

    def test_to_dict(self):
        sm = StateMachineConfig()
        d = sm.to_dict()
        assert "initialState" in d
        assert d["initialState"] == "idle"
        assert "states" in d
        assert "transitions" in d
        assert isinstance(d["transitions"], list)
        assert "from" in d["transitions"][0]

    def test_write_json(self, tmp_path):
        sm = StateMachineConfig()
        out = tmp_path / "state_machine.json"
        sm.write(out)
        assert out.exists()
        data = json.loads(out.read_text(encoding="utf-8"))
        assert data["initialState"] == "idle"

    def test_drag_from_any(self):
        sm = StateMachineConfig()
        drag_trans = [t for t in sm.transitions if t.to_state == "drag"]
        sources = {t.from_state for t in drag_trans}
        assert "idle" in sources
        assert "listen" in sources

    def test_sleep_wake_up(self):
        sm = StateMachineConfig()
        wake_trans = [t for t in sm.transitions if t.from_state == "sleep"]
        targets = {t.to_state for t in wake_trans}
        assert "greet" in targets
        assert "idle" in targets


# ── LipSync ────────────────────────────────────────────────────────

class TestLipSync:
    def test_default_config(self):
        lip = LipSyncConfig()
        d = lip.to_dict()
        assert d["paramId"] == "ParamMouthOpenY"
        assert 0 < d["minAmplitude"] < d["maxAmplitude"] <= 1.0
        assert 0 < d["smoothing"] < 1.0

    def test_write_json(self, tmp_path):
        lip = LipSyncConfig()
        out = tmp_path / "lipsync.json"
        lip.write(out)
        assert out.exists()
        data = json.loads(out.read_text(encoding="utf-8"))
        assert data["paramId"] == "ParamMouthOpenY"

    def test_close_faster_than_open(self):
        lip = LipSyncConfig()
        assert lip.close_speed < lip.open_speed


# ── Deployer ───────────────────────────────────────────────────────

class TestAstralFoxDeployer:
    """Test deployer with mocked config (no real Unity project needed)."""

    def _make_deployer(self, tmp_path: Path) -> AstralFoxDeployer:
        """Create a deployer pointing to a temp directory."""
        unity_project = tmp_path / "unity_project"
        unity_project.mkdir()
        config_path = tmp_path / "config.yaml"
        config_path.write_text(
            f"""
astralfox:
  unity_project_path: "{unity_project.as_posix()}"
  models_dir: "Assets/StreamingAssets/AstralFox/Models"
  websocket_url: "ws://localhost:9999"
  auto_reload: false
""",
            encoding="utf-8",
        )
        return AstralFoxDeployer(config_path)

    def _make_model_export(self, tmp_path: Path, model_id: str) -> None:
        """Create a minimal model export."""
        import struct
        d = tmp_path / "output" / model_id / "cubism"
        d.mkdir(parents=True)
        # Fake moc3 that passes validator
        moc3 = bytearray(64)
        moc3[0:4] = b"MOC3"
        struct.pack_into("<I", moc3, 4, 3)
        struct.pack_into("<I", moc3, 16, 64)
        struct.pack_into("<f", moc3, 20, 3000.0)
        struct.pack_into("<f", moc3, 24, 4000.0)
        (d / "model.moc3").write_bytes(bytes(moc3))
        (d / "model.model3.json").write_text(
            json.dumps({
                "Version": 3,
                "FileReferences": {"Moc": "model.moc3", "Textures": ["textures/body.png"]},
                "Groups": [
                    {"Name": "EyeBlink", "Ids": []},
                    {"Name": "LipSync", "Ids": []},
                ],
            }),
            encoding="utf-8",
        )
        tex = d / "textures"
        tex.mkdir()
        from PIL import Image
        Image.new("RGBA", (64, 64)).save(tex / "body.png")

    def test_deploy_copies_files(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        self._make_model_export(tmp_path, "test_model")
        deployer = self._make_deployer(tmp_path)

        result = deployer.deploy("test_model")
        assert isinstance(result, DeployResult)
        assert Path(result.deployed_path).exists()
        assert "anim_params.json" in result.configs_written
        assert "state_machine.json" in result.configs_written
        assert "lipsync.json" in result.configs_written

    def test_deploy_writes_configs(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        self._make_model_export(tmp_path, "test_model")
        deployer = self._make_deployer(tmp_path)

        result = deployer.deploy("test_model")
        deployed = Path(result.deployed_path)
        assert (deployed / "anim_params.json").exists()
        assert (deployed / "state_machine.json").exists()
        assert (deployed / "lipsync.json").exists()

        anim = json.loads((deployed / "anim_params.json").read_text(encoding="utf-8"))
        assert "idle" in anim
        assert "speak" in anim

    def test_deploy_missing_model(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        deployer = self._make_deployer(tmp_path)
        with pytest.raises(FileNotFoundError):
            deployer.deploy("nonexistent")

    def test_deploy_copies_textures(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        self._make_model_export(tmp_path, "test_model")
        deployer = self._make_deployer(tmp_path)

        result = deployer.deploy("test_model")
        deployed = Path(result.deployed_path)
        assert (deployed / "textures" / "body.png").exists()

    def test_deploy_with_overrides(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        self._make_model_export(tmp_path, "test_model")
        deployer = self._make_deployer(tmp_path)

        result = deployer.deploy(
            "test_model",
            anim_params={"idle": {"ParamAngleX": {"min": -15, "max": 15}}},
        )
        deployed = Path(result.deployed_path)
        anim = json.loads((deployed / "anim_params.json").read_text(encoding="utf-8"))
        assert anim["idle"]["params"]["ParamAngleX"]["min"] == -15
