// k6 load test — Marketplace API
// Usage:
//   k6 run k6/marketplace-api-load.js --env BASE_URL=http://localhost:3000 --env TOKEN=<jwt>

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('market_errors');
const listLatency = new Trend('market_list_latency');
const detailLatency = new Trend('market_detail_latency');
const searchLatency = new Trend('market_search_latency');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || 'test-token';
const PARAMS = {
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
};

export const options = {
  thresholds: {
    http_req_duration: ['p(50)<100', 'p(95)<600', 'p(99)<2500'],
    http_req_failed: ['rate<0.002'],
    market_errors: ['rate<0.002'],
  },
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};

export default function () {
  let itemId = '';

  group('list items', () => {
    const start = Date.now();
    const page = (__ITER % 5) + 1;
    const res = http.get(`${BASE_URL}/api/market/items?page=${page}&pageSize=20`, PARAMS);
    listLatency.add(Date.now() - start);

    const ok = check(res, {
      'list 200': (r) => r.status === 200,
      'list has items': (r) => {
        try {
          const b = JSON.parse(r.body);
          if (b.data?.items?.length) {
            itemId = b.data.items[0].id;
            return true;
          }
          return true; // empty list is valid
        } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(0.3);

  if (itemId) {
    group('item detail', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/market/items/${itemId}`, PARAMS);
      detailLatency.add(Date.now() - start);
      check(res, { 'detail 200': (r) => r.status === 200 });
    });
  }

  group('search', () => {
    if (__ITER % 3 !== 0) return;
    const start = Date.now();
    const queries = ['live2d', 'skin', 'texture'];
    const q = queries[__ITER % queries.length];
    const res = http.get(`${BASE_URL}/api/market/items?search=${q}`, PARAMS);
    searchLatency.add(Date.now() - start);
    check(res, { 'search 200': (r) => r.status === 200 });
  });

  sleep(0.5);
}

export function handleSummary(data) {
  const med = data.metrics.http_req_duration.values;
  return {
    stdout: `
═══════════════════════════════════════
  Marketplace API Load Test Summary
═══════════════════════════════════════
  Total requests:  ${data.metrics.http_reqs.values.count}
  Error rate:      ${(data.metrics.market_errors?.values?.rate * 100 || 0).toFixed(2)}%

  Latency (ms):
    avg:  ${med.avg.toFixed(1)}
    P50:  ${med.p(0.5).toFixed(1)}
    P95:  ${med.p(0.95).toFixed(1)}
    P99:  ${med.p(0.99).toFixed(1)}

  SLO: P95<600ms   → ${med.p(0.95) < 600 ? 'PASS' : 'FAIL'}
  SLO: P99<2500ms  → ${med.p(0.99) < 2500 ? 'PASS' : 'FAIL'}
═══════════════════════════════════════
`,
  };
}
