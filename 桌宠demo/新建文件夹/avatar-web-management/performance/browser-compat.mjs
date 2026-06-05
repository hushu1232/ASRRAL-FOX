import http from 'http';

const BASE = 'http://localhost:3000';

// Browser User-Agent strings
const BROWSERS = {
  chromium: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

function apiGet(path, ua, token = '') {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const headers = { 'User-Agent': ua };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    http.request(url, { method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body), ua: ua.substring(0, 50) });
        } catch {
          resolve({ status: res.statusCode, body: { raw: body.substring(0, 100) }, ua: ua.substring(0, 50) });
        }
      });
    }).on('error', (err) => resolve({ status: 0, error: err.message })).end();
  });
}

async function main() {
  console.log('Cross-Browser API Compatibility Test');
  console.log('====================================\n');

  // Login once to get a token (use any UA since it doesn't matter for JWT)
  const loginToken = await new Promise((resolve) => {
    const data = JSON.stringify({ email: 'demo@example.com', password: 'demo1234' });
    const url = new URL('/api/auth/login', BASE);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'User-Agent': BROWSERS.chromium },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const json = JSON.parse(body);
        resolve(json.data?.accessToken || '');
      });
    });
    req.write(data);
    req.end();
  });

  if (!loginToken) {
    console.error('Could not obtain auth token');
    process.exit(1);
  }

  const endpoints = [
    { path: '/api/health', auth: false },
    { path: '/api/avatars?page=1&pageSize=3', auth: true },
    { path: '/api/assets?page=1&pageSize=3', auth: true },
    { path: '/api/notifications/unread-count', auth: true },
    { path: '/api/search?q=test', auth: true },
    { path: '/api/dashboard/stats', auth: true },
    { path: '/api/templates?page=1&pageSize=3', auth: true },
  ];

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const endpoint of endpoints) {
    for (const [browser, ua] of Object.entries(BROWSERS)) {
      const res = await apiGet(endpoint.path, ua, endpoint.auth ? loginToken : '');
      const ok = endpoint.path === '/api/health'
        ? (res.status === 200 && res.body?.status === 'healthy')
        : (res.status === 200 && res.body?.success === true);
      if (ok) {
        passed++;
      } else {
        failed++;
        failures.push({ browser, endpoint: endpoint.path, status: res.status, error: res.body?.error || 'Unknown' });
      }
    }
  }

  console.log(`Results: ${passed} passed, ${failed} failed (${(passed / (passed + failed) * 100).toFixed(1)}%)\n`);

  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(f => console.log(`  ❌ ${f.browser.padEnd(10)} ${f.endpoint.padEnd(40)} status=${f.status} error="${f.error}"`));
  }

  console.log('\nBrowser User-Agent Summary:');
  for (const [browser, ua] of Object.entries(BROWSERS)) {
    const browserResults = failures.filter(f => f.browser === browser);
    const browserTotal = endpoints.length;
    console.log(`  ${browser.padEnd(10)}: ${browserTotal - browserResults.length}/${browserTotal} endpoints OK`);
  }

  console.log(`\nTest completed at: ${new Date().toISOString()}`);

  // Write report
  const fs = await import('fs');
  const report = [];
  report.push('# Cross-Browser API Compatibility Report');
  report.push(`> Run at: ${new Date().toISOString()}`);
  report.push('');
  report.push(`**Overall: ${passed}/${passed + failed} passed (${(passed / (passed + failed) * 100).toFixed(1)}%)**`);
  report.push('');
  report.push('| Browser | Endpoints Tested | Passed |');
  report.push('|---------|-----------------|--------|');
  for (const [browser] of Object.entries(BROWSERS)) {
    const browserResults = failures.filter(f => f.browser === browser);
    const browserTotal = endpoints.length;
    report.push(`| ${browser} | ${browserTotal} | ${browserTotal - browserResults.length}/${browserTotal} |`);
  }
  report.push('');
  if (failures.length > 0) {
    report.push('## Failures');
    report.push('');
    failures.forEach(f => report.push(`- ❌ **${f.browser}** — \`${f.endpoint}\`: status=${f.status}, error="${f.error}"`));
  } else {
    report.push('## All tests passed');
  }
  report.push('\n## Notes');
  report.push('- The API is User-Agent agnostic (no browser-specific logic)');
  report.push('- Full browser rendering tests require Playwright (see e2e/ directory)');

  fs.writeFileSync('performance/browser-compat-results.md', report.join('\n'));
  console.log('Report saved to performance/browser-compat-results.md');
}

main().catch(err => { console.error(err); process.exit(1); });
