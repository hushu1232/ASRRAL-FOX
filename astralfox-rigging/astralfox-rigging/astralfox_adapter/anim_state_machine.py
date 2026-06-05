"""Animation state machine configuration for AstralFox Unity client.

Generates the state machine config that maps trigger events
to animation state transitions.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class Transition:
    from_state: str
    to_state: str
    trigger: str
    conditions: dict[str, Any] = field(default_factory=dict)


@dataclass
class StateMachineConfig:
    """AstralFox animation state machine.

    States:
        idle → listen (on asr_start)
        idle → sleep (on idle_timeout)
        idle → greet (on wake_word)
        listen → speak (on tts_start)
        listen → idle (on asr_end)
        speak → idle (on tts_end)
        sleep → greet (on wake_word)
        any → drag (on mouse_drag)
        drag → idle (on mouse_release)
    """

    states: list[str] = field(default_factory=lambda: [
        "idle", "listen", "speak", "sleep", "drag", "greet",
    ])

    transitions: list[Transition] = field(default_factory=lambda: [
        Transition("idle", "listen", "asr_start"),
        Transition("idle", "sleep", "idle_timeout", {"idle_seconds": 300}),
        Transition("idle", "greet", "wake_word"),
        Transition("idle", "greet", "app_launch"),
        Transition("listen", "speak", "tts_start"),
        Transition("listen", "idle", "asr_end"),
        Transition("speak", "idle", "tts_end"),
        Transition("sleep", "greet", "wake_word"),
        Transition("sleep", "idle", "mouse_click"),
        Transition("idle", "drag", "mouse_drag"),
        Transition("listen", "drag", "mouse_drag"),
        Transition("drag", "idle", "mouse_release"),
    ])

    initial_state: str = "idle"

    def to_dict(self) -> dict[str, Any]:
        return {
            "initialState": self.initial_state,
            "states": self.states,
            "transitions": [
                {
                    "from": t.from_state,
                    "to": t.to_state,
                    "trigger": t.trigger,
                    "conditions": t.conditions,
                }
                for t in self.transitions
            ],
        }

    def write(self, path: str | Path) -> Path:
        path = Path(path)
        path.write_text(json.dumps(self.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
        return path
