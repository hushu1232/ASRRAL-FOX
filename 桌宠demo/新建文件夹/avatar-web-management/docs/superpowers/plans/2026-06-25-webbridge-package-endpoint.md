# WebBridge Package Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first Web-side package manifest and file download endpoints for Alife WebBridge.

**Architecture:** Keep package generation in a small library under `src/lib/webbridge`. API routes use existing `withAuth`, `success`, and `error` wrappers. The first package is generated from `petService.exportConfig`, exposes one character-card file, and never includes activation actions.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, Jest, Node `crypto`, existing `withAuth` middleware and API response helpers.

---

## File Structure

- Create `src/lib/webbridge/package-service.ts`  
  Defines WebBridge package types, builds the v1 manifest, builds character-card bytes, computes SHA-256, and rejects unknown package/file ids.

- Create `src/app/api/webbridge/packages/[id]/manifest/route.ts`  
  Authenticated GET route returning the manifest envelope.

- Create `src/app/api/webbridge/packages/[id]/files/[fileId]/route.ts`  
  Authenticated GET route returning file bytes.

- Create `tests/unit/webbridge-package-service.test.ts`  
  Unit tests for package generation and hash consistency.

- Create `tests/contract/webbridge-package-api.test.ts`  
  Route tests for success and rejection cases.

- Modify `scripts/check-webbridge-ready.ts`  
  Add a package manifest preflight check after pet export.

- Modify `tests/unit/webbridge-preflight.test.ts`  
  Verify preflight includes the package manifest endpoint.

## Task 1: Package Builder

- [x] Write a failing test in `tests/unit/webbridge-package-service.test.ts` that builds a manifest from a pet export and asserts `autoApply` is false.
- [x] Run `npx jest --runInBand tests/unit/webbridge-package-service.test.ts` and confirm it fails because `package-service` does not exist.
- [x] Implement `src/lib/webbridge/package-service.ts` with `buildWebBridgePackageManifest`, `buildWebBridgePackageFile`, and exported constants for `current-pet-character-bundle` and `character-card`.
- [x] Run `npx jest --runInBand tests/unit/webbridge-package-service.test.ts` and confirm it passes.

## Task 2: Hash Consistency and Rejections

- [x] Add tests that manifest `files[0].sha256` equals the SHA-256 of downloaded character-card bytes.
- [x] Add tests that unknown package ids and file ids throw `NotFoundError`.
- [x] Run the package-service test and confirm the new tests fail before implementation.
- [x] Add the missing validation and shared file-byte generation in `package-service.ts`.
- [x] Run the package-service test and confirm it passes.

## Task 3: API Routes

- [x] Write route tests in `tests/contract/webbridge-package-api.test.ts` for manifest success, file success, unknown package 404, and unknown file 404.
- [x] Run `npx jest --runInBand tests/contract/webbridge-package-api.test.ts` and confirm routes are missing.
- [x] Create the two route handlers using `withAuth`, `success`, `error`, and `await ctx.params`.
- [x] Run `npx jest --runInBand tests/contract/webbridge-package-api.test.ts` and confirm it passes.

## Task 4: WebBridge Preflight

- [x] Add a failing assertion to `tests/unit/webbridge-preflight.test.ts` that the package manifest endpoint is checked after pet export.
- [x] Run `npx jest --runInBand tests/unit/webbridge-preflight.test.ts` and confirm it fails.
- [x] Add `checkPackageManifest` to `scripts/check-webbridge-ready.ts`.
- [x] Run `npx jest --runInBand tests/unit/webbridge-preflight.test.ts` and confirm it passes.

## Task 5: Regression

- [x] Run `npx jest --runInBand tests/unit/webbridge-package-service.test.ts tests/contract/webbridge-package-api.test.ts tests/unit/webbridge-preflight.test.ts`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Run `npm run check:webbridge`.

## Self-Review

- Spec coverage: package manifest, file download, auth, hash consistency, rejection, and preflight are covered.
- Placeholder scan: no placeholders remain.
- Type consistency: package ids, file ids, and route paths are named consistently across tasks.
