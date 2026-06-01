# Disaster Recovery Runbook — avatar-web

**Version**: 1.0 | **Owner**: Platform Team | **Last drill**: TBD

## RPO / RTO

| Metric | Target | Mechanism |
|--------|--------|-----------|
| RPO | 1 hour | Daily pg_dump + WAL archiving (if streaming replication enabled) |
| RTO | 4 hours | Helm redeploy + S3 restore + DNS failover |

## Pre-requisites

- `kubectl` access to production cluster
- `aws` CLI or MinIO client (`mc`) for S3 backup access
- `helm` v3 installed locally
- PGP decryption key for any encrypted backups

---

## Scenario 1: Database Corruption / Accidental Deletion

### Detection
- Application 5xx spike on write operations
- `SLOErrorBudgetLow` or `SLOBurnRateCritical` alert fires
- Grafana panel "Error Logs" shows Prisma/PostgreSQL errors

### Response

```bash
# 1. Identify the latest valid backup
aws s3 ls s3://avatar-backups/backups/$(date -u +%Y/%m)/ \
  --endpoint-url https://minio.storage.svc.cluster.local

# 2. Scale down the application to prevent writes
kubectl scale deployment avatar-web --replicas=0 -n production

# 3. Restore from latest backup
LATEST_BACKUP=$(aws s3 ls s3://avatar-backups/backups/ --recursive \
  --endpoint-url https://minio.storage.svc.cluster.local | sort | tail -1 | awk '{print $4}')

aws s3 cp s3://avatar-backups/${LATEST_BACKUP} /tmp/restore.sql.gz \
  --endpoint-url https://minio.storage.svc.cluster.local

# 4. Drop and recreate database (CAUTION)
kubectl exec -it deploy/postgresql -- psql -U avatar -c "DROP DATABASE IF EXISTS avatar_management;"
kubectl exec -it deploy/postgresql -- psql -U avatar -c "CREATE DATABASE avatar_management;"

# 5. Restore
gunzip -c /tmp/restore.sql.gz | \
  kubectl exec -i deploy/postgresql -- psql -U avatar -d avatar_management

# 6. Scale application back up
kubectl scale deployment avatar-web --replicas=3 -n production

# 7. Verify
kubectl exec deploy/avatar-web -- curl -s http://localhost:3000/api/health
kubectl exec deploy/avatar-web -- curl -s http://localhost:3000/api/pet/config
```

### Validation
- `/api/health` returns 200
- User login works
- Pet configs are intact (spot-check 3 users)
- Avatars and assets are accessible

---

## Scenario 2: Full Cluster / Region Loss

### Detection
- All endpoints unreachable
- External monitoring (UptimeRobot / Pingdom) alerts
- `SLOErrorBudgetLow` fires immediately

### Response

```bash
# 1. Verify the outage is cluster-wide
kubectl cluster-info
kubectl get nodes

# 2. If cluster is unrecoverable, deploy to DR cluster
export KUBECONFIG=/path/to/dr-cluster-kubeconfig

# 3. Restore secrets from sealed-secrets or vault
kubectl apply -f sealed-secrets/production/

# 4. Restore database from latest S3 backup in DR region
# (S3 cross-region replication should already be enabled)

# 5. Deploy with Helm
helm upgrade --install avatar-web ./helm/avatar-web \
  -f ./helm/avatar-web/values.yaml \
  -f ./helm/avatar-web/values-production.yaml \
  --set ingress.host=avatar-dr.example.com \
  -n production --create-namespace

# 6. Update DNS to point to DR cluster ingress
# Route53 / Cloudflare: avatar.example.com → DR ingress LB
```

### Validation
- Smoke tests pass: `helm test avatar-web -n production`
- k6 load test baseline passes (no more than 5% degradation)
- DNS propagation verified: `dig avatar.example.com`

---

## Scenario 3: Secret Key Compromise

### Detection
- Security alert from gitleaks / Trivy
- Unusual API usage patterns in Grafana
- Manual report

### Response

```bash
# 1. Identify all affected secrets
kubectl get secrets -n production | grep avatar-web

# 2. Rotate JWT keys
# Generate new RSA keypair
openssl genrsa -out new-private.pem 2048
openssl rsa -in new-private.pem -pubout -out new-public.pem

# Update secret
kubectl create secret generic avatar-web-keys \
  --from-file=jwt-private.pem=new-private.pem \
  --from-file=jwt-public.pem=new-public.pem \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Rotate PET_ENCRYPTION_KEY
NEW_KEY=$(openssl rand -hex 32)
kubectl create secret generic avatar-web \
  --from-literal=PET_ENCRYPTION_KEY=$NEW_KEY \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Force all sessions to expire by restarting pods
kubectl rollout restart deployment/avatar-web -n production

# 5. Re-encrypt stored pet configs
# Run the key rotation script
kubectl exec deploy/avatar-web -- node scripts/rotate-pet-keys.js

# 6. Audit logs for unauthorized access during compromise window
kubectl exec deploy/postgresql -- psql -U avatar -d avatar_management \
  -c "SELECT * FROM audit_logs WHERE created_at > '[compromise_start]' ORDER BY created_at DESC;"
```

### Post-incident
- File incident report
- Update ADR if architecture change required
- Rotate all developer API keys

---

## Scenario 4: Redis / Session Store Failure

### Detection
- Rate limiter `upstashFailed` flag set (fail-open mode)
- Session creation failing
- Grafana panel shows Redis connection errors

### Response

```bash
# 1. Check Redis status
kubectl exec deploy/avatar-web -- nc -zv redis.prod.svc.cluster.local 6379

# 2. Rate limiter is already fail-open — no immediate user impact
# 3. If Redis is permanently down, redeploy Redis or switch to in-memory fallback
helm upgrade --install avatar-web ./helm/avatar-web \
  -f ./helm/avatar-web/values-production.yaml \
  --set config.redisHost=""  # empty disables Redis, rate limiter uses in-memory
```

---

## Quarterly DR Drill Checklist

- [ ] Notify stakeholders (Slack #platform, email) — 1 week before
- [ ] Verify latest backup exists and is restorable (scenario 1 dry-run)
- [ ] Execute scenario 1 in staging environment
- [ ] Measure: time from alert to restore complete (target: <30 min)
- [ ] Verify: pet configs decryptable after restore
- [ ] Verify: user login works after restore
- [ ] Document results in `docs/operations/dr-drill-log.md`
- [ ] File follow-up tickets for any issues found

## Emergency Contacts

| Role | Contact | Escalation (if no response in 15 min) |
|------|---------|--------------------------------------|
| Primary on-call | PagerDuty #avatar-web | Secondary on-call |
| DBA | PagerDuty #dba | Engineering Manager |
| Security incident | PagerDuty #security | CTO |
