# WebBridge Package Endpoint Design

## Goal

Add the first Web-side package endpoint for Alife WebBridge so Alife can download a character bundle manifest, verify file hashes, download package files, and stage a local pending configuration draft.

## Scope

This phase is intentionally read-only from Alife's perspective. Web provides a manifest and downloadable bytes. Alife remains responsible for download, hash validation, local install, catalog persistence, and local confirmation before activation.

In scope:

- `GET /api/webbridge/packages/:id/manifest`
- `GET /api/webbridge/packages/:id/files/:fileId`
- One supported package id: `current-pet-character-bundle`
- One supported file id: `character-card`
- Bearer-authenticated access through the existing `withAuth` middleware
- `success({ data })` API envelope compatibility
- WebBridge preflight coverage for the manifest endpoint

Out of scope:

- Remote enable/start/switch/apply actions
- Plugin activation
- Marketplace package publishing
- Upload UI changes
- New database tables
- Alife TTS, QChat, DeskPet, or Speech changes

## API Shape

`GET /api/webbridge/packages/current-pet-character-bundle/manifest` returns:

```json
{
  "success": true,
  "data": {
    "schemaVersion": 1,
    "packageId": "current-pet-character-bundle",
    "packageType": "characterBundle",
    "displayName": "Current Pet Character Bundle",
    "version": "1.0.0",
    "files": [
      {
        "kind": "characterCard",
        "url": "http://localhost:3000/api/webbridge/packages/current-pet-character-bundle/files/character-card",
        "relativePath": "characters/current-pet/card.json",
        "sha256": "<sha256-of-download-bytes>",
        "size": 123
      }
    ],
    "configDraft": {
      "characterName": "Current Pet",
      "characterCardPath": "characters/current-pet/card.json",
      "live2DModelPath": ""
    },
    "activationPolicy": {
      "autoApply": false,
      "requiresLocalConfirmation": true
    }
  }
}
```

`GET /api/webbridge/packages/current-pet-character-bundle/files/character-card` returns the JSON bytes used to compute the manifest hash. The response content type is `application/json`.

## Data Source

The v1 package is derived from the authenticated user's current pet export. The package builder calls `petService.exportConfig(user.sub, user.workspaceId)` and converts that export into a character-card file. The manifest and file download use the same builder logic so the manifest hash matches the file bytes.

## Security

- Reject unknown package ids with `NotFoundError`.
- Reject unknown file ids with `NotFoundError`.
- Never accept or expose arbitrary filesystem paths.
- Never return local machine paths.
- Use an absolute URL derived from the incoming request origin.
- Keep `activationPolicy.autoApply` hardcoded to `false`.
- Keep `activationPolicy.requiresLocalConfirmation` hardcoded to `true`.

## Verification

- Unit tests cover manifest shape, hash consistency, unknown package rejection, unknown file rejection, and preflight ordering.
- `npm run check:webbridge` must include the new package manifest check and keep all existing checks passing.
