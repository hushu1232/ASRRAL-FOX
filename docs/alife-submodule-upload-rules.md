# Alife Submodule Upload Rules

## Current Repository Model

FOXD and Alife are separate repositories.

```text
D:\FOXD
  -> git@github.com:hushu1232/ASRRAL-FOX.git
  -> contains alife-service as a Git submodule

D:\Alife
  -> git@github.com:hushu1232/Alife-byastralfox.git
  -> canonical local Alife .NET 9 source checkout

D:\FOXD\alife-service
  -> submodule checkout of Alife-byastralfox
  -> should normally point at a specific Alife commit
```

The active runtime direction is Alife .NET 9. Unity-side desktop pet work is abandoned unless it is explicitly reopened.

## Hard Rules

- Do not upload Alife into FOXD as a copied directory snapshot.
- Do not create new `Update Alife service snapshot` commits in FOXD.
- Do not replace the `alife-service` submodule with a normal directory.
- Do not commit Alife runtime state, build outputs, local caches, model weights, temporary files, or generated package output.
- Do not force-push `master` unless the old `master` has first been preserved as a backup branch and the command uses `--force-with-lease`.
- Push or publish the Alife commit first. Only update FOXD's submodule pointer after the Alife commit exists on `Alife-byastralfox`.

## Local Folder Roles

Use `D:\Alife` as the primary place for Alife development and Alife Git commits.

Use `D:\FOXD\alife-service` as the parent repository's submodule checkout. It may be used for focused verification, but if code is changed there, move or cherry-pick that change back into `D:\Alife` before publishing the FOXD pointer.

Use `D:\FOXD` for FOXD Web platform work and for committing only the submodule gitlink update after Alife is published.

## Normal Upload Flow

1. Commit Alife changes in `D:\Alife`.
2. Verify Alife with the user-local .NET 9 SDK:

   ```powershell
   & "C:\Users\hu shu\.dotnet\dotnet.exe" test "Tests\Alife.Test.Framework\Alife.Test.Framework.csproj" --filter "FullyQualifiedName~WebBridge"
   ```

3. Push Alife first:

   ```powershell
   git -C D:\Alife push alife-byastralfox master
   ```

4. Update the FOXD submodule checkout to the published Alife commit:

   ```powershell
   git -C D:\FOXD\alife-service fetch origin
   git -C D:\FOXD\alife-service checkout <published-alife-commit>
   ```

5. Commit the FOXD gitlink update:

   ```powershell
   git -C D:\FOXD add alife-service
   git -C D:\FOXD commit -m "chore: update Alife submodule pointer"
   git -C D:\FOXD push github master
   ```

The FOXD commit should show only a submodule pointer change unless FOXD Web files were intentionally changed too.

## Version Snapshot Policy

Version snapshots belong in Git tags and GitHub releases, not copied source snapshots inside FOXD.

For a stable Alife runtime version:

```powershell
git -C D:\Alife tag alife-vX.Y.Z <alife-commit>
git -C D:\Alife push alife-byastralfox alife-vX.Y.Z
```

For an interview/demo checkpoint:

```powershell
git -C D:\Alife tag interview-snapshot-YYYY-MM-DD <alife-commit>
git -C D:\Alife push alife-byastralfox interview-snapshot-YYYY-MM-DD
```

If FOXD also needs a matching parent-repository checkpoint:

```powershell
git -C D:\FOXD tag foxd-vX.Y.Z <foxd-commit>
git -C D:\FOXD push github foxd-vX.Y.Z
```

Use GitHub Releases or external artifact storage for packaged binaries, generated builds, models, and large runtime assets. Do not commit those artifacts to either repository.

## Existing Snapshot History

The old snapshot-based `master` states have been preserved as backup branches:

```text
Alife-byastralfox:
backup/master-before-reconcile-20260628

ASRRAL-FOX:
backup/master-before-submodule-20260628
```

Treat these branches as read-only archives. They are for historical recovery only and should not be merged back into the active `master` branch.

## Force Push Rule

If a future cleanup requires replacing `master`, use this pattern:

```powershell
git push --force-with-lease=master:<expected-old-master-commit> <remote> <source>:master
```

Before doing so:

1. Create a backup branch for the current remote `master`.
2. Verify the target branch or commit.
3. Confirm the expected old `master` commit with `git ls-remote`.
4. Use `--force-with-lease`, not plain `--force`.

If the lease fails, stop and re-check the remote state.

## Cleanup Boundaries

Never commit these from Alife or FOXD:

- `.git`
- `.codegraph`
- `.worktrees`
- `.tmp`
- `.playwright-mcp`
- `Outputs`
- `output`
- `Runtime`
- `Storage`
- `Temp`
- `Models`
- `bin`
- `obj`
- local logs
- generated package staging directories
- local runtime credentials or tokens

If a generated artifact must be shared, publish it as a release asset or store it outside Git.