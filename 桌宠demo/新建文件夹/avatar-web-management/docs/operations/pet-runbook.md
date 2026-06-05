# Pet Module — Operations Runbook

## Service Overview

| Component | Description | Port | Health Check |
|-----------|-------------|------|-------------|
| Next.js server | Pet config API, export, session management | 3000 | `GET /api/health` |
| PostgreSQL | PetConfig, PetAssetMapping, PetSessionLog tables | 5432 | `pg_isready` |
| Redis (Upstash) | Rate limiting, session cache | 6379 | `PING` |
| WebSocket server | Real-time AI interaction streaming | 14001 | `ws://localhost:14001` |

## Key Database Tables

- `pet_configs` — 1:1 with users, stores encrypted API keys, animation preferences
- `pet_asset_mappings` — links platform assets to named pet slots (idle_animation, walk_animation, etc.)
- `pet_session_logs` — per-session interaction counts, crash logs, timestamps

## Common Procedures

### Restart Pet API Service

```bash
# K8s
kubectl rollout restart deployment/avatar-web -n avatar-web

# Docker
docker compose restart avatar-web
```

Verify: `curl -s https://<host>/api/pet/config -H "Authorization: Bearer <token>" | jq .success`

### Rotate PET_ENCRYPTION_KEY

1. Generate new key: `openssl rand -hex 32`
2. Set `PET_ENCRYPTION_KEY=<new_key>` in environment
3. Run re-encryption migration script (iterates all pet_configs rows, decrypts with old key, re-encrypts with new key)
4. Remove old key from secrets manager
5. Restart service

### Backup Pet Data

```sql
-- Export pet configs (WITHOUT encryption — API keys come out encrypted)
COPY (SELECT * FROM pet_configs) TO '/backups/pet_configs.csv' CSV HEADER;
COPY (SELECT * FROM pet_asset_mappings) TO '/backups/pet_asset_mappings.csv' CSV HEADER;
COPY (SELECT * FROM pet_session_logs WHERE start_time > NOW() - INTERVAL '90 days')
  TO '/backups/pet_session_logs.csv' CSV HEADER;
```

### Clean Up Orphaned Sessions

Sessions without an `end_time` that are older than 24 hours are considered orphaned:

```sql
UPDATE pet_session_logs
SET end_time = start_time + INTERVAL '1 hour'
WHERE end_time IS NULL AND start_time < NOW() - INTERVAL '24 hours';
```

## Troubleshooting

### "PetConfig not found" on GET /api/pet/config

**Symptom:** API returns 404 for a user who should have a config.

**Diagnosis:**
```sql
SELECT * FROM pet_configs WHERE user_id = '<user_sub>';
```

**Fix:** The auto-create logic in `getOrCreateConfig` should have created one. Check:
1. Database connectivity — `prisma.petConfig.create` may have failed silently
2. User record exists in `users` table (foreign key)
3. Check server logs for `pet-service` logger errors

### API Keys Not Decrypting in Export

### High Rate of 5xx on Pet Endpoints

**Symptom:** Grafana dashboard "Avatar Web — HTTP Overview" shows elevated 5xx on `/api/pet/*` routes.

**Diagnosis:**
1. Check PostgreSQL connection pool: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'avatar_web';`
2. Check for slow queries: Grafana "Avatar Web — Database" → P95 query duration
3. Check Redis connectivity for rate limiter

**Common causes:**
- Prisma connection pool exhaustion → increase `connection_limit` or add connection timeout
- `encryptSecret` scrypt CPU spikes under concurrent config updates → add request queue
- Asset export (large blendshape JSON) timing out → increase function timeout or paginate

### Asset Takedown Not Notifying Pet Users

**Symptom:** Deleting an asset doesn't create notifications for pet users who mapped it.

**Diagnosis:**
1. Check `asset.service.ts` batch delete flow — `findConfigsByAsset()` is called for each deleted asset
2. Verify notification records in `notifications` table: `SELECT * FROM notifications WHERE type = 'asset_takedown_pet';`
3. Check if `petConfig` relation on `petAssetMapping` includes users whose config was deleted (null check)

## Alert Response

| Alert | Severity | Action |
|-------|----------|--------|
| `PetConfigCreateFailures` | Critical | Check DB connectivity, free disk space |
| `PetSessionIngestionLag` | Warning | Check WS server, DB write throughput |
| `PetExport5xxRate` | Warning | Check avatar version JSON parse failures, DB query timeouts |
| `PetAPIKeyDecryptFailures` | Critical | PET_ENCRYPTION_KEY may have changed — keys unrecoverable without re-encryption |

### On-Call Escalation

1. **L1 (5 min):** Check Grafana dashboard "Avatar Web — HTTP Overview" for pet route error rate
2. **L2 (15 min):** Check server logs for `pet-service` or `api:pet:*` errors
3. **L3 (30 min):** Page backend lead if DB corruption suspected or encryption key compromised

## Maintenance Windows

- **Session log cleanup:** Weekly cron (Sunday 03:00 UTC) — delete sessions older than 90 days
- **API key rotation audit:** Monthly — check for keys encrypted with deprecated key version
- **DB index review:** Quarterly — verify indexes on `pet_configs.user_id`, `pet_asset_mappings.pet_config_id`, `pet_session_logs.user_id`
