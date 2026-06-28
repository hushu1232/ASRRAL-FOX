# Changelog

All notable changes to the avatar-web API. This project follows [Semantic Versioning](https://semver.org/).

Breaking changes that affect the Alife WebBridge client are marked with ⚠️.

---

## [0.2.0] — 2026-05-27

### Added
- **Pet export endpoint** `GET /api/pet/export` — returns JSON contract for Alife WebBridge client
- **Pet API key encryption** — AES-256-GCM + scrypt KDF (ADR-008)
- **Circuit breaker** — per-service isolation for Azure/OpenAI
- **Rate limiter fail-open** — 200ms timeout → in-memory fallback
- **SLO burn-rate alerts** — Google SRE workbook multi-window rules
- **Canary deployment** — nginx canary ingress (configurable weight/header)
- **Alife WebBridge client contract test** — JSON Schema validation for pet export
- **Log aggregation** — Promtail → Loki → Grafana log panels
- **WAF rules** — ModSecurity + OWASP CRS (22 custom rules)
- **DR runbook** — 4 disaster scenarios with executable recovery steps
- **ArgoCD Application** — GitOps delivery with auto-sync + self-heal
- **SBOM** — SPDX JSON generated per build (syft)
- **Synthetic monitoring** — Blackbox Exporter probes (health/login/pet-export/TLS)
- **PIA** — Privacy Impact Assessment (GDPR/CCPA/PIPL)
- **Multi-AZ topology** — pod spread across zones (maxSkew: 1)
- **OpenTelemetry** — distributed tracing with OTLP/console exporter

### Changed
- ⚠️ **API responses use snake_case** — all JSON keys converted from camelCase (ADR-007)
- ⚠️ **Pet config schema updated** — `modelId` → `pet_name`/`avatar_id`/`animation_model` etc.
- `npm audit` now blocks on critical severity (previously high)

### Fixed
- **Pet API key decryption** — `decryptConfigFields` was accessing camelCase keys on snake_case data
- **Frontend PetConfig** — updated interface to match snake_case API responses

---

## [0.1.0] — 2026-04-01

### Added
- Initial release: avatar management, asset upload, market templates
- JWT authentication (RS256) with refresh token rotation
- RBAC (designer / reviewer / admin)
- 2FA TOTP support
- OAuth 2.0 provider (authorize / token / userinfo)
- Chunked file upload (S3/MinIO)
- WebSocket real-time editor preview
- PostgreSQL full-text search
- Prometheus metrics endpoint
- Sentry error monitoring
- ISR on-demand revalidation
- Rate limiting (Upstash Redis)
- 11 Architecture Decision Records (ADR-001 through ADR-011)
