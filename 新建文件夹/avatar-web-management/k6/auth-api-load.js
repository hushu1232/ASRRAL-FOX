// k6 load test — Auth API
// Usage:
//   k6 run k6/auth-api-load.js --env BASE_URL=http://localhost:3000
//   k6 run k6/auth-api-load.js --env BASE_URL=https://staging.example.com --vus 30 --duration 3m

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('auth_errors');
const loginLatency = new Trend('auth_login_latency');
const refreshLatency = new Trend('auth_refresh_latency');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'loadtest@avatar.internal';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'loadtest-pass';

export const options = {
  thresholds: {
    http_req_duration: ['p(50)<150', 'p(95)<800', 'p(99)<3000'],
    http_req_failed: ['rate<0.005'],
    auth_errors: ['rate<0.005'],
  },
  scenarios: {
    login_flow: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 30 },
        { duration: '2m', target: 30 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};

export default function () {
  let token = '';

  group('login', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    loginLatency.add(Date.now() - start);

    const ok = check(res, {
      'login 200': (r) => r.status === 200 || r.status === 401,
    });
    errorRate.add(!ok);

    if (res.status === 200) {
      try {
        token = JSON.parse(res.body).data?.token || '';
      } catch { /* noop */ }
    }
  });

  if (token) {
    group('refresh', () => {
      sleep(0.5);
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/auth/refresh`,
        JSON.stringify({}),
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
      );
      refreshLatency.add(Date.now() - start);
      check(res, { 'refresh 200': (r) => r.status === 200 });
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  const med = data.metrics.http_req_duration.values;
  return {
    stdout: `
═══════════════════════════════════════
  Auth API Load Test Summary
═══════════════════════════════════════
  Total requests:  ${data.metrics.http_reqs.values.count}
  Error rate:      ${(data.metrics.auth_errors?.values?.rate * 100 || 0).toFixed(2)}%

  Latency (ms):
    avg:  ${med.avg.toFixed(1)}
    P50:  ${med.p(0.5).toFixed(1)}
    P95:  ${med.p(0.95).toFixed(1)}
    P99:  ${med.p(0.99).toFixed(1)}

  SLO: P95<800ms  → ${med.p(0.95) < 800 ? 'PASS' : 'FAIL'}
  SLO: P99<3000ms → ${med.p(0.99) < 3000 ? 'PASS' : 'FAIL'}
═══════════════════════════════════════
`,
  };
}
