# WebBridge Preflight

This checklist verifies that the local Web app is ready for the desktop WebBridge first-pass integration.

## Command

Run the focused preflight from the project root:

```powershell
npm run build
npm run check:webbridge
```

`npm run check:webbridge` starts the standalone Next server, waits for `/api/health`, runs the WebBridge checks, and stops the server.

For quieter local output:

```powershell
$env:OTEL_TRACES_SAMPLER='parentbased_traceidratio'
$env:OTEL_TRACES_SAMPLER_ARG='0'
$env:LOG_LEVEL='error'
npm run check:webbridge
```

## Environment

The preflight defaults to the seeded local demo account:

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEBBRIDGE_BASE_URL` | `http://localhost:3000` | Web app origin to check. |
| `WEBBRIDGE_EMAIL` | `demo@example.com` | Login email. |
| `WEBBRIDGE_PASSWORD` | `demo1234` | Login password. |
| `WEBBRIDGE_TIMEOUT_MS` | `10000` | Per-request timeout. |

`WEBBRIDGE_BASE_URL` falls back to `TEST_BASE_URL`, then `NEXT_PUBLIC_APP_URL`, then `http://localhost:3000`.

## Checked Endpoints

The preflight validates the minimum desktop bridge chain:

| Step | Endpoint | Expected result |
| --- | --- | --- |
| Health | `GET /api/health` | HTTP 200. |
| Login | `POST /api/auth/login` | HTTP 200, `data.accessToken`, and `refreshToken` cookie. |
| Refresh | `POST /api/auth/refresh` | HTTP 200 and refreshed `data.accessToken`. |
| Pet config | `GET /api/pet/config` | HTTP 200 and a config `id`. |
| Pet sync | `POST /api/pet/sync` | HTTP 200 and `version`, `petName`, `animationModel`, `mappedAssets`. |
| Pet export | `GET /api/pet/export` | HTTP 200 and desktop export arrays: `params`, `bodyParams`, `equippedParts`, `mappedAssets`. |

## Sync Payload

The preflight sends this payload to `POST /api/pet/sync`:

```json
{
  "clientVersion": "desktop-webbridge-preflight",
  "capabilities": ["config", "assets", "avatar"]
}
```

## Interpreting Failures

- `health` fails: the Web server did not start or `/api/health` is unavailable.
- `login` fails: seeded credentials, auth route, or database seed state are not ready.
- `refresh` fails: the refresh cookie flow is broken.
- `pet config` fails: authenticated pet config access is broken.
- `pet sync` fails: the desktop WebBridge contract is not ready.
- `pet export` fails: the desktop export shape is not ready for client consumption.

If the direct script is needed against an already running remote or local server, run:

```powershell
$env:WEBBRIDGE_BASE_URL='http://localhost:3000'
npx tsx scripts/check-webbridge-ready.ts
```
