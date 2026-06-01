# Contributing to avatar-web

## Quick Start

```bash
git clone https://github.com/avatar-system/avatar-web.git
cd avatar-web
npm install
cp .env.example .env.local   # edit with your local config
npx prisma generate
npx prisma db push
npm run dev                    # http://localhost:3000
```

## Branch Strategy

```
main          ← production (protected)
  └─ feat/*   ← feature branches (squash-merge to main)
  └─ fix/*    ← bug fixes
  └─ chore/*  ← CI/docs/dependencies
```

- Branch from `main`, PR back to `main`
- No direct commits to `main`
- Squash-merge preferred

## Commit Convention

```
<type>(<scope>): <description>

feat(pet): add export config endpoint
fix(auth): handle expired refresh token gracefully
docs(adr): add OpenTelemetry decision record
chore(deps): bump prisma to 7.8.1
```

## Before Submitting a PR

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test -- --no-coverage` — all tests green
- [ ] New features include tests (unit or contract)
- [ ] API changes update `src/lib/openapi.json`
- [ ] Breaking API changes update `CHANGELOG.md`
- [ ] Snake_case convention followed for API responses (see ADR-007)

## Code Style

- TypeScript `strict: true` — no implicit any
- Prefer explicit return types on exported functions
- Use `createLogger('scope:name')` for all logging — no `console.log`
- Import `@/*` aliases (configured in `tsconfig.json` paths)
- Formatting enforced by Prettier, linting by ESLint

## Testing

| Layer | Location | Runner | Dependencies |
|-------|----------|--------|--------------|
| Unit | `tests/unit/` | Jest | None |
| Contract | `tests/contract/` | Jest | None |
| Integration | `tests/*.test.ts` | Jest | PostgreSQL, Redis |
| E2E | `tests/e2e/` | Playwright | Full stack |
| Load | `k6/` | k6 | Running instance |

```bash
npm test -- --no-coverage           # unit + contract (fast, no dep)
npm test -- --testPathPattern=unit  # unit only
npm run test:e2e                    # Playwright E2E
```

## Documentation

- Architecture decisions: `docs/adr/` (numbered, template in `adr-template.md`)
- Operations: `docs/operations/`
- OpenAPI: `src/lib/openapi.json` → served at `/api/docs`

## Project Structure

```
src/
├── app/api/          # Next.js App Router route handlers
├── components/       # React UI components
├── lib/              # Shared utilities
│   ├── auth/         # JWT, middleware, roles
│   ├── services/     # Business logic (petService, etc.)
│   ├── telemetry/    # OpenTelemetry tracing
│   └── rate-limit/   # Rate limiter with fail-open
└── mock/             # MSW handlers for Storybook
```

## Questions?

Open a Discussion on GitHub or ask in the #avatar-web Slack channel.
