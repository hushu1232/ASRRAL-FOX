# Audio2Face — Lip Sync Module

## Current: Procedural amplitude analysis
- Extracts RMS audio amplitude per frame
- Maps to MouthOpenY + MouthForm via threshold + variation
- Works with ANY audio source (not just Azure TTS)

## Production Path: Azure SDK viseme pipeline

Reference: Navi-Studio/Virtual-Human-for-Chatting (MIT)

### Integration steps:
1. Add Azure Cognitive Services SDK to Unity
2. SSML: `<mstts:viseme type="FacialExpression"/>`
3. Subscribe to `synthesizer.VisemeReceived`
4. Parse `BlendShapeEntity` JSON → `blendShapeQueue`
5. Dequeue per frame in `LateUpdate()`

### Azure viseme → Live2D parameter mapping:
| Azure Viseme Index | Meaning | Live2D Parameter |
|-------------------|---------|-----------------|
| 17 | jawOpen | ParamMouthOpenY |
| 19 | mouthFunnel | ParamMouthForm |
| 20 | mouthPucker | ParamCheek / ParamBreath |
| 18 | mouthStretch | ParamMouthForm (negative) |
| 13 | mouthClose | ParamMouthOpenY = 0 |
