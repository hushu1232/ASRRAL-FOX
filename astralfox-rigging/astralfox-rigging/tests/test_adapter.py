"""Test AstralFox adapter modules."""

import json
from pathlib import Path

import pytest

from astralfox_adapter.param_mapper import ParamMapper
from astralfox_adapter.anim_state_machine import StateMachineConfig
from astralfox_adapter.lip_sync_config import LipSyncConfig


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

        # Check idle has tail params
        idle_params = config["idle"]["params"]
        assert "ParamTail" in idle_params

    def test_overrides(self):
        mapper = ParamMapper()
        config = mapper.generate_config(overrides={
            "idle": {"ParamTail": {"speed": 0.8}},
        })
        assert config["idle"]["params"]["ParamTail"]["speed"] == 0.8

    def test_write(self, tmp_path):
        mapper = ParamMapper()
        out = tmp_path / "params.json"
        mapper.generate_config(output_path=out)

        assert out.exists()
        data = json.loads(out.read_text())
        assert "idle" in data


class TestStateMachine:
    def test_default_transitions(self):
        sm = StateMachineConfig()
        assert len(sm.transitions) > 0
        assert sm.initial_state == "idle"

    def test_to_dict(self):
        sm = StateMachineConfig()
        d = sm.to_dict()
        assert "states" in d
        assert "transitions" in d
        assert len(d["states"]) == 6

    def test_write(self, tmp_path):
        sm = StateMachineConfig()
        out = tmp_path / "state_machine.json"
        sm.write(out)

        data = json.loads(out.read_text())
        assert data["initialState"] == "idle"


class TestLipSync:
    def test_defaults(self):
        cfg = LipSyncConfig()
        assert cfg.param_id == "ParamMouthOpenY"
        assert cfg.smoothing == 0.3

    def test_write(self, tmp_path):
        cfg = LipSyncConfig()
        out = tmp_path / "lipsync.json"
        cfg.write(out)

        data = json.loads(out.read_text())
        assert data["paramId"] == "ParamMouthOpenY"
