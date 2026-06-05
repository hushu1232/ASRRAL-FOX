# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-workflow.spec.ts >> Batch Export E2E >> Export endpoint requires valid avatar id
- Location: e2e\editor-workflow.spec.ts:324:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 500
```

# Test source

```ts
  230 |       // Create a version
  231 |       const versionRes = await request.post(`${BASE_URL}/api/avatars/${testAvatarId}/versions`, {
  232 |         data: {
  233 |           blendshape_snapshot: { eye_size: 0.5 },
  234 |           body_params: { height: 0, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0 },
  235 |           equipped_parts: [],
  236 |           material_overrides: {},
  237 |         },
  238 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  239 |       });
  240 |       const versionBody = await versionRes.json();
  241 |       expect(versionBody.success).toBe(true);
  242 | 
  243 |       // Get avatar detail to find version id
  244 |       const detailRes = await request.get(`${BASE_URL}/api/avatars/${testAvatarId}`, {
  245 |         headers: { Authorization: `Bearer ${token}` },
  246 |       });
  247 |       const detailBody = await detailRes.json();
  248 |       if (detailBody.success && detailBody.data?.versions?.length > 0) {
  249 |         testVersionId = detailBody.data.versions[0].id;
  250 |       }
  251 |     });
  252 | 
  253 |     test('Avatar detail returns version list', async ({ request }) => {
  254 |       if (!testAvatarId) {
  255 |         test.skip();
  256 |         return;
  257 |       }
  258 |       const token = await getAuthToken(request);
  259 |       const res = await request.get(`${BASE_URL}/api/avatars/${testAvatarId}`, {
  260 |         headers: { Authorization: `Bearer ${token}` },
  261 |       });
  262 |       expect(res.status()).toBe(200);
  263 |       const body = await res.json();
  264 |       expect(body.success).toBe(true);
  265 |       expect(body.data.versions).toBeDefined();
  266 |       expect(Array.isArray(body.data.versions)).toBe(true);
  267 |     });
  268 | 
  269 |     test('Restore version endpoint exists', async ({ request }) => {
  270 |       if (!testAvatarId || !testVersionId) {
  271 |         test.skip();
  272 |         return;
  273 |       }
  274 |       const token = await getAuthToken(request);
  275 |       const res = await request.post(
  276 |         `${BASE_URL}/api/avatars/${testAvatarId}/versions/${testVersionId}/restore`,
  277 |         {
  278 |           headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  279 |         }
  280 |       );
  281 |       // 200 or 404 depending on implementation
  282 |       expect([200, 404, 201]).toContain(res.status());
  283 |     });
  284 | 
  285 |     // Clean up
  286 |     test.afterAll(async ({ request }) => {
  287 |       if (testAvatarId) {
  288 |         const token = await getAuthToken(request);
  289 |         await request.delete(`${BASE_URL}/api/avatars/${testAvatarId}`, {
  290 |           headers: { Authorization: `Bearer ${token}` },
  291 |         });
  292 |       }
  293 |     });
  294 |   });
  295 | 
  296 |   test.describe('Admin Access Control', () => {
  297 |     test('Settings profile requires authentication', async ({ request }) => {
  298 |       const res = await request.get(`${BASE_URL}/api/settings/profile`);
  299 |       expect(res.status()).toBe(401);
  300 |     });
  301 | 
  302 |     test('Admin users endpoint requires auth', async ({ request }) => {
  303 |       const res = await request.get(`${BASE_URL}/api/admin/users`);
  304 |       // Should return 401 or 403 if not admin
  305 |       expect([401, 403]).toContain(res.status());
  306 |     });
  307 | 
  308 |     test('Auth-protected endpoints reject expired/missing token', async ({ request }) => {
  309 |       const res = await request.get(`${BASE_URL}/api/avatars`, {
  310 |         headers: { Authorization: 'Bearer invalid_token_12345' },
  311 |       });
  312 |       expect(res.status()).toBe(401);
  313 |     });
  314 |   });
  315 | });
  316 | 
  317 | test.describe('Batch Export E2E', () => {
  318 | 
  319 |   test('Export endpoint returns 401 without auth', async ({ request }) => {
  320 |     const res = await request.get(`${BASE_URL}/api/avatars/test-id/export?format=glb`);
  321 |     expect(res.status()).toBe(401);
  322 |   });
  323 | 
  324 |   test('Export endpoint requires valid avatar id', async ({ request }) => {
  325 |     const token = await getAuthToken(request);
  326 |     const res = await request.get(`${BASE_URL}/api/avatars/nonexistent-id/export?format=glb`, {
  327 |       headers: { Authorization: `Bearer ${token}` },
  328 |     });
  329 |     // Should return 404 for non-existent avatar
> 330 |     expect(res.status()).toBe(404);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  331 |   });
  332 | 
  333 |   test('Screenshot endpoint accepts valid request', async ({ request }) => {
  334 |     const token = await getAuthToken(request);
  335 | 
  336 |     // Create a test avatar first
  337 |     const avatarRes = await request.post(`${BASE_URL}/api/avatars`, {
  338 |       data: { name: 'Screenshot Test', style: 'anime', base_model: 'female' },
  339 |       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  340 |     });
  341 |     const avatarBody = await avatarRes.json();
  342 |     const avatarId = avatarBody.data?.id;
  343 | 
  344 |     if (avatarId) {
  345 |       // Request screenshot
  346 |       const screenshotRes = await request.post(`${BASE_URL}/api/avatars/${avatarId}/screenshot`, {
  347 |         data: { width: 1920, height: 1080, cameraPreset: 'front' },
  348 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  349 |       });
  350 |       expect(screenshotRes.status()).toBe(202);
  351 |       const screenshotBody = await screenshotRes.json();
  352 |       expect(screenshotBody.success).toBe(true);
  353 |       expect(screenshotBody.data?.jobId).toBeDefined();
  354 | 
  355 |       // Poll screenshot status
  356 |       const jobId = screenshotBody.data.jobId;
  357 |       const pollRes = await request.get(
  358 |         `${BASE_URL}/api/avatars/${avatarId}/screenshot?jobId=${jobId}`,
  359 |         { headers: { Authorization: `Bearer ${token}` } },
  360 |       );
  361 |       expect(pollRes.status()).toBe(200);
  362 | 
  363 |       // Clean up
  364 |       await request.delete(`${BASE_URL}/api/avatars/${avatarId}`, {
  365 |         headers: { Authorization: `Bearer ${token}` },
  366 |       });
  367 |     }
  368 |   });
  369 | });
  370 | 
```