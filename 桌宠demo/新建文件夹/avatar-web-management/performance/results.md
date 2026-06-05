# Performance Test Results
> Run at: 2026-05-24T13:33:05.743Z
> Concurrency: 50, Duration: 30s each

| Endpoint | RPS | Avg(ms) | P95(ms) | P99(ms) | Error% | Status |
|----------|-----|---------|---------|---------|--------|--------|
| Health Check | 298 | 101 | 162 | 248 | 0.00% | ✅ |
| Avatar List (GET /api/avatars) | 274 | 109 | 174 | 209 | 0.00% | ✅ |
| Notifications Unread Count | 230 | 126 | 206 | 237 | 0.00% | ✅ |
| Search | 199 | 150 | 257 | 409 | 0.00% | ✅ |
| Dashboard Stats | 240 | 125 | 201 | 254 | 0.00% | ✅ |

**Login concurrency (10 users):** Avg 271ms

**Overall:** ✅ ALL PASSED

## Notes
- P95 target: < 500ms
- Error rate target: < 1%
- Test run on local machine — results may vary in production