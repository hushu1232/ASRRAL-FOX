# Pet Sync POST Persistence Round Trip Design - 2026-07-05

## Goal

Make `POST /api/pet/sync` persist the desktop WebBridge pull state before returning the exported pet config, so the Web dashboard can observe a real desktop-state round trip through the existing sync status model.

## Current State

`GET /api/pet/sync` exports the current pet config through `petService.exportConfig(userId, workspaceId)`.

`POST /api/pet/sync` currently parses and discards the request body, then returns the same exported config. This keeps the desktop config pull working, but it does not update `PetSyncStatus`.

The persisted sync status infrastructure already exists:

- Prisma model: `PetSyncStatus`
- Status service: `src/lib/services/petSyncStatusService.ts`
- Status route: `GET/POST /api/pet/sync/status`
- UI model: `DesktopSyncStatus`

## Proposed Behavior

`POST /api/pet/sync` remains a config export endpoint. Its response body stays compatible with the current desktop client and remains `{ success: true, data: PetConfigExport }`.

Before returning that config, the route will persist a desktop config-pull snapshot through a new `petSyncStatusService.reportConfigPull(...)` method.

The persisted snapshot records:

- `desktopKnownVersion`: the version the desktop pulled. Defaults to the exported config version.
- `packageState`: `pulled`, unless a same-version higher state already exists.
- `requiresLocalConfirmation`: `true`, unless the same version is already applied.
- `lastSyncAt`: `body.lastSyncAt` when valid, otherwise service time.

The route accepts the existing metadata shape:

```json
{
  "clientVersion": "desktop-webbridge",
  "lastSyncAt": "2026-06-23T00:00:00.000Z",
  "capabilities": ["config", "assets", "avatar"]
}
```

Optional future-compatible version fields are allowed:

```json
{
  "desktopKnownVersion": 1771641600000,
  "packageVersion": 1771641600000
}
```

If both optional version fields are absent, the exported config version is used.

## State Rules

The config pull is not an apply confirmation.

Allowed changes from `POST /api/pet/sync`:

- no row -> `pulled`
- `published` same or older version -> `pulled`
- older Web status -> `pulled` for the current exported config version
- stale error for an older version -> clear the error and set `pulled`

Protected states:

- same-version `staged` stays `staged`
- same-version `failed` stays `failed`
- same-version `applied` stays `applied`
- newer persisted desktop version is not downgraded by an older pull report

Even when a same-version higher state is protected, a valid config pull may refresh `lastSyncAt` so the desktop connection can be shown as online without lying about applied state.

## Validation

`POST /api/pet/sync` should reject a non-object body with a `ValidationError`.

`lastSyncAt` uses the existing ISO validation behavior from `petSyncStatusService`.

`desktopKnownVersion` and `packageVersion` must be positive safe integers when provided.

`clientVersion` and `capabilities` are accepted for compatibility but are not persisted because the existing schema has no columns for them. This avoids a Prisma schema or migration change.

## Boundaries

This change must not:

- modify Prisma schema or migrations
- modify Alife code under `D:\Alife`
- modify the FOXD `alife-service` gitlink
- change WebBridge package manifest or file routes
- change dashboard UI
- make browser UI execute local shell commands
- turn advisory Alife local health into apply confirmation

## Test Strategy

Use TDD.

Add route contract tests proving:

- `POST /api/pet/sync` calls `petSyncStatusService.reportConfigPull(...)`
- the response remains the exported config
- invalid non-object bodies return a validation envelope
- unauthenticated requests do not export config or persist sync state

Add service unit tests proving:

- config pull creates a `pulled` row when no row exists
- config pull refreshes `lastSyncAt` while preserving same-version `applied`
- config pull clears stale older-version errors when the exported config is newer
- invalid `lastSyncAt` and invalid versions are rejected

Run focused tests first, then full app verification.

## Approval

This design is intentionally narrow: persist the existing desktop config pull as sync status evidence, without changing UI, schema, Alife runtime code, or response compatibility.
