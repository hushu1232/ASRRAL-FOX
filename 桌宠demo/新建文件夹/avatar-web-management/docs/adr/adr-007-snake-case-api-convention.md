# ADR-001: Snake-case API Convention

- **Status**: Accepted
- **Date**: 2026-05-26

## Context

Prisma Client returns model fields in camelCase (matching the schema's `@map` names). PostgreSQL stores columns in snake_case. The `@prisma/adapter-pg` may return raw rows in either format depending on the version.

We need a single, predictable wire format for the Next.js API routes consumed by the React frontend and the Unity desktop pet client.

## Decision

**All API responses use snake_case keys.** A shared `toSnakeCase()` helper in `src/lib/db/index.ts` normalizes every Prisma result before it reaches the API route handler.

- Prisma returns camelCase → `toSnakeCase()` converts → API responds snake_case
- Frontend components and the Unity client consume snake_case keys
- API request bodies use camelCase (standard JS convention) → `prepareConfigForDb()` maps back

## Consequences

**Positive:**
- Consistent wire format regardless of Prisma adapter behavior
- Matches PostgreSQL convention, making raw SQL fallbacks predictable
- Easy to spot missing conversions (camelCase in API response = bug)

**Negative:**
- Every service method must remember to call `toSnakeCase()` on DB results
- Two naming conventions co-exist in the codebase (camelCase in service internals, snake_case on the wire)
- `decryptConfigFields()` and similar helpers must use snake_case key access — a source of initial bugs (caught by unit tests)
