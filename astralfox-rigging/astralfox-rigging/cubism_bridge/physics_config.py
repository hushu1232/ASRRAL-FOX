"""Physics simulation configuration for Cubism models.

Generates .physics3.json files for hair, tail, ear dynamics.
Based on the Cubism SDK physics3.json specification.

The physics system uses a pendulum model:
- Input: a source parameter (e.g., ParamAngleX) drives the simulation
- Vertices: a chain of pendulum points with mobility/delay/acceleration
- Output: the computed position maps to a target parameter (e.g., ParamTail)
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class PhysicsVertex:
    """A single pendulum vertex in the physics chain."""
    position_x: float = 0.0     # initial X position (normalized)
    position_y: float = 0.0     # initial Y position (normalized)
    mobility: float = 1.0       # how quickly it responds (0-1)
    delay: float = 0.0          # time delay factor (0-1)
    acceleration: float = 1.0   # spring stiffness factor
    radius: float = 0.0         # max displacement radius


@dataclass
class PhysicsSetting:
    """A single physics simulation group (e.g., one hair strand).

    The pendulum chain works as follows:
    - Vertex 0 is the anchor point (root of the strand)
    - Vertex N is the tip (most affected by physics)
    - Each vertex has increasing delay and decreasing stiffness
    """
    id: str
    input_source_type: str = "Parameter"   # "Parameter" or "ParameterX"/"ParameterY"
    input_source_id: str = ""              # e.g., "ParamAngleX"
    input_weight: float = 1.0
    output_dest_type: str = "Parameter"
    output_dest_id: str = ""               # e.g., "ParamTail"
    output_weight: float = 1.0
    output_angle_scale: float = 1.0
    output_value_below_minimum: float = 0.0
    output_value_exceeded_maximum: float = 1.0
    vertices: list[PhysicsVertex] = field(default_factory=list)
    norm_position_min: float = 0.0
    norm_position_max: float = 1.0
    norm_position_default: float = 0.5
    norm_angle_min: float = -10.0
    norm_angle_max: float = 10.0
    norm_angle_default: float = 0.0


@dataclass
class PhysicsPreset:
    """Named physics preset with parameters for different body parts."""
    name: str
    hair_stiffness: float = 0.5
    hair_damping: float = 0.3
    hair_mass: float = 1.0
    hair_length: float = 1.2
    tail_stiffness: float = 0.3
    tail_damping: float = 0.5
    tail_mass: float = 1.5
    tail_length: float = 1.5
    ear_stiffness: float = 0.6
    ear_damping: float = 0.4
    ear_mass: float = 0.8
    ear_length: float = 0.5

    @classmethod
    def from_json(cls, path: str | Path) -> PhysicsPreset:
        """Load preset from a JSON file."""
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return cls(
            name=data.get("name", "custom"),
            hair_stiffness=data.get("hair", {}).get("stiffness", 0.5),
            hair_damping=data.get("hair", {}).get("damping", 0.3),
            hair_mass=data.get("hair", {}).get("mass", 1.0),
            hair_length=data.get("hair", {}).get("pendulum_length", 1.2),
            tail_stiffness=data.get("tail", {}).get("stiffness", 0.3),
            tail_damping=data.get("tail", {}).get("damping", 0.5),
            tail_mass=data.get("tail", {}).get("mass", 1.5),
            tail_length=data.get("tail", {}).get("pendulum_length", 1.5),
            ear_stiffness=data.get("ear", {}).get("stiffness", 0.6),
            ear_damping=data.get("ear", {}).get("damping", 0.4),
            ear_mass=data.get("ear", {}).get("mass", 0.8),
            ear_length=data.get("ear", {}).get("pendulum_length", 0.5),
        )


class PhysicsConfig:
    """Generate physics3.json for AstralFox model.

    Creates physics settings for dynamic body parts:
    - Hair (front strands): sways with head rotation
    - Tail: sways with body angle
    - Ears: twitches with head tilt
    """

    def __init__(
        self,
        preset: PhysicsPreset | None = None,
        gravity_x: float = 0.0,
        gravity_y: float = -1.0,
        wind_x: float = 0.0,
        wind_y: float = 0.0,
        fps: float = 60.0,
    ):
        self.preset = preset or PhysicsPreset(name="default")
        self.gravity_x = gravity_x
        self.gravity_y = gravity_y
        self.wind_x = wind_x
        self.wind_y = wind_y
        self.fps = fps

    @classmethod
    def default_astralfox(cls, preset_path: str | Path | None = None) -> PhysicsConfig:
        """Create default physics config for catgirl model."""
        if preset_path:
            preset = PhysicsPreset.from_json(preset_path)
        else:
            preset = PhysicsPreset(name="default")
        return cls(preset=preset)

    def build_settings(self) -> list[PhysicsSetting]:
        """Build all physics settings from the preset."""
        p = self.preset
        settings = []

        # Hair front — driven by head X rotation, 5-segment pendulum
        settings.append(PhysicsSetting(
            id="PhysicsHairFront",
            input_source_id="ParamAngleX",
            output_dest_id="ParamHairFront",
            output_angle_scale=1.0,
            vertices=self._make_pendulum_chain(
                segments=5,
                stiffness=p.hair_stiffness,
                damping=p.hair_damping,
                length=p.hair_length,
            ),
            norm_angle_min=-10.0,
            norm_angle_max=10.0,
        ))

        # Hair side L — driven by head X rotation
        settings.append(PhysicsSetting(
            id="PhysicsHairSideL",
            input_source_id="ParamAngleX",
            output_dest_id="ParamHairSideL",
            output_angle_scale=0.8,
            vertices=self._make_pendulum_chain(
                segments=4,
                stiffness=p.hair_stiffness * 0.9,
                damping=p.hair_damping,
                length=p.hair_length * 0.8,
            ),
            norm_angle_min=-10.0,
            norm_angle_max=10.0,
        ))

        # Hair side R — driven by head X rotation (mirrored)
        settings.append(PhysicsSetting(
            id="PhysicsHairSideR",
            input_source_id="ParamAngleX",
            output_dest_id="ParamHairSideR",
            output_angle_scale=-0.8,
            vertices=self._make_pendulum_chain(
                segments=4,
                stiffness=p.hair_stiffness * 0.9,
                damping=p.hair_damping,
                length=p.hair_length * 0.8,
            ),
            norm_angle_min=-10.0,
            norm_angle_max=10.0,
        ))

        # Tail — driven by body Z rotation, 6-segment pendulum
        settings.append(PhysicsSetting(
            id="PhysicsTail",
            input_source_id="ParamBodyAngleZ",
            output_dest_id="ParamTail",
            output_angle_scale=1.0,
            vertices=self._make_pendulum_chain(
                segments=6,
                stiffness=p.tail_stiffness,
                damping=p.tail_damping,
                length=p.tail_length,
            ),
            norm_angle_min=-15.0,
            norm_angle_max=15.0,
        ))

        # Ear L — driven by head X rotation, short pendulum
        settings.append(PhysicsSetting(
            id="PhysicsEarL",
            input_source_id="ParamAngleX",
            output_dest_id="ParamEarL",
            output_angle_scale=0.5,
            vertices=self._make_pendulum_chain(
                segments=2,
                stiffness=p.ear_stiffness,
                damping=p.ear_damping,
                length=p.ear_length,
            ),
            norm_angle_min=-5.0,
            norm_angle_max=5.0,
        ))

        # Ear R — driven by head X rotation (mirrored)
        settings.append(PhysicsSetting(
            id="PhysicsEarR",
            input_source_id="ParamAngleX",
            output_dest_id="ParamEarR",
            output_angle_scale=-0.5,
            vertices=self._make_pendulum_chain(
                segments=2,
                stiffness=p.ear_stiffness,
                damping=p.ear_damping,
                length=p.ear_length,
            ),
            norm_angle_min=-5.0,
            norm_angle_max=5.0,
        ))

        return settings

    def _make_pendulum_chain(
        self,
        segments: int,
        stiffness: float,
        damping: float,
        length: float,
    ) -> list[PhysicsVertex]:
        """Create a pendulum chain with gradual stiffness falloff.

        Segment 0 is the anchor (high stiffness, no delay).
        Segment N is the tip (low stiffness, high delay).
        """
        vertices = []
        for i in range(segments + 1):
            t = i / segments  # 0.0 → 1.0 along the chain
            vertices.append(PhysicsVertex(
                position_x=0.0,
                position_y=-t * length,
                mobility=1.0 - t * 0.3,           # tip moves slightly less
                delay=t * damping,                  # tip has more delay
                acceleration=stiffness * (1.0 - t * 0.5),  # tip is softer
                radius=length * (1.0 - t * 0.7),   # tip has smaller radius
            ))
        return vertices

    def write(self, output_path: str | Path) -> Path:
        """Write .physics3.json file."""
        output_path = Path(output_path)
        data = self._to_cubism_format()
        output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return output_path

    def _to_cubism_format(self) -> dict[str, Any]:
        """Convert to Cubism SDK physics3.json format.

        The format has:
        - Version: 3
        - Meta: physics metadata (counts, fps, environment forces)
        - PhysicsSettings: array of physics simulation groups
        """
        settings = self.build_settings()

        physics_settings = []
        total_vertices = 0
        total_inputs = 0
        total_outputs = 0

        for s in settings:
            total_vertices += len(s.vertices)

            # Input: array of input sources
            inputs = [{
                "Source": "Parameter",
                "SourceId": s.input_source_id,
                "Weight": int(s.input_weight * 100),
                "Type": "Angle",     # "X" | "Y" | "Angle"
                "Reflect": False,
            }]
            total_inputs += len(inputs)

            # Output: array of output destinations
            last_vertex_idx = len(s.vertices) - 1
            outputs = [{
                "Source": "Parameter",
                "SourceId": s.output_dest_id,
                "VertexIndex": last_vertex_idx,
                "Scale": s.output_angle_scale,
                "Weight": int(s.output_weight * 100),
                "Type": "Angle",
                "Reflect": False,
            }]
            total_outputs += len(outputs)

            physics_settings.append({
                "Id": s.id,
                "Input": inputs,
                "Output": outputs,
                "Vertices": [
                    {
                        "Position": {"X": v.position_x, "Y": v.position_y},
                        "Mobility": v.mobility,
                        "Delay": v.delay,
                        "Acceleration": v.acceleration,
                        "Radius": v.radius,
                    }
                    for v in s.vertices
                ],
                "Normalization": {
                    "Position": {
                        "Minimum": s.norm_position_min,
                        "Default": s.norm_position_default,
                        "Maximum": s.norm_position_max,
                    },
                    "Angle": {
                        "Minimum": s.norm_angle_min,
                        "Default": s.norm_angle_default,
                        "Maximum": s.norm_angle_max,
                    },
                },
            })

        return {
            "Version": 2,
            "Meta": {
                "PhysicsSettingCount": len(physics_settings),
                "TotalInputCount": total_inputs,
                "TotalOutputCount": total_outputs,
                "VertexCount": total_vertices,
                "EffectiveForces": {
                    "Gravity": {"X": self.gravity_x, "Y": self.gravity_y},
                    "Wind": {"X": self.wind_x, "Y": self.wind_y},
                },
            },
            "PhysicsSettings": physics_settings,
        }
