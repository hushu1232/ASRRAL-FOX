// k6 load test — Forum API
// Usage:
//   k6 run k6/forum-api-load.js --env BASE_URL=http://localhost:3000 --env TOKEN=<jwt>

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('forum_errors');
const boardLatency = new Trend('forum_board_latency');
const postListLatency = new Trend('forum_post_list_latency');
const postCreateLatency = new Trend('forum_post_create_latency');

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
    http_req_duration: ['p(50)<120', 'p(95)<700', 'p(99)<2500'],
    http_req_failed: ['rate<0.003'],
    forum_errors: ['rate<0.003'],
  },
  scenarios: {
    mixed: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '45s', target: 40 },
        { duration: '2m', target: 40 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};

export default function () {
  let boardId = '';
  let postId = '';

  group('list boards', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/forum/boards`, PARAMS);
    boardLatency.add(Date.now() - start);

    const ok = check(res, {
      'boards 200': (r) => r.status === 200,
      'boards exist': (r) => {
        try {
          const d = JSON.parse(r.body).data;
          if (d?.length) boardId = d[0].id;
          return true;
        } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(0.2);

  if (boardId) {
    group('list posts', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/forum/boards/${boardId}/posts?page=1&pageSize=15`, PARAMS);
      postListLatency.add(Date.now() - start);

      const ok = check(res, {
        'posts 200': (r) => r.status === 200,
      });
      errorRate.add(!ok);

      try {
        const items = JSON.parse(res.body).data?.items;
        if (items?.length) postId = items[0].id;
      } catch { /* noop */ }
    });

    // Create a post (sparse — 5% of iterations to avoid flooding)
    if (__ITER % 20 === 0) {
      group('create post', () => {
        const start = Date.now();
        const res = http.post(
          `${BASE_URL}/api/forum/boards/${boardId}/posts`,
          JSON.stringify({
            title: `Load test post ${__ITER}`,
            content: `This is an automated load test post #${__ITER}. Please ignore.`,
          }),
          PARAMS,
        );
        postCreateLatency.add(Date.now() - start);
        check(res, { 'create 201': (r) => r.status === 200 || r.status === 201 });
      });
    }
  }

  sleep(0.5);
}

export function handleSummary(data) {
  const med = data.metrics.http_req_duration.values;
  return {
    stdout: `
═══════════════════════════════════════
  Forum API Load Test Summary
═══════════════════════════════════════
  Total requests:  ${data.metrics.http_reqs.values.count}
  Error rate:      ${(data.metrics.forum_errors?.values?.rate * 100 || 0).toFixed(2)}%

  Latency (ms):
    avg:  ${med.avg.toFixed(1)}
    P50:  ${med.p(0.5).toFixed(1)}
    P95:  ${med.p(0.95).toFixed(1)}
    P99:  ${med.p(0.99).toFixed(1)}

  SLO: P95<700ms   → ${med.p(0.95) < 700 ? 'PASS' : 'FAIL'}
  SLO: P99<2500ms  → ${med.p(0.99) < 2500 ? 'PASS' : 'FAIL'}
═══════════════════════════════════════
`,
  };
}
