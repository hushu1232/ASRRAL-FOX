# ADR-003: Pet Module as Platform Sub-module

- **Status**: Accepted
- **Date**: 2026-05-26

## Context

The AstralFox Unity desktop pet was initially an independent project. We needed to integrate it with the existing Avatar Web Management platform for user auth, asset management, and deployment.

Alternatives considered:
- **Separate microservice**: Adds deployment complexity, auth duplication, and cross-service latency
- **Monorepo with shared packages**: Better than separate services, but still requires inter-service auth
- **Sub-module in existing Next.js app**: Reuses auth, DB, CI/CD, monitoring

## Decision

**The pet module is a sub-module within the Next.js app**, sharing:

- **Auth**: Same `withAuth()` middleware, JWT tokens, workspace isolation
- **Database**: Three new Prisma models in the same PostgreSQL instance with foreign keys to existing User, Avatar, Asset tables
- **Infrastructure**: Same Docker image, K8s deployment, Prometheus metrics, Grafana dashboards
- **CI/CD**: Same GitHub Actions pipeline

The Unity client communicates via:
- REST API (`/api/pet/*`) for configuration and session management
- WebSocket for real-time AI interaction streaming

## Consequences

**Positive:**
- Zero new infrastructure — pet module deploys as part of the existing app
- Pet configs reference avatars and assets via foreign keys with referential integrity
- Asset takedown automatically notifies affected pet users (`asset.service.ts` → `petService.findConfigsByAsset()`)

**Negative:**
- Increased API surface in a single deployable (mitigated by rate limiting and resource quotas)
- Pet-specific dependencies (Live2D export, FFmpeg path) are in the same `package.json`
- Unity client must stay compatible with the REST API contract
