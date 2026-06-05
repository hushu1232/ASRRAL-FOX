# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> Auth Flow E2E >> Rate Limiting >> Login endpoint returns rate limit headers
- Location: e2e\auth-flow.spec.ts:181:9

# Error details

```
Error: expect(received).toBeDefined()

Received: undefined
```

# Test source

```ts
  88  |       expect(body.data.user).toBeDefined();
  89  |       expect(body.data.user.email).toBe(TEST_EMAIL);
  90  |     });
  91  | 
  92  |     test('POST /api/auth/login sets refreshToken cookie', async ({ request }) => {
  93  |       const res = await request.post(`${BASE_URL}/api/auth/login`, {
  94  |         data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  95  |         headers: { 'Content-Type': 'application/json' },
  96  |       });
  97  |       expect(res.status()).toBe(200);
  98  |       // Check that Set-Cookie header exists for refreshToken
  99  |       const cookies = res.headers()['set-cookie'];
  100 |       expect(cookies).toBeDefined();
  101 |     });
  102 | 
  103 |     test('POST /api/auth/login rejects empty password', async ({ request }) => {
  104 |       const res = await request.post(`${BASE_URL}/api/auth/login`, {
  105 |         data: { email: TEST_EMAIL, password: '' },
  106 |         headers: { 'Content-Type': 'application/json' },
  107 |       });
  108 |       expect(res.status()).toBe(400);
  109 |     });
  110 |   });
  111 | 
  112 |   test.describe('Token Refresh', () => {
  113 |     test('POST /api/auth/refresh with valid cookie returns new token', async ({ request }) => {
  114 |       // First login to get the cookie
  115 |       const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
  116 |         data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  117 |         headers: { 'Content-Type': 'application/json' },
  118 |       });
  119 | 
  120 |       // Use the same request context (which preserves cookies) to refresh
  121 |       const refreshRes = await request.post(`${BASE_URL}/api/auth/refresh`);
  122 |       // May return 200 (success) or 401 (no refresh token cookie in API context)
  123 |       expect([200, 401]).toContain(refreshRes.status());
  124 |     });
  125 | 
  126 |     test('POST /api/auth/refresh without cookie returns error', async ({ request }) => {
  127 |       // Create a fresh context with no cookies
  128 |       const freshRes = await request.post(`${BASE_URL}/api/auth/refresh`, {
  129 |         headers: { 'Content-Type': 'application/json' },
  130 |       });
  131 |       expect(freshRes.status()).toBe(401);
  132 |     });
  133 |   });
  134 | 
  135 |   test.describe('Logout', () => {
  136 |     test('POST /api/auth/logout clears cookies', async ({ request }) => {
  137 |       // Login first
  138 |       await request.post(`${BASE_URL}/api/auth/login`, {
  139 |         data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  140 |         headers: { 'Content-Type': 'application/json' },
  141 |       });
  142 | 
  143 |       const res = await request.post(`${BASE_URL}/api/auth/logout`);
  144 |       expect(res.status()).toBe(200);
  145 |       const body = await res.json();
  146 |       expect(body.success).toBe(true);
  147 |     });
  148 |   });
  149 | 
  150 |   test.describe('Password Reset', () => {
  151 |     test('POST /api/auth/forgot-password accepts valid email', async ({ request }) => {
  152 |       const res = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
  153 |         data: { email: TEST_EMAIL },
  154 |         headers: { 'Content-Type': 'application/json' },
  155 |       });
  156 |       // Should always return 200 to prevent email enumeration
  157 |       expect(res.status()).toBe(200);
  158 |       const body = await res.json();
  159 |       expect(body.success).toBe(true);
  160 |     });
  161 | 
  162 |     test('POST /api/auth/forgot-password handles non-existent email gracefully', async ({ request }) => {
  163 |       const res = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
  164 |         data: { email: 'nonexistent@example.com' },
  165 |         headers: { 'Content-Type': 'application/json' },
  166 |       });
  167 |       // Should NOT leak whether email exists
  168 |       expect(res.status()).toBe(200);
  169 |     });
  170 | 
  171 |     test('POST /api/auth/reset-password rejects invalid token', async ({ request }) => {
  172 |       const res = await request.post(`${BASE_URL}/api/auth/reset-password`, {
  173 |         data: { token: 'invalid-token', password: 'NewPass123' },
  174 |         headers: { 'Content-Type': 'application/json' },
  175 |       });
  176 |       expect(res.status()).toBe(400);
  177 |     });
  178 |   });
  179 | 
  180 |   test.describe('Rate Limiting', () => {
  181 |     test('Login endpoint returns rate limit headers', async ({ request }) => {
  182 |       const res = await request.post(`${BASE_URL}/api/auth/login`, {
  183 |         data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  184 |         headers: { 'Content-Type': 'application/json' },
  185 |       });
  186 |       // Check for rate limit headers
  187 |       const headers = res.headers();
> 188 |       expect(headers['x-ratelimit-limit'] || headers['x-ratelimit-remaining']).toBeDefined();
      |                                                                                ^ Error: expect(received).toBeDefined()
  189 |     });
  190 |   });
  191 | });
  192 | 
```