# Privacy Impact Assessment (PIA) — avatar-web

**Date**: 2026-05-27 | **Version**: 1.0 | **Reviewer**: DPO / Legal

## Executive Summary

The avatar-web platform processes personal data to provide a virtual avatar management service with an AI-powered desktop pet. This PIA identifies data flows, compliance obligations, and risk mitigations under GDPR, CCPA, and PIPL frameworks.

---

## 1. Data Inventory

### 1.1 Personal Data Collected

| Category | Data Elements | Classification | Basis (GDPR) |
|----------|--------------|---------------|---------------|
| Account | email, username, password (bcrypt) | L2 — PII | Contractual necessity |
| Profile | bio, avatar_url, preferences | L1 — Low risk | Legitimate interest |
| Auth | OAuth provider IDs, SSO tokens, 2FA TOTP seed | L3 — Sensitive | Consent / contractual |
| Pet Config | pet_name, personality, backstory (user-authored) | L1 — Low risk | Consent |
| Session | interaction_count, crash_log (Unity desktop) | L1 — Low risk | Legitimate interest |
| Audit | action, resource_type, old_values, new_values, IP address | L2 — PII | Legal obligation |
| Login History | IP, user_agent, login_timestamp | L2 — PII | Legitimate interest |
| CSP Reports | blocked_uri, source_file, user_agent | L0 — Anonymous | Legitimate interest |
| Cookies | refresh_token (httpOnly, Secure, SameSite=Strict) | L3 — Sensitive | Consent |

### 1.2 Data Not Collected
- No government ID / passport numbers
- No payment card data (PCI-DSS not in scope)
- No biometric data (facial recognition, fingerprints)
- No precise geolocation (only IP-based coarse location for audit)

---

## 2. Data Flow Diagram

```
User Browser ──HTTPS──▶ nginx Ingress ──▶ Next.js Server
                             │                    │
                             │              ┌─────┴──────┐
                             │              │  Prisma ORM  │
                             │              └─────┬──────┘
                             │                    │
                        WAF logs            PostgreSQL 16
                     (anonymized)           (encrypted at rest)
                             │                    │
                             ▼                    ▼
                      Loki/Promtail         S3/MinIO backups
                      (retention: 30d)      (AES-256-SSE, 30d)
                             │
                             ▼
                        Grafana dashboards
                        (no raw PII displayed)
```

### External Service Transfers

| Service | Data Shared | Safeguard | DPA Signed |
|---------|------------|-----------|------------|
| Azure Speech (opt-in) | TTS audio fragments | Customer-managed key, TLS 1.3 | Yes |
| OpenAI (opt-in) | Chat prompts (user-authored) | API key encrypted, TLS 1.3 | Yes |
| Upstash Redis | Rate-limit counters (anonymous) | TLS, no PII stored | Yes |
| Sentry | Error stack traces + requestId | PII scrubbing enabled | Yes |
| OTLP Collector | Trace spans (no request body) | Internal cluster only | N/A |

---

## 3. User Rights Implementation

### GDPR Articles 15-22

| Right | Implementation | SLA |
|-------|---------------|-----|
| Art.15 Access | `GET /api/settings/profile` + `GET /api/settings/login-history` | Real-time |
| Art.16 Rectification | `PUT /api/settings/profile` | Real-time |
| Art.17 Erasure | Admin: `DELETE /api/admin/users/{id}` (cascades to avatars, sessions, pet configs, audit logs) | 30 days |
| Art.18 Restriction | Admin: `PUT /api/admin/users/{id}` → `status: suspended` | Immediate |
| Art.20 Portability | `GET /api/pet/export` — full data export in JSON | Real-time |
| Art.21 Objection | Delete pet config, disable session logging | Real-time |
| Art.22 Automated decisions | Not applicable (no profiling/automated decisions) | N/A |

### CCPA

| Right | Implementation |
|------|---------------|
| Right to know | Privacy notice at `/privacy` + data inventory above |
| Right to delete | Same as GDPR Art.17 — cascading deletion |
| Right to opt-out of sale | No data sale; opt-out link in privacy notice |
| Right to non-discrimination | Exercising rights does not affect service quality |

---

## 4. Data Retention Schedule

| Data Type | Retention | Justification | Auto-purge |
|-----------|-----------|---------------|------------|
| User account | Until deletion request | Service provision | Manual |
| Pet config | Until deletion request | Core functionality | Manual |
| Session logs | 90 days | Debugging / usage analytics | retention-cronjob |
| Audit logs | 365 days | Legal compliance (SOC 2, etc.) | retention-cronjob |
| Login history | 180 days | Security monitoring | Manual |
| Refresh tokens | 7 days (rotation) + 30 days (absolute) | Auth session | Token rotation |
| API keys | Until revoked | API access | Manual |
| CSP reports | 30 days | Security monitoring | auto-expire |
| Backups | 30 days (rolling) | Disaster recovery | backup-cronjob |
| WAF logs | 30 days | Security incident response | Loki retention |

---

## 5. Security Controls

| Control | Status | Reference |
|---------|--------|-----------|
| Encryption at rest (DB) | ✅ PostgreSQL TDE | Helm values |
| Encryption at rest (backups) | ✅ S3 SSE (AES-256) | backup-cronjob |
| Encryption in transit | ✅ TLS 1.3 (nginx ingress) | ingress.yaml |
| API key encryption | ✅ AES-256-GCM + scrypt KDF | ADR-008 |
| Password hashing | ✅ bcrypt (cost 12) | auth/login |
| PII masking in logs | ✅ Pino serializers (email→redacted) | logger.ts |
| Secret scanning | ✅ gitleaks CI | CI workflow |
| Container vuln scanning | ✅ Trivy (CRITICAL/HIGH blocked) | CI workflow |
| SBOM | ✅ SPDX JSON per build | CI workflow (syft) |
| Access control | ✅ RBAC + JWT (RS256) | auth/middleware |
| Rate limiting | ✅ Upstash + fail-open fallback | rate-limit/ |
| WAF | ✅ ModSecurity + OWASP CRS | waf-rules.conf |

---

## 6. Data Protection Impact Assessment (DPIA) — Pet AI Services

**Processing**: User-provided Azure Speech / OpenAI API keys enable TTS and LLM features.

**Risk**: If API keys are compromised, attacker could incur costs or access conversation logs on the user's external AI account.

**Mitigations**:
1. API keys encrypted with AES-256-GCM (key derived via scrypt from `PET_ENCRYPTION_KEY`)
2. Keys only decrypted in-memory during API calls — never persisted to disk or logs
3. Circuit breaker prevents cascading failures that could expose keys in error messages
4. User must explicitly opt-in by providing keys (not mandatory for basic pet functionality)
5. Frontend displays masked keys (`••••••••`) — full key never returned to browser

**Residual risk**: Low. Compromise requires both database access AND `PET_ENCRYPTION_KEY`.

---

## 7. Cross-Border Data Transfer

| Data | Storage Region | Backup Region | Adequacy Decision |
|------|---------------|---------------|-------------------|
| All user data | us-east-1 (primary) | us-west-2 (DR) | GDPR Art.45 adequacy |

**Transfer mechanism**: Data stays within US regions. For EU/China deployments, provision separate clusters in eu-west-1 / cn-north-1 with isolated databases.

---

## 8. Breach Notification Procedure

1. **Detection**: Security alert (WAF, gitleaks, audit log anomaly) → Security on-call
2. **Containment** (within 1h): Rotate affected keys, scale to known-good revision
3. **Assessment** (within 24h): Determine scope, data types affected, number of users
4. **Notification** (within 72h GDPR): Notify supervisory authority + affected users
5. **Remediation**: Patch root cause, update ADR, schedule pen-test for affected area
6. **Post-mortem**: Document in `docs/operations/incidents/` within 5 business days

### Breach Test Scenarios
- [ ] API key exposure in logs — verify Pino serializers mask keys
- [ ] Database dump leak — verify encryption keys not in same bucket
- [ ] Session hijacking — verify token rotation invalidates old tokens

---

## 9. Compliance Checklist

| Framework | Status | Evidence |
|-----------|--------|----------|
| GDPR Art.5 (Principles) | ✅ | Data minimization, purpose limitation |
| GDPR Art.25 (Data protection by design) | ✅ | Encryption by default, PII masking |
| GDPR Art.30 (Records of processing) | ✅ | This PIA + data inventory above |
| GDPR Art.32 (Security of processing) | ✅ | TLS 1.3, AES-256, bcrypt, RBAC |
| GDPR Art.35 (DPIA) | ✅ | Section 6 above |
| CCPA §1798.100 (Right to know) | ✅ | Privacy notice + data inventory |
| CCPA §1798.105 (Right to delete) | ✅ | Cascading user deletion |
| CCPA §1798.110 (Data collection disclosure) | ✅ | Section 1 above |
| PIPL Art.13 (Individual rights) | ✅ | User dashboard for data access/export |

---

## 10. Annual Review

**Next review**: 2027-05-27  
**Trigger events for earlier review**:
- New data processor onboarded
- New data category collected
- Data breach incident
- Regulatory change (GDPR amendment, new adequacy decision)
- Merger or acquisition
