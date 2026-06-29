# WebBridge Staged Applied Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Alife .NET 9 WebBridge package staged-to-applied loop a repeatable FOXD local check and fix the PetConfig fields that currently make `/api/pet/config` reject WebBridge desktop config updates.

**Architecture:** Keep the Web server runner in `scripts/test-integration-local.ts`, add a dedicated smoke mode that starts the standalone Web server and invokes a .NET 9 smoke project. Store smoke package output under `D:\FOXD\.worktrees\_alife-webbridge-integration\<timestamp>` by default so it never touches the normal Alife runtime.

**Tech Stack:** Next.js 16, Jest, Prisma 7 PostgreSQL migrations, Node `tsx`, .NET 9 Alife WebBridge project reference.

---

### Task 1: PetConfig WebBridge Fields

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/pet-service.test.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/prisma/schema.prisma`
- Create: `桌宠demo/新建文件夹/avatar-web-management/prisma/migrations/20260629090000_add_pet_config_webbridge_fields/migration.sql`

- [ ] Add a failing Jest regression test that reads `prisma/schema.prisma` and asserts the `PetConfig` model contains `characterExtra` plus the local Alife service fields already accepted by the API route.
- [ ] Run the focused test and confirm it fails because the schema is missing those fields.
- [ ] Add the fields to the Prisma `PetConfig` model with explicit database column mappings.
- [ ] Add a PostgreSQL migration that `ALTER TABLE pet_configs` adds the same columns.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Formal Staged-To-Applied Smoke

**Files:**
- Create: `tools/webbridge-smoke/AlifeWebBridgeSmoke.csproj`
- Create: `tools/webbridge-smoke/Program.cs`
- Create: `桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-staged-applied.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/scripts/test-integration-local.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/package.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/test-integration-local.test.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/package-scripts.test.ts`

- [ ] Add failing Jest tests that expect a `webbridge-smoke` local-server mode and `check:webbridge:smoke` package script.
- [ ] Run the focused tests and confirm the new assertions fail.
- [ ] Add the .NET 9 smoke project that references `D:\Alife` by default through an overridable `AlifeRoot` MSBuild property.
- [ ] Add the Node runner that finds the repository root, creates an isolated package root, and invokes `dotnet restore` plus `dotnet run`.
- [ ] Wire `webbridge-smoke` into the existing local server runner and expose `npm run check:webbridge:smoke`.
- [ ] Re-run the focused tests and confirm they pass.

### Task 3: Verification

**Files:**
- No new source files unless failures identify a root cause.

- [ ] Run `npm run test:unit -- tests/unit/pet-service.test.ts tests/unit/test-integration-local.test.ts tests/unit/package-scripts.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run check:webbridge:smoke` from the Web app root with `DOTNET_EXE=C:\Users\hu shu\.dotnet\dotnet.exe` and `ALIFE_ROOT=D:\Alife`.
- [ ] Report package root, install status, apply status, ActiveConfig path, staged Web status, and applied Web status.
