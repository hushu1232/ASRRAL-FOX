# PII & Data Classification

## Classification Levels

| Level | Label | Definition | Examples |
|-------|-------|------------|----------|
| **L0** | Public | Safe to publish anywhere | App name, feature descriptions, public avatars |
| **L1** | Internal | Non-sensitive operational data | Workspace names, asset filenames, animation settings |
| **L2** | Confidential | Business-sensitive, limited access | Email addresses, IP addresses, user agent strings |
| **L3** | Restricted | Personally identifiable, regulated | Passwords (hashed), API keys (encrypted), TOTP secrets, OAuth tokens |
| **L4** | Critical | Can't be stored — must not exist in DB | Raw passwords, unencrypted API keys, private keys |

## Database Column Classification

### `users` table

| Column | Level | Rationale |
|--------|-------|-----------|
| `id` | L1 | Internal UUID — not PII |
| `email` | L2 | **PII** — personal email, GDPR Article 4(1) |
| `username` | L2 | **PII** if real name used |
| `password_hash` | L3 | Argon2 hash — irreversible, but sensitive |
| `totp_secret` | L3 | TOTP seed — enables account takeover if leaked |
| `sso_subject` | L2 | External identity provider subject — correlatable |
| `last_login_at` | L2 | Behavioral metadata — can reveal activity patterns |
| `role` | L1 | Application-level role |
| `status` | L1 | Account status |
| `workspace_id` | L1 | Internal reference |

### `refresh_tokens` table

| Column | Level | Rationale |
|--------|-------|-----------|
| `token_hash` | L3 | Can be used to derive session validity |
| All others | L1 | Internal references and timestamps |

### `pet_configs` table

| Column | Level | Rationale |
|--------|-------|-----------|
| `pet_name` | L1 | User-given pet name |
| `personality` | L1 | User-authored text |
| `backstory` | L1 | User-authored text |
| All others | L1 | Configuration values |

### `pet_session_logs` table

| Column | Level | Rationale |
|--------|-------|-----------|
| `crash_log` | L2 | May contain file paths or screen content — needs review |
| `interaction_count` | L1 | Aggregate number |
| `start_time`, `end_time` | L2 | Session timing — behavioral pattern |

### `audit_logs` table

| Column | Level | Rationale |
|--------|-------|-----------|
| `ip_address` | L2 | **PII** — GDPR Article 4(1), network identifier |
| `user_agent` | L2 | Browser fingerprint — correlatable |
| `action`, `resource_type` | L1 | Operational metadata |

### `api_keys` table

| Column | Level | Rationale |
|--------|-------|-----------|
| `key_hash` | L3 | Hashed API key — enables impersonation if cracked |
| `key_prefix` | L1 | First 6 chars for display only |

### `oauth_clients` table

| Column | Level | Rationale |
|--------|-------|-----------|
| `client_secret` | L3 | OAuth client secret — enables impersonation |
| `redirect_uris` | L1 | Public configuration |

## Data Flow Summary

```
User Browser
  │  email, password (L3) → POST /api/auth/login → argon2 hash compare → JWT issued
  │  API keys (L3) → PUT /api/pet/config → AES-256-GCM encrypt → stored in pet_configs
  │  crash_log (L2) → POST /api/pet/session → stored as plaintext in pet_session_logs
  │  IP, UA (L2) → every request → audit_log inserts
  │
Alife Desktop Runtime
  │  session start/update/end (L1-L2) → POST /api/pet/session
  │  GET /api/pet/export → API keys DECRYPTED for local use (L3 → in-memory only)
  │
External Services
  │  Azure Speech: API key sent in HTTP header (TLS 1.2+ in transit)
  │  OpenAI: API key sent in HTTP header (TLS 1.2+ in transit)
  │  Upstash Redis: rate limit counters only (no PII)
  │  Sentry: error context (may include L2 data — scrubbing configured)
```

## GDPR Compliance Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **Right of access** (Art.15) | ✅ | `GET /api/pet/export` + profile API |
| **Right to rectification** (Art.16) | ✅ | `PUT /api/pet/config`, profile API |
| **Right to erasure** (Art.17) | ⚠️ Partial | No automated cascade delete for pet data when user deleted |
| **Data portability** (Art.20) | ✅ | `GET /api/pet/export` returns structured JSON |
| **Purpose limitation** (Art.5) | ✅ | Session logs documented in ADR-005 |
| **Storage limitation** (Art.5) | ❌ **Gap** | No automated TTL on `pet_session_logs`, `audit_logs` |
| **Integrity & confidentiality** (Art.5) | ✅ | AES-256-GCM for API keys, Argon2 for passwords, TLS in transit |
| **Data breach notification** (Art.33) | ⚠️ Partial | No documented breach response procedure |
| **Data Protection Impact Assessment** (Art.35) | ❌ **Gap** | Not performed for session logging (crash logs) |

## Action Items

1. **P0**: Implement cascade delete — deleting a user must delete `pet_configs`, `pet_session_logs`, `refresh_tokens`, `api_keys`
2. **P1**: Add TTL cron for `pet_session_logs` (>90 days) and `audit_logs` (>1 year)
3. **P1**: Document data breach notification procedure
4. **P2**: DPIA for pet session crash log collection — what data could appear in stack traces?
5. **P2**: Audit log IP anonymization — hash or truncate IPs older than 30 days
