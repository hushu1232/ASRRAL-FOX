# FOXD WebBridge Console UI v1 Snapshot

Date: 2026-06-29

## Version Point

FOXD repository:

```text
D:\FOXD
```

Branch:

```text
master
```

Remote:

```text
github git@github.com:hushu1232/ASRRAL-FOX.git
```

Snapshot commit:

```text
594a75dab42fb7c9e0cc9bd8bfc247c632260a4b
fix: tighten pet console mobile layout
```

Snapshot tag:

```text
foxd-webbridge-console-ui-v1
```

The tag has been pushed to GitHub.

## Runtime Direction

The active desktop/runtime direction is Alife .NET 9.

Unity-side desktop pet work is abandoned legacy context unless explicitly reopened.
Do not revive Unity runtime UX, Unity project files, or Unity MCP workflows as part of the current WebBridge path.

Alife framework target currently recorded in the submodule:

```text
net9.0-windows10.0.19041.0
```

Use the user-local .NET 9 SDK for Alife verification:

```powershell
& "C:\Users\hu shu\.dotnet\dotnet.exe" --list-sdks
```

## Repository Layout

FOXD Web platform:

```text
D:\FOXD
```

Web app:

```text
D:\FOXD\桌宠demo\新建文件夹\avatar-web-management
```

Canonical Alife development checkout:

```text
D:\Alife
```

FOXD Alife submodule checkout:

```text
D:\FOXD\alife-service
```

Current FOXD submodule pointer:

```text
1225746bfeb74f3f8ee586414875087c9d060b2c alife-service
```

Current canonical Alife checkout:

```text
1225746bfeb74f3f8ee586414875087c9d060b2c
```

Alife upload and submodule rules are recorded in:

```text
docs/alife-submodule-upload-rules.md
```

## Completed In This Version

The Pet/WebBridge console has been reorganized into a status-first operating surface.

Completed areas:

- Added the first FOXD UI specification token baseline.
- Added operational UI primitives:
  - `OperationPanel`
  - `MetricTile`
  - `StatusChip`
- Added runtime and setup summary components for the pet console.
- Extracted pet preview and config editor components.
- Reworked `/dashboard/pet` into a clearer Pet/WebBridge console.
- Kept WebBridge package validation as mock-based UI.
- Preserved the local-only mock contract: scenario switching must not call `fetch`.
- Tightened mobile layout so the pet console does not horizontally overflow at narrow viewport widths.
- Kept Ant Design 6 API usage aligned with current APIs.
- Kept the UI direction aligned with the current Insta360-inspired component/text-system goal.

Relevant pushed commits include:

```text
594a75d fix: tighten pet console mobile layout
4d92a8b feat: reorganize pet WebBridge console
2b71af0 refactor: align pet sync panels with UI primitives
3a76f13 refactor: tighten pet editor extraction contracts
fbbddfd fix: complete pet editor config shape
cd07818 fix: align pet editor extraction with plan
5529bb1 refactor: extract pet preview and editor
7392824 feat: add pet setup readiness strip
f77f161 feat: add pet runtime summary
26085e1 feat: add operational UI primitives
cfbd96c feat: add FOXD UI specification tokens
```

## Verification Snapshot

Full Web test suite was run with a local test secret:

```powershell
$env:JWT_SECRET='local-test-only-super-long-secret-for-verification-2026-06-29'
npm test
```

Recorded result:

```text
Test Suites: 89 passed, 89 total
Tests: 869 passed, 869 total
```

Build was run with local build env:

```powershell
$env:JWT_SECRET='local-build-only-super-long-secret-for-verification-2026-06-29'
$env:DATABASE_PATH='D:\FOXD\桌宠demo\新建文件夹\avatar-web-management\database\data.db'
npm run build
```

Recorded result:

```text
exit 0
```

WebBridge preflight was previously run in the feature worktree and passed:

```text
[PASS] health HTTP 200
[PASS] login HTTP 200
[PASS] refresh HTTP 200
[PASS] pet config HTTP 200
[PASS] pet sync HTTP 200
[PASS] pet export HTTP 200
[PASS] package manifest HTTP 200
```

Responsive visual verification was performed with a standalone server and Playwright:

```text
desktop passed
mobile 390px passed
scrollWidth=390
bodyWidth=390
no horizontal overflow
```

## Known Baseline Warnings

These warnings are known baseline items and were not introduced by the final v1 tag:

- `npm test` without `JWT_SECRET` can fail because an existing local integration test expects `JWT_SECRET`.
- Build still prints existing Turbopack/NFT trace warnings around:
  - `next.config.ts`
  - `src/lib/auth/keys.ts`
  - `src/app/.well-known/jwks.json/route.ts`
- Test output can include existing React `act(...)`, jsdom canvas/WebGL, and Ant Design deprecation warnings.

## Alife/WebBridge Integration Status

Alife/WebBridge work has been done up to protocol, implementation, unit/contract verification, Web preflight, and mock UI layers.

Evidence in Alife history includes:

```text
478a2b2 Add WebBridge config sync foundation
611c67d Complete WebBridge character and asset sync
4c568a8 Add WebBridge sync loop
b95422f fix: authenticate WebBridge package downloads
1225746 Update Alife GitHub upload workflow
```

Evidence in FOXD history includes:

```text
5506f9d Add WebBridge package endpoints
c892f90 Add WebBridge package installer
bd5be70 test: harden WebBridge package preflight
9055f3e docs: add WebBridge Alife integration runbook
```

What has been covered:

- WebBridge protocol framing.
- Web package endpoint implementation.
- Package manifest validation.
- Bearer-authenticated package file download on the Alife side.
- SHA-256 validation behavior.
- Package install staging behavior.
- Local catalog/config draft behavior.
- Pending activation semantics.
- Web preflight checks.
- Mock-based UI inspection states.

What has not yet been confirmed as complete:

- Real Alife .NET 9 runtime end-to-end integration.
- Isolated install smoke against a running Web server and Alife WebBridge service.
- Real Alife sync status flowing back into the Web UI.
- Real `pendingActivation` state shown from Alife runtime data.
- Local confirmation activation/apply flow.

The next integration phase should be an isolated smoke, not a live default-runtime test.

Recommended isolated root:

```text
D:\tmp\alife-webbridge-integration
```

The smoke must not:

- Start, stop, or restart the active Alife runtime without explicit approval.
- Enable `AutoSyncEnabled`.
- Call WebBridge activation/apply.
- Write into default Alife runtime storage.
- Delete Alife `Runtime`, `Storage`, `Outputs`, or long-task directories.

The smoke may:

- Start FOXD Web locally for package endpoints.
- Construct Alife WebBridge service with a test config.
- Use `PackageRootPath = D:\tmp\alife-webbridge-integration`.
- Call only package install/staging behavior.
- Verify files, hashes, catalog, and `pendingActivation`.

Detailed runbook:

```text
docs/webbridge-alife-local-integration.md
```

## Next Plan

Recommended sequence from this snapshot:

1. Fix baseline developer-experience issues:
   - Make bare `npm test` work without manually setting `JWT_SECRET`, without weakening production validation.
   - Investigate and narrow the Turbopack/NFT trace warnings.
2. Prepare isolated Alife WebBridge smoke:
   - Keep all output under `D:\tmp\alife-webbridge-integration`.
   - Do not touch live Alife runtime state.
   - Do not call activation/apply.
3. After isolated smoke passes, connect the pet console to real Alife sync states:
   - runtime health
   - package manifest availability
   - package file hash status
   - `pendingActivation`
   - failure details
4. Continue whole-site UI component and text-style unification:
   - use the current Pet/WebBridge console as the first reference implementation
   - keep component radii at 8px or less unless the existing design system requires otherwise
   - keep text scale, spacing, action placement, and responsive behavior consistent
   - avoid decorative gradient/orb-heavy treatment

## Upload Rules Reminder

For future Alife changes:

1. Commit and push Alife changes in `D:\Alife` first.
2. Push to `git@github.com:hushu1232/Alife-byastralfox.git`.
3. Update `D:\FOXD\alife-service` only as a submodule pointer.
4. Commit the submodule pointer in `D:\FOXD`.
5. Do not upload Alife source as a copied directory snapshot inside FOXD.
6. Do not create new `Update Alife service snapshot` commits.

