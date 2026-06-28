# ADR-004: Animation Model Abstraction (Live2D / DragonBones / VRM)

- **Status**: Accepted
- **Date**: 2026-05-26

## Context

The desktop pet supports three animation systems: Live2D (2D skeletal), DragonBones (2D bone-based), and VRM (3D avatar format). Each has different asset pipelines, runtime requirements, and export formats.

We needed a way to configure which system a pet uses without coupling the web platform to animation runtime details.

## Decision

**The web platform treats the animation system as a configuration choice** (`animationModel` enum on `PetConfig`). It does not process animation assets — it stores references and exports configuration.

- Database: `PetConfig.animationModel` is a Prisma enum (`live2d | dragonbones | vrm`)
- Asset mapping: The `PetAssetMapping` table links assets to named slots (e.g., `idle_animation`, `walk_animation`) independent of animation system
- Export: `exportConfig()` includes `animationModel` and `modelPath` — the Alife runtime is responsible for loading the correct renderer/runtime adapter

The Alife runtime reads the exported JSON and selects the appropriate renderer at runtime.

## Consequences

**Positive:**
- Adding a new animation system requires: DB enum value + Alife runtime adapter — no web code changes
- Asset mappings are animation-system-agnostic (just slot names to asset IDs)
- The web platform doesn't need Live2D/DragonBones/VRM SDKs

**Negative:**
- Asset type validation is weak — `assetType: 'model'` could be an `.moc3` file (Live2D) or `.vrm` file, and we don't validate file-format-to-animation-system compatibility server-side
- The Alife runtime must handle model format detection, which duplicates logic that could live in the platform
- Export-time avatar version parameters (blendshape snapshots) assume a VRM-compatible format
