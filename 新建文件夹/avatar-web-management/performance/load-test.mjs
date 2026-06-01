import http from 'http';
import https from 'https';

const BASE = 'http://localhost:3000';
const CONCURRENT = 50;
const DURATION_SEC = 30;

let token = '';

async function loginAs(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const url = new URL('/api/auth/login', BASE);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.data?.accessToken || '');
        } catch { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function makeRequest(path, authToken = '') {
  return new Promise((resolve) => {
    const start = Date.now();
    const url = new URL(path, BASE);
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const req = http.request(url, { method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const latency = Date.now() - start;
        resolve({ status: res.statusCode, latency, size: body.length, success: res.statusCode < 400 });
      });
    });
    req.on('error', () => {
      const latency = Date.now() - start;
      resolve({ status: 0, latency, size: 0, success: false });
    });
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ status: 0, latency: Date.now() - start, size: 0, success: false });
    });
    req.end();
  });
}

async function loadTest(name, path, authToken = '') {
  console.log(`\n=== Load Test: ${name} ===`);
  console.log(`  Endpoint: ${path}`);
  console.log(`  Concurrency: ${CONCURRENT}, Duration: ${DURATION_SEC}s`);

  const results = [];
  let rps = 0;
  let errors = 0;
  const startTime = Date.now();

  async function runBatch() {
    const promises = [];
    for (let i = 0; i < CONCURRENT; i++) {
      promises.push(makeRequest(path, authToken));
    }
    const batch = await Promise.all(promises);
    for (const r of batch) {
      results.push(r);
      rps++;
      if (!r.success) errors++;
    }
  }

  while ((Date.now() - startTime) / 1000 < DURATION_SEC) {
    await runBatch();
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const actualRps = Math.round(rps / elapsed);
  const errorRate = ((errors / rps) * 100).toFixed(2);
  const latencies = results.map(r => r.latency).sort((a, b) => a - b);
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];

  console.log(`  Results:`);
  console.log(`    Total requests: ${rps}`);
  console.log(`    RPS: ${actualRps}/s`);
  console.log(`    Errors: ${errors} (${errorRate}%)`);
  console.log(`    Latency (ms): avg=${avg} min=${min} p50=${p50} p95=${p95} p99=${p99} max=${max}`);

  const passed = p95 < 500 && parseFloat(errorRate) < 1;
  console.log(`    Status: ${passed ? 'PASS' : 'FAIL (needs attention)'}`);

  return { name, totalRequests: rps, rps: actualRps, avg, p50, p95, p99, min, max, errorRate, passed };
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Virtual Avatar API - Load Test        ║');
  console.log('╚══════════════════════════════════════════╝');

  // Login to get token
  console.log('\n[Setup] Logging in...');
  token = await loginAs('demo@example.com', 'demo1234');
  if (!token) {
    console.error('Login failed — aborting load test');
    process.exit(1);
  }
  console.log('[Setup] Token obtained');

  const results = [];

  // Test 1: Health (no auth)
  results.push(await loadTest('Health Check', '/api/health'));

  // Test 2: Avatar list (GET, auth)
  results.push(await loadTest('Avatar List (GET /api/avatars)', '/api/avatars?page=1&pageSize=10', token));

  // Test 3: Notifications unread count
  results.push(await loadTest('Notifications Unread Count', '/api/notifications/unread-count', token));

  // Test 4: Search
  results.push(await loadTest('Search', '/api/search?q=test', token));

  // Test 5: Dashboard stats
  results.push(await loadTest('Dashboard Stats', '/api/dashboard/stats', token));

  // Test 6: Login concurrent
  console.log('\n=== Load Test: Login Concurrency ===');
  console.log(`  Endpoint: POST /api/auth/login`);
  console.log(`  Concurrent logins: 10`);
  const loginStart = Date.now();
  const loginPromises = [];
  for (let i = 0; i < 10; i++) {
    loginPromises.push(
      new Promise(async (resolve) => {
        const start = Date.now();
        const data = JSON.stringify({ email: 'demo@example.com', password: 'demo1234' });
        const url = new URL('/api/auth/login', BASE);
        const req = http.request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        }, (res) => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => resolve({ status: res.statusCode, latency: Date.now() - start }));
        });
        req.on('error', () => resolve({ status: 0, latency: Date.now() - start }));
        req.write(data);
        req.end();
      })
    );
  }
  const loginResults = await Promise.all(loginPromises);
  const loginLatencies = loginResults.map(r => r.latency);
  const loginAvg = Math.round(loginLatencies.reduce((a, b) => a + b, 0) / loginLatencies.length);
  console.log(`  Results:`);
  console.log(`    Concurrent logins: 10`);
  console.log(`    Avg login time: ${loginAvg}ms`);
  console.log(`    Success rate: ${loginResults.filter(r => r.status === 200).length}/10`);

  // Summary
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Summary                               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('| Endpoint | RPS | Avg(ms) | P95(ms) | P99(ms) | Error% | Status |');
  console.log('|----------|-----|---------|---------|---------|--------|--------|');
  for (const r of results) {
    if (r) {
      console.log(`| ${r.name.padEnd(30)} | ${String(r.rps).padEnd(4)}| ${String(r.avg).padEnd(8)}| ${String(r.p95).padEnd(8)}| ${String(r.p99).padEnd(8)}| ${String(r.errorRate).padEnd(7)}| ${r.passed ? 'PASS' : 'FAIL'} |`);
    }
  }

  console.log(`\n| Login concurrency (10 users) | Avg: ${loginAvg}ms                          |`);
  console.log('\n---');
  const allPassed = results.every(r => r.passed);
  console.log(`Overall: ${allPassed ? 'ALL PASSED' : 'SOME FAILED — see above for details'}`);
  console.log(`Test completed at: ${new Date().toISOString()}`);

  // Write results to file
  const fs = await import('fs');
  const report = [];
  report.push('# Performance Test Results');
  report.push(`> Run at: ${new Date().toISOString()}`);
  report.push(`> Concurrency: ${CONCURRENT}, Duration: ${DURATION_SEC}s each`);
  report.push('');
  report.push('| Endpoint | RPS | Avg(ms) | P95(ms) | P99(ms) | Error% | Status |');
  report.push('|----------|-----|---------|---------|---------|--------|--------|');
  for (const r of results) {
    report.push(`| ${r.name} | ${r.rps} | ${r.avg} | ${r.p95} | ${r.p99} | ${r.errorRate}% | ${r.passed ? '✅' : '❌'} |`);
  }
  report.push(`\n**Login concurrency (10 users):** Avg ${loginAvg}ms`);
  report.push(`\n**Overall:** ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
  report.push('\n## Notes');
  report.push('- P95 target: < 500ms');
  report.push('- Error rate target: < 1%');
  report.push('- Test run on local machine — results may vary in production');

  fs.writeFileSync('performance/results.md', report.join('\n'));
  console.log('Report saved to performance/results.md');
}

main().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
