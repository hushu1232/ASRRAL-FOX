# Browser Live Validation Record - 2026-06-23

## Scope

This record covers Priority 1 from `docs/browser-global-task-plan.md`: real link validation for browser/web research.

## Summary

Status: partial completion, QQ end-to-end blocked by runtime/session state.

Completed:

- Real public search provider access was verified outside the sandbox.
- Real public page read through `AgentWebResearchService` was verified outside the sandbox.
- A reusable opt-in live smoke test was added.
- NapCat/OneBot local health was checked.
- OneBot action calls to the reachable account were checked.

Blocked:

- Full QQ/NapCat message-level smoke was not completed because Alife was not persistently running in health checks, XiaYu's OneBot endpoint was unreachable, and the reachable Mio endpoint reported `online=false`.

## Commands And Evidence

### QChat Live Health

Command:

```powershell
powershell -NoLogo -ExecutionPolicy Bypass -File D:\Alife\tools\check-qchat-live-health.ps1 -ProjectRoot D:\Alife -StoragePath D:\Alife\Storage -OneBotHost 127.0.0.1 -OneBotPort 3001 -Json
```

Observed:

- `napCatRunning=true`
- `oneBot.reachable=true` for `127.0.0.1:3001`
- `alifeRunning=false`
- XiaYu endpoint `127.0.0.1:3002` was not reachable
- Mio endpoint `127.0.0.1:3001` was reachable

### OneBot Action Probe

Endpoint: `ws://127.0.0.1:3001`

Observed:

- `get_login_info` returned `user_id=3340947887`, nickname `雨宫 咪绪`
- `get_status` returned `good=true`, `online=false`

Interpretation:

The local OneBot WebSocket is reachable and can answer actions, but the QQ session is not fully online. This is not enough to claim real QQ message send/receive closure.

### XiaYu Endpoint Probe

Endpoint: `ws://127.0.0.1:3002`

Observed:

- Connection failed.

Interpretation:

XiaYu's configured OneBot endpoint was not available during this validation run.

### Real Public Web Probe

Outside sandbox network probing showed:

- Bing search endpoint returned HTTP 200.
- DuckDuckGo HTML endpoint returned HTTP 200.
- A direct PowerShell fetch to Microsoft Learn hit a connection/TLS error, but the project live smoke was still able to search and read the Microsoft Learn result through its .NET pipeline.

### Project Live Smoke

Command:

```powershell
$env:ALIFE_WEB_LIVE_SMOKE='1'
dotnet test Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --no-restore --filter "FullyQualifiedName~AgentWebResearchLiveSmokeTests" --logger "console;verbosity=detailed"
```

Observed:

- Test passed.
- Query: `dotnet 9 release notes`
- Result: `reason=ok`
- Source: `What's new in .NET 9 | Microsoft Learn`
- URL: `https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-9/overview`
- Source type: `docs`
- Answer included a short conclusion and `来源`.

Interpretation:

The real public search and public read path is usable from the project code when network access is available.

## Added Test

`Tests/Alife.Test.Framework/AgentWebResearchLiveSmokeTests.cs`

Behavior:

- Skips by default.
- Runs only when `ALIFE_WEB_LIVE_SMOKE=1`.
- Uses real `DuckDuckGoHtmlSearchProvider`, `BingHtmlSearchProvider`, `AgentInternetService`, `AgentWebAccessService`, and `AgentWebResearchService`.
- Verifies that real search/read produces at least one evidence source and a sourced answer.

## Remaining Manual QQ Smoke

Run these after restoring the QQ session:

1. Owner private chat: `查一下 dotnet 9 release notes`
2. Group member in allowed group: `@bot 搜 dotnet 9 release notes`
3. Non-owner private chat: `/search dotnet 9`
4. Owner private chat: `/qchat web doctor`

Expected:

- Owner private search may auto-read public HTTP/HTTPS pages.
- Group member search receives public search evidence only.
- Non-owner private `/search` does not enter the model, reveal menus, or trigger web research.
- `/qchat web doctor` shows browser provider state, internet switch state, and recent site experience.

Do not mark Priority 1 fully complete until these QQ message-level checks are manually or automatically verified against a healthy OneBot session.

