# Alife Local Health Contract Design - 2026-07-05

## Goal

Document the read-only Alife local management API contract before FOXD Web depends on it. This is a documentation-only checkpoint for Phase 4 of the roadmap. It does not add Web UI, does not probe a live local port, and does not modify `D:\Alife`.

## Source Evidence

The current Alife contract is defined in the canonical checkout at `D:\Alife`.

| Evidence | Meaning |
| --- | --- |
| `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\AlifeManagementApiOptions.cs` | Default API options: disabled, loopback bind URL, bearer-token requirement, timeout. |
| `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\AlifeManagementApiHost.cs` | HTTP endpoints and bearer-token middleware. |
| `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\AlifeManagementApiService.cs` | Read-only response construction. |
| `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\AlifeManagementApiModels.cs` | Stable JSON response models. |
| `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgeService.cs` | Management API lifecycle is owned by Alife `WebBridgeService`. |
| `D:\Alife\Tests\Alife.Test.Framework\AlifeManagementApiServiceTests.cs` | Contract tests for defaults, auth, endpoints, and lifecycle retry. |

## Current Alife API Contract

The local management API is disabled by default. When enabled inside Alife, it binds to:

```text
http://127.0.0.1:8787/
```

The default configuration requires a bearer token from:

```text
ALIFE_WEB_MANAGEMENT_TOKEN
```

The default request timeout on the Alife side is:

```text
10 seconds
```

The current read-only endpoints are:

```text
GET /api/alife/health
GET /api/alife/status
GET /api/alife/qchat/status
GET /api/alife/vision/status
GET /api/alife/tts/status
```

When `RequireBearerToken` is true, requests without:

```text
Authorization: Bearer <token>
```

receive HTTP 401. The API currently exposes `GET` endpoints only. No endpoint in this contract starts, stops, restarts, applies, stages, deletes, or mutates runtime state.

## Response Shape

`GET /api/alife/health` returns:

```json
{
  "status": "healthy",
  "service": "Alife",
  "version": "local",
  "timestampUtc": "2026-07-05T00:00:00Z"
}
```

`GET /api/alife/status` returns:

```json
{
  "status": "healthy",
  "agent": "local",
  "ownerId": "",
  "botId": "",
  "qchatEnabled": false,
  "visionEnabled": false,
  "visionStatus": "disabled",
  "visionReason": "vision_disabled",
  "ttsEnabled": false,
  "ttsStatus": "disabled",
  "ttsReason": "tts_disabled",
  "outboxEnabled": false,
  "timestampUtc": "2026-07-05T00:00:00Z"
}
```

`GET /api/alife/qchat/status` returns:

```json
{
  "enabled": false,
  "agent": "local",
  "ownerId": "",
  "botId": "",
  "personaMode": "default",
  "commandMenuOwnerOnly": true,
  "nonOwnerCommandsBlocked": true
}
```

`GET /api/alife/vision/status` returns:

```json
{
  "enabled": false,
  "ready": false,
  "status": "disabled",
  "reason": "vision_disabled",
  "provider": "agnes",
  "model": "agnes-2.0-flash",
  "publicUrlRequired": true,
  "apiKeyConfigured": false,
  "maxImagesPerMessage": 4
}
```

`GET /api/alife/tts/status` returns:

```json
{
  "enabled": false,
  "ready": false,
  "status": "disabled",
  "reason": "tts_disabled",
  "provider": "gpt-sovits"
}
```

Future FOXD code should parse these fields defensively. Unknown fields are ignored. Missing optional fields should map to `unknown`, not to a false claim that a local runtime is healthy.

## Process Ownership

Alife owns the local API process. In the current source, `WebBridgeService.StartAsync()` starts the management API only when `Configuration.ManagementApi.Enabled` is true, and `WebBridgeService.DestroyAsync()` stops it.

FOXD Web is a consumer only. FOXD must not:

- start Alife
- stop Alife
- restart Alife
- spawn shell commands to manage Alife
- mutate Alife runtime storage
- write into `D:\Alife`
- write into `AlifePath.StorageFolderPath\WebBridge`
- assume the management API exists unless explicitly configured

## Authentication And Local Boundary

The API is loopback-only by default: `127.0.0.1`. FOXD must preserve that boundary in its own configuration and documentation.

Future FOXD integration should use separate Web-side configuration instead of assuming it can read Alife process environment variables:

```text
FOXD_ALIFE_LOCAL_HEALTH_ENABLED=false
FOXD_ALIFE_LOCAL_HEALTH_BASE_URL=http://127.0.0.1:8787
FOXD_ALIFE_LOCAL_HEALTH_TOKEN=<not set by default>
FOXD_ALIFE_LOCAL_HEALTH_TIMEOUT_MS=1500
```

The user may set `FOXD_ALIFE_LOCAL_HEALTH_TOKEN` to the same value as Alife's `ALIFE_WEB_MANAGEMENT_TOKEN`, but FOXD should treat that as an explicit user-owned bridge. The token must never be rendered in HTML, logs, client state, telemetry, screenshots, or error messages.

Browser components should not directly fetch `http://127.0.0.1:8787`. A future implementation should place probing behind a FOXD server-side adapter so tests can mock the local API, secrets stay server-side, and the UI receives a small sanitized status model.

## What FOXD May Display

The first Web UI integration may display only read-only awareness states:

- Alife local API not configured.
- Alife local API reachable.
- Alife local API unreachable.
- Authentication required or token rejected.
- Version unknown.
- Agent name, if returned.
- QChat enabled or disabled.
- Vision enabled, ready, missing key, or disabled.
- TTS enabled, ready, endpoint unreachable, or disabled.
- Outbox enabled or disabled.
- Last checked timestamp from FOXD, plus Alife `timestampUtc` if available.
- WebBridge package state already known from FOXD `/api/pet/sync/status`.
- Local confirmation still required when WebBridge status says so.

FOXD must label local health as advisory. A reachable local API is evidence that an Alife management endpoint responded; it is not proof that active desktop runtime package apply has succeeded.

## What FOXD Must Not Display Or Do

FOXD must not:

- show the bearer token
- show local absolute paths from Alife
- expose `ownerId` or `botId` by default in shared screenshots or public views
- claim Alife is installed if only the endpoint is unreachable
- claim Alife is healthy when the response is missing required health fields
- claim WebBridge is applied based only on `/api/alife/health`
- provide start, stop, restart, repair, apply, delete, shell, or PowerShell buttons
- silently probe loopback from the browser
- default to live probing in tests, build, or production startup

## Future FOXD Adapter Design

When implementation is approved later, the smallest safe shape is:

```text
FOXD server route or server utility
  -> reads FOXD_ALIFE_LOCAL_HEALTH_* env
  -> performs GET requests with timeout and bearer token
  -> maps raw Alife JSON into a sanitized local health view model
  -> never returns secrets
  -> never mutates Alife
  -> is covered by mock-based tests before any live probing
```

The client UI should consume only the sanitized view model. It should not know the bearer token, the raw local API base URL, or Alife-specific process details beyond display-safe statuses.

## Error Mapping

Future adapter states should be explicit:

| Condition | FOXD state |
| --- | --- |
| Integration disabled | `notConfigured` |
| Connection refused, DNS failure, timeout | `unreachable` |
| HTTP 401 or 403 | `authRequired` |
| Invalid JSON or missing required fields | `invalidResponse` |
| Health response with `status=healthy` | `reachable` |
| Any non-2xx response except auth | `error` |

The UI can show concise operator copy for these states, but it must not recommend shell commands as clickable browser actions.

## Verification Strategy

Before any Web source implementation:

1. Add mock-based unit tests for response mapping.
2. Add guardrails that no client component reads bearer tokens or calls loopback directly.
3. Verify disabled-by-default behavior.
4. Verify unreachable and auth-rejected states.
5. Verify malformed JSON maps to `invalidResponse`.
6. Run typecheck and build.
7. Only then document an opt-in live probe command, separate from automated tests.

Live probing is optional and must never be required for the ordinary test suite.

## Acceptance Criteria For This Contract

- The endpoint path is documented.
- The port source is documented.
- Process ownership is documented.
- Authentication and local-only boundaries are documented.
- FOXD display permissions are documented.
- FOXD disallowed behavior is documented.
- The first implementation direction is read-only and mock-tested.
- No FOXD source code depends on the live Alife local API yet.
- No Alife source files are modified by this checkpoint.
