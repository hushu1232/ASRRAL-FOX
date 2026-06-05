"""Test API schemas."""

import pytest
from api.schemas import (
    BoneNode, SeparateRequest, LayerLabel,
    RigRequest, ExportRequest, DeployRequest,
    PipelineRequest, MeshDensity, AnimState,
)


def test_bone_node():
    root = BoneNode(
        name="root",
        position=[1500, 2000],
        children=[
            BoneNode(name="head", position=[1500, 1200]),
        ],
    )
    assert root.name == "root"
    assert len(root.children) == 1
    assert root.children[0].position == [1500, 1200]


def test_separate_request():
    req = SeparateRequest(image_id="abc123")
    assert req.image_id == "abc123"
    assert len(req.target_layers) == len(LayerLabel)
    assert req.edge_refine is True


def test_separate_request_custom_layers():
    req = SeparateRequest(
        image_id="abc",
        target_layers=[LayerLabel.BODY, LayerLabel.FACE],
    )
    assert len(req.target_layers) == 2


def test_rig_request():
    req = RigRequest(image_id="abc", layers=[])
    assert req.template == "catgirl"
    assert req.mesh_density == MeshDensity.MEDIUM


def test_export_request():
    root = BoneNode(name="root", position=[0, 0])
    req = ExportRequest(image_id="abc", skeleton=root, layers=[])
    assert req.canvas_width == 3000
    assert req.generate_moc3 is True


def test_deploy_request():
    req = DeployRequest(model_id="abc")
    assert req.model_id == "abc"
    assert req.anim_params == {}  # has default empty dict


def test_pipeline_request():
    req = PipelineRequest(image_id="abc")
    assert req.template == "catgirl"
    assert req.auto_deploy is False


def test_anim_states():
    assert AnimState.IDLE.value == "idle"
    assert AnimState.SPEAK.value == "speak"
    assert len(AnimState) == 6
