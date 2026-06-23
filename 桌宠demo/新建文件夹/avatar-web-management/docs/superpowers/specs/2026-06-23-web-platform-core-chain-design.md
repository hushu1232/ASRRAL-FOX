# Web Platform Core Chain Audit and Remediation Design

## Scope

This first pass targets only `avatar-web-management`. It does not change `alife-service`, the Python BFF, the rigging service, or GPT-SoVITS internals. External services may be inspected only to verify API contracts used by the Next.js platform.

The goal is to make the Web platform easier to trust by tracing the important frontend-to-backend paths, fixing the first batch of high-impact technical debt, and documenting frontend/backend completion status.

## Objectives

1. Map concrete code paths from pages and client stores to API routes, service-layer modules, database access, and external service proxies.
2. Identify runtime, build, type, auth, contract, and degradation issues in the core platform chain.
3. Fix narrowly scoped technical debt and performance issues where the expected behavior can be covered by tests first.
4. Produce a completion matrix for frontend pages, API routes, service-layer modules, data persistence, observability, and external dependencies.
5. Leave larger product gaps as tracked findings rather than expanding the first pass into broad feature work.

## Primary Code Areas

### Application Shell and UI

- `src/app/(auth)/layout.tsx`
- `src/components/layout/*`
- `src/stores/*`
- dashboard, avatars, assets, marketplace, settings, rigging, and pet preview pages

The audit checks whether pages load through the shared authenticated layout, call stable API routes, show loading/error/empty states, and avoid unnecessary client-side repetition.

### Authentication and Request Pipeline

- `src/middleware.ts`
- `src/lib/auth/middleware.ts`
- `src/lib/auth/jwt.ts`
- `src/lib/auth/roles.ts`
- `src/lib/csrf.ts`
- `src/lib/rate-limit/*`

The audit checks route protection, role boundaries, token refresh behavior, public route exceptions, and whether protected APIs fail consistently.

### API Routes and Services

- `src/app/api/auth/*`
- `src/app/api/avatars/*`
- `src/app/api/assets/*`
- `src/app/api/pet/*`
- `src/app/api/rigging/*`
- `src/app/api/tts/*`
- `src/app/api/market/*`
- `src/app/api/admin/*`
- `src/lib/services/*`
- `src/lib/api-response.ts`
- `src/lib/errors.ts`

The first repair batch prioritizes routes that bridge major subsystems: pet config/sync/assets/chat, rigging proxy, TTS proxy, auth, and health.

### Data Layer

- `prisma/schema.prisma`
- `src/lib/prisma.ts`
- `src/lib/db/*`
- `database/schema.pg.sql`
- `database/schema.sql`

The audit records which paths still use legacy SQLite helpers and which use Prisma/PostgreSQL. The first pass should not perform a broad database migration unless a specific failing route requires it.

### External Service Proxies

- `src/lib/rigging/client.ts`
- `src/lib/rigging/pipeline.ts`
- `src/lib/services/ttsService.ts`
- `src/app/api/pet/chat/route.ts`
- `src/app/api/pet/chat/stream/route.ts`
- `src/app/api/pet/tts/route.ts`

The audit checks timeout handling, abort behavior, circuit breakers, fallback behavior, response normalization, and contract drift with:

- Rigging service at `RIGGING_SERVICE_URL`, default `http://localhost:8001`
- GPT-SoVITS service at `GPT_SOVITS_URL`, default `http://localhost:8002`
- Ollama at `OLLAMA_URL`, default `http://localhost:11434`

### WebSocket and Realtime

- `src/instrumentation.node.ts`
- `src/lib/ws/server.ts`
- `src/hooks/useEditorSync.ts`
- `src/components/rigging/PipelineProgress.tsx`
- `src/app/(auth)/messages/page.tsx`

The audit checks server startup, port configuration, graceful behavior in tests, client reconnect behavior, and whether realtime paths have polling fallbacks.

## First-Pass Priority Rules

### Must Fix

- Typecheck, lint, unit test, or build failures directly tied to the audited core chain.
- API response shape mismatches that break documented clients or `alife-service` WebBridge expectations.
- Auth or role checks that incorrectly expose protected data or block intended protected routes.
- External service calls without timeout or clear fallback where the route is user-facing.
- Route handlers that return inconsistent errors for the same class of failure.

### Should Fix

- Duplicate service-call logic that already has a local abstraction.
- Missing low-cost cache/health result reuse where repeated calls occur on normal page load.
- Large route handlers with obvious extractable helpers, if covered by focused tests.
- Missing request validation for public or high-traffic routes.

### Record Only

- New product features.
- Broad UI redesign.
- Full SQLite-to-Prisma migration.
- Payment/provider completion.
- Marketplace/community feature expansion.
- Microservice internal rewrites.

## Testing Strategy

Production code changes must be test-first:

1. Write a focused failing test that proves the desired behavior.
2. Run the test and verify it fails for the expected reason.
3. Implement the smallest code change that passes the test.
4. Run the focused test again.
5. Run the relevant broader verification command.

Likely commands:

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

If a command cannot run because local infrastructure is missing, record the exact dependency and continue with the next meaningful verification.

## Completion Matrix

The final report should include a matrix with these statuses:

- `Complete`: usable and tested for its primary flow.
- `Partial`: primary path exists but has gaps, missing tests, degraded UX, or incomplete edge handling.
- `Stub`: mock-only shell or documented future implementation.
- `Broken`: likely runtime failure, build/type failure, bad contract, or missing dependency.
- `Unknown`: not verified in this pass.

Rows should cover:

- Public pages
- Authenticated pages
- Admin pages
- Avatar and asset flows
- Marketplace and purchase flows
- Pet configuration and preview
- Rigging pipeline
- TTS and voice cloning
- Notifications and conversations
- API routes
- Service modules
- Database models
- Realtime/WebSocket paths
- Observability and deployment assets

## Expected Deliverables

1. A code-path map for the audited core chain.
2. A frontend completion matrix.
3. A backend/API completion matrix.
4. A microservice proxy contract summary.
5. A list of fixed technical debt with file paths.
6. A list of performance improvements with observed behavior.
7. Verification command results.
8. Remaining risks and recommended second-pass work.

## Non-Goals

- Do not re-architect the whole platform.
- Do not move the Web platform into `alife-service`.
- Do not rewrite Python services.
- Do not add new marketplace/payment/community product scope unless needed to fix a broken core path.
- Do not change deployment topology beyond small config or health-check fixes.
