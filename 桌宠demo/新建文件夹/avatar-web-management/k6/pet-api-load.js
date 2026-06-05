// k6 load test — Pet API baseline
// Usage:
//   k6 run k6/pet-api-load.js --env BASE_URL=http://localhost:3000 --env TOKEN=<jwt>
//   k6 run k6/pet-api-load.js --env BASE_URL=https://staging.example.com --env TOKEN=<jwt> --vus 50 --duration 5m
//
// Scenarios:
//   1. Config CRUD (GET/PUT) — 60% of traffic
//   2. Export (GET) — 20% of traffic
//   3. Asset listing (GET) — 15% of traffic
//   4. Session start (POST) — 5% of traffic

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────
const errorRate = new Rate('pet_errors');
const configLatency = new Trend('pet_config_latency');
const exportLatency = new Trend('pet_export_latency');
const assetLatency = new Trend('pet_asset_latency');
const sessionLatency = new Trend('pet_session_latency');

// ── Config ─────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || 'test-token';
const PARAMS = {
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
};

// ── Thresholds (99.9% SLO targets) ─────────────────────────
export const options = {
  thresholds: {
    http_req_duration: ['p(50)<100', 'p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.001'],  // < 0.1% error rate
    pet_errors: ['rate<0.001'],
  },
  scenarios: {
    // Ramp: 1→20 VUs over 1m, hold 20 VUs for 3m, ramp down
    baseline: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 20 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};

// ── Helpers ────────────────────────────────────────────────

function checkSuccess(res, route) {
  const ok = check(res, {
    [`${route} status 200`]: (r) => r.status === 200 || r.status === 201,
    [`${route} success field`]: (r) => {
      try { return JSON.parse(r.body).success === true; } catch { return false; }
    },
  });
  errorRate.add(!ok);
}

// ── Main ───────────────────────────────────────────────────

export default function () {
  // ═══ Config CRUD (60%) ═══════════════════════════════════
  group('pet config', () => {
    // GET config
    const getStart = Date.now();
    const getRes = http.get(`${BASE_URL}/api/pet/config`, PARAMS);
    configLatency.add(Date.now() - getStart);
    checkSuccess(getRes, 'GET /pet/config');
    sleep(1);

    // PUT update (every 5th iteration to avoid excessive writes)
    if (__ITER % 5 === 0) {
      const putStart = Date.now();
      const putRes = http.put(
        `${BASE_URL}/api/pet/config`,
        JSON.stringify({ petName: 'LoadTest', wanderInterval: 15 }),
        PARAMS,
      );
      configLatency.add(Date.now() - putStart);
      checkSuccess(putRes, 'PUT /pet/config');
    }
  });

  // ═══ Export (20%) ═══════════════════════════════════════
  group('pet export', () => {
    if (__ITER % 5 === 1) {
      return; // skip — 20% of iterations
    }
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/pet/export`, PARAMS);
    exportLatency.add(Date.now() - start);
    checkSuccess(res, 'GET /pet/export');
  });

  // ═══ Asset listing (15%) ════════════════════════════════
  group('pet assets', () => {
    if (__ITER % 7 !== 1) {
      return; // skip — ~14% of iterations
    }
    const start = Date.now();
    const types = ['model', 'texture', 'animation'];
    const type = types[__ITER % types.length];
    const res = http.get(`${BASE_URL}/api/pet/assets?type=${type}`, PARAMS);
    assetLatency.add(Date.now() - start);
    checkSuccess(res, `GET /pet/assets?type=${type}`);
  });

  // ═══ Session start (5%) ═════════════════════════════════
  group('pet session', () => {
    if (__ITER % 20 !== 1) {
      return; // skip — 5% of iterations
    }
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/pet/session`,
      JSON.stringify({ action: 'start' }),
      PARAMS,
    );
    sessionLatency.add(Date.now() - start);
    checkSuccess(res, 'POST /pet/session (start)');
  });

  sleep(0.5);
}

// ── Summary ────────────────────────────────────────────────

export function handleSummary(data) {
  const med = data.metrics.http_req_duration.values;
  return {
    'stdout': `
══════════════════════════════════════════════════════
  Pet API Load Test Summary
══════════════════════════════════════════════════════
  Total requests:    ${data.metrics.http_reqs.values.count}
  Failed requests:   ${data.metrics.http_req_failed.values.rate * 100}%
  Error rate:        ${data.metrics.pet_errors?.values?.rate * 100 || 0}%

  Latency (ms):
    avg:  ${med.avg.toFixed(1)}
    P50:  ${med.p(0.5).toFixed(1)}
    P95:  ${med.p(0.95).toFixed(1)}
    P99:  ${med.p(0.99).toFixed(1)}
    max:  ${med.max.toFixed(1)}

  SLO check (P95 < 500ms): ${med.p(0.95) < 500 ? 'PASS' : 'FAIL'}
  SLO check (P99 < 2000ms): ${med.p(0.99) < 2000 ? 'PASS' : 'FAIL'}
  SLO check (error < 0.1%): ${data.metrics.http_req_failed.values.rate < 0.001 ? 'PASS' : 'FAIL'}
══════════════════════════════════════════════════════
`,
  };
}
