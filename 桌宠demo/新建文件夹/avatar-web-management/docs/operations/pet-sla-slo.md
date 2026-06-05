# Pet Module — SLA / SLO

## Service Level Objectives

### SLO-1: Availability

| Metric | Target | Window |
|--------|--------|--------|
| Uptime (pet config API) | 99.9% | 30 days |
| Allowed error budget | 43.2 min/month | — |

**Measurement:** `sum(rate(avatar_http_requests_total{route=~"/api/pet/.*", status_code!~"5.."}[30d])) / sum(rate(avatar_http_requests_total{route=~"/api/pet/.*"}[30d]))`

**Exclusions:** Planned maintenance (announced 48h in advance), force majeure.

### SLO-2: Latency

| Metric | Target | Window |
|--------|--------|--------|
| P50 latency (GET /api/pet/config) | < 100ms | 30 days |
| P95 latency (GET /api/pet/config) | < 500ms | 30 days |
| P99 latency (GET /api/pet/config) | < 1000ms | 30 days |
| P95 latency (GET /api/pet/export) | < 2000ms | 30 days |

**Measurement:** `histogram_quantile(0.95, sum(rate(avatar_http_request_duration_seconds_bucket{route=~"/api/pet/.*"}[30d])) by (le, route))`

**Note:** Export latency is higher because it queries avatar versions and asset mappings.

### SLO-3: Error Rate

| Metric | Target | Window |
|--------|--------|--------|
| 5xx error rate (all pet endpoints) | < 0.1% | 30 days |
| 4xx error rate (validation) | < 5% | 30 days |

**Measurement:** 5xx: `sum(rate(avatar_http_requests_total{route=~"/api/pet/.*", status_code=~"5.."}[30d])) / sum(rate(avatar_http_requests_total{route=~"/api/pet/.*"}[30d]))`

### SLO-4: Session Ingestion

| Metric | Target | Window |
|--------|--------|--------|
| Session start success rate | > 99.5% | 30 days |
| Session ingestion latency (P95) | < 200ms | 30 days |

**Measurement:** Session start successes / session start attempts (from `petSessionLog.create` metrics).

### SLO-5: Data Durability

| Metric | Target |
|--------|--------|
| Recovery Point Objective (RPO) | 1 hour (point-in-time recovery via PostgreSQL WAL) |
| Recovery Time Objective (RTO) | 4 hours (restore from backup + replay WAL) |

## Error Budget Policy

| Error budget consumed | Action |
|----------------------|--------|
| < 50% | Normal operations |
| 50-80% | Freeze non-critical deployments; investigate root cause |
| 80-100% | Emergency-only changes; incident bridge open |
| > 100% | Postmortem required within 48h; SLO review |

## SLI Dashboard Queries

### Availability SLI
```promql
sum(rate(avatar_http_requests_total{route=~"/api/pet/.*", status_code!~"5.."}[30d]))
/
sum(rate(avatar_http_requests_total{route=~"/api/pet/.*"}[30d]))
```

### Latency SLI (P95)
```promql
histogram_quantile(0.95,
  sum(rate(avatar_http_request_duration_seconds_bucket{route=~"/api/pet/.*"}[30d])) by (le, route)
)
```

### Error Budget Remaining
```promql
1 - (
  sum(rate(avatar_http_requests_total{route=~"/api/pet/.*", status_code=~"5.."}[30d]))
  /
  sum(rate(avatar_http_requests_total{route=~"/api/pet/.*"}[30d]))
) / 0.999
```

## Review Cadence

| Activity | Frequency | Owner |
|----------|-----------|-------|
| SLO dashboard review | Weekly | Backend lead |
| Error budget review | Monthly | Engineering manager |
| SLO target adjustment | Quarterly | Platform team |
| Full SLA review with stakeholders | Biannual | CTO + Product |
