# Security Policy

## Reporting a Vulnerability

**Do not file a public issue.** Instead, email:

**security@avatar-web.internal**

Expect an initial acknowledgement within 24 hours and a status update within 72 hours.

### What to include
- Description of the vulnerability and potential impact
- Steps to reproduce or proof-of-concept (if available)
- Affected versions / commit range
- Any suggested mitigations

### PGP Key (optional)
```
-----BEGIN PGP PUBLIC KEY BLOCK-----
(placeholder — replace with actual team PGP key)
-----END PGP PUBLIC KEY BLOCK-----
```

## Response SLA

| Severity | Initial Response | Fix Released | Example |
|----------|-----------------|--------------|---------|
| Critical | 4 hours | 24 hours | Unauthenticated RCE, SQLi bypassing auth |
| High | 24 hours | 7 days | Auth bypass, sensitive data exposure |
| Medium | 72 hours | 30 days | CSRF on non-critical endpoints |
| Low | 1 week | Next release | Information disclosure, missing security headers |

## Scope

- **In scope**: `src/` application code, API endpoints, auth middleware, database queries, WebSocket server, Helm chart configurations
- **Out of scope**: Third-party dependencies (report to their respective trackers), demo/example data, documentation typos

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (main branch) | ✅ |
| < 1.0.0 | ❌ |

## Automated Penetration Testing (Shannon)

This project uses [Shannon](https://github.com/KeygraphHQ/shannon), an autonomous AI white-box pentester, for pre-release security validation.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running
- [Anthropic API key](https://console.anthropic.com/) (scan costs ~$50 in API fees)
- Target app running (`npm run dev` or staging deployment)
- Dedicated pentest test account in the database

### Quick Start

```powershell
# One-time setup (configure API key)
npx @keygraph/shannon setup

# Run full pentest (1-1.5 hours)
.\security\shannon\run.ps1

# Fast pipeline test (~20 min, fewer exploits)
.\security\shannon\run.ps1 -Quick

# Monitor live progress
# Open http://localhost:8233 in browser
```

### What Shannon Tests

| Agent | OWASP Coverage | Examples |
|-------|---------------|----------|
| Injection | SQLi, NoSQLi, Command Injection, LDAP | Prisma raw queries, Redis command injection |
| XSS | Reflected, Stored, DOM-based, mXSS | API response rendering, WebSocket messages |
| SSRF | Server-Side Request Forgery | Image proxy, webhook callbacks, OAuth redirect_uri |
| Authentication | Broken Auth, JWT Attacks, Session Fixation | `none` algorithm, KID injection, expired tokens |
| Authorization | IDOR, Privilege Escalation | Admin endpoints from user context, role boundary tests |

### When to Run

- Before every major release (v0.x → v0.y)
- After significant auth/Authz changes
- After adding new API endpoints
- Monthly scheduled scan against staging

### Interpreting Results

Shannon follows a "no exploit, no report" philosophy — only vulnerabilities with a working PoC appear in the final report. Treat every finding as validated.

**Response time**: Critical findings from Shannon scans follow the same SLA as externally reported vulnerabilities (4h initial response).

### Configuration

See `security/shannon/config.yaml` for full scan configuration:
- Target URL and source code scope
- Auth credentials and OAuth endpoint mapping
- Vulnerability class enable/disable
- Rate limiting and custom headers
- Output format (JSON, HTML, PDF with PoCs)

- All API keys encrypted at rest (AES-256-GCM, scrypt KDF) — see ADR-008
- Passwords hashed with bcrypt (cost 12)
- JWT signed with RS256 (RSA 2048-bit)
- WAF enabled in production (ModSecurity + OWASP CRS)
- Container images scanned with Trivy (CRITICAL/HIGH blocked)
- Secrets scanned with gitleaks in CI
- SBOM generated per build (SPDX JSON)
- Rate limiting with fail-open fallback

## Hall of Fame

We maintain a private acknowledgement list. Reporters will be credited (with permission) in release notes.

## Process

1. **Triage**: Security team assesses severity within 24h
2. **Fix**: Patch developed in a private fork
3. **Review**: Independent reviewer verifies the fix
4. **Release**: Patch released; advisory published within 72h of fix
5. **Post-mortem**: Root cause analysis within 5 business days
