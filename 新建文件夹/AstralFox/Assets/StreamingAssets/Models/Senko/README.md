# Senko (仙狐) — AstralFox Default Skin

**Source:** Eikanya/Live2d-model (GitHub, 3000+ stars)
**Character:** Senko-san from "The Helpful Fox Senko-san" (Sewayaki Kitsune no Senko-san)
**License:** Personal/non-commercial use only. Model extracted from game assets.

⚠️ **IMPORTANT**: This model is for personal use and development testing only.
Do NOT distribute commercially without proper licensing from the copyright holder.

## Files

| File | Size | Purpose |
|------|------|---------|
| `senko_normal.moc3` | 1.6MB | Live2D Cubism 3.0 model data |
| `senko.model3.json` | 1.2KB | Model configuration (references textures, motions, physics) |
| `senko.physics3.json` | 55KB | Physics parameters (tail sway, ear bounce, hair) |
| `senko_normal.4096/texture_00.png` | 6.2MB | High-res texture atlas (4096×4096) |
| `motions/Idle.motion3.json` | 24KB | Idle loop animation |
| `motions/Sleeping.motion3.json` | 12KB | Sleeping animation |
| `motions/Singing.motion3.json` | 56KB | Singing/talking animation |

## Integration with AstralFox

The model is loaded directly by Cubism SDK via `senko.model3.json`.
Set as default in `Assets/StreamingAssets/Models/Senko/senko.model3.json`.

## Alternatives

- Kuroneko (Black Cat) from LOVE³-LOVE CUBE- : simpler model, no physics/motions — good lightweight fallback
- Azur Lane collection : many cute ship-girl models with varying completeness
