# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> Auth Flow E2E >> Registration >> POST /api/auth/register rejects duplicate email
- Location: e2e\auth-flow.spec.ts:39:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 409
Received: 201
```

# Test source

```ts
  1   | import { test, expect, type APIRequestContext } from '@playwright/test';
  2   | 
  3   | const BASE_URL = 'http://localhost:3000';
  4   | const TEST_EMAIL = 'demo@example.com';
  5   | const TEST_PASSWORD = 'demo1234';
  6   | 
  7   | async function getAuthToken(request: APIRequestContext) {
  8   |   const res = await request.post(`${BASE_URL}/api/auth/login`, {
  9   |     data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  10  |     headers: { 'Content-Type': 'application/json' },
  11  |   });
  12  |   const body = await res.json();
  13  |   if (!body.success) throw new Error(`Login failed: ${body.error}`);
  14  |   return body.data?.accessToken || '';
  15  | }
  16  | 
  17  | test.describe('Auth Flow E2E', () => {
  18  | 
  19  |   test.describe('Registration', () => {
  20  |     const uniqueEmail = `e2e-test-${Date.now()}@example.com`;
  21  | 
  22  |     test('POST /api/auth/register creates new user', async ({ request }) => {
  23  |       const res = await request.post(`${BASE_URL}/api/auth/register`, {
  24  |         data: {
  25  |           email: uniqueEmail,
  26  |           username: `e2euser_${Date.now()}`,
  27  |           password: 'TestPass123',
  28  |         },
  29  |         headers: { 'Content-Type': 'application/json' },
  30  |       });
  31  |       expect(res.status()).toBe(201);
  32  |       const body = await res.json();
  33  |       expect(body.success).toBe(true);
  34  |       expect(body.data.id).toBeDefined();
  35  |       expect(body.data.email).toBe(uniqueEmail);
  36  |       expect(body.data.role).toBe('user');
  37  |     });
  38  | 
  39  |     test('POST /api/auth/register rejects duplicate email', async ({ request }) => {
  40  |       const res = await request.post(`${BASE_URL}/api/auth/register`, {
  41  |         data: { email: uniqueEmail, username: 'another_user', password: 'TestPass123' },
  42  |         headers: { 'Content-Type': 'application/json' },
  43  |       });
> 44  |       expect(res.status()).toBe(409);
      |                            ^ Error: expect(received).toBe(expected) // Object.is equality
  45  |       const body = await res.json();
  46  |       expect(body.success).toBe(false);
  47  |     });
  48  | 
  49  |     test('POST /api/auth/register rejects weak password', async ({ request }) => {
  50  |       const res = await request.post(`${BASE_URL}/api/auth/register`, {
  51  |         data: { email: 'weakpw@example.com', username: 'weakpw', password: '123' },
  52  |         headers: { 'Content-Type': 'application/json' },
  53  |       });
  54  |       expect(res.status()).toBe(400);
  55  |     });
  56  | 
  57  |     test('POST /api/auth/register rejects invalid email', async ({ request }) => {
  58  |       const res = await request.post(`${BASE_URL}/api/auth/register`, {
  59  |         data: { email: 'not-an-email', username: 'badmail', password: 'TestPass123' },
  60  |         headers: { 'Content-Type': 'application/json' },
  61  |       });
  62  |       expect(res.status()).toBe(400);
  63  |     });
  64  | 
  65  |     test('POST /api/auth/register rejects XSS username', async ({ request }) => {
  66  |       const res = await request.post(`${BASE_URL}/api/auth/register`, {
  67  |         data: {
  68  |           email: 'xss@example.com',
  69  |           username: '<script>alert(1)</script>',
  70  |           password: 'TestPass123',
  71  |         },
  72  |         headers: { 'Content-Type': 'application/json' },
  73  |       });
  74  |       expect(res.status()).toBe(400);
  75  |     });
  76  |   });
  77  | 
  78  |   test.describe('Login', () => {
  79  |     test('POST /api/auth/login returns accessToken', async ({ request }) => {
  80  |       const res = await request.post(`${BASE_URL}/api/auth/login`, {
  81  |         data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  82  |         headers: { 'Content-Type': 'application/json' },
  83  |       });
  84  |       expect(res.status()).toBe(200);
  85  |       const body = await res.json();
  86  |       expect(body.success).toBe(true);
  87  |       expect(body.data.accessToken).toBeDefined();
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
```