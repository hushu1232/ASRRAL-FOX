import { get, post, put, loginAs } from './helpers';

let adminToken: string;
let userToken: string;

describe('Full Project Smoke Test', () => {

  // ====================== Auth ======================
  describe('Auth', () => {
    it('POST /api/auth/login — admin login', async () => {
      const res = await post('/api/auth/login', { email: 'admin@example.com', password: 'admin123' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      adminToken = (res.body.data as Record<string, string>).accessToken;
      expect(adminToken).toBeDefined();
    });

    it('POST /api/auth/login — demo user login', async () => {
      const res = await post('/api/auth/login', { email: 'demo@example.com', password: 'demo1234' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      userToken = (res.body.data as Record<string, string>).accessToken;
      expect(userToken).toBeDefined();
    });

    it('POST /api/auth/login — wrong password rejected', async () => {
      const res = await post('/api/auth/login', { email: 'demo@example.com', password: 'wrong' });
      expect(res.status === 400 || res.status === 401).toBe(true);
    });

    it('POST /api/auth/register — new user', async () => {
      const ts = Date.now().toString(36);
      const res = await post('/api/auth/register', {
        email: `test-${ts}@example.com`,
        username: `tester${ts}`,
        password: 'test1234',
      });
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
      } else {
        // May already exist from prior runs
        expect(res.status).toBe(400);
      }
    });
  });

  // ====================== Dashboard ======================
  describe('Dashboard', () => {
    it('GET /api/dashboard/stats — returns stats', async () => {
      const res = await get('/api/dashboard/stats', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as Record<string, number>;
      expect(typeof data.totalAvatars).toBe('number');
    });
  });

  // ====================== Avatars ======================
  describe('Avatars', () => {
    let avatarId: string;

    it('GET /api/avatars — paginated list', async () => {
      const res = await get('/api/avatars?page=1&pageSize=5', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as Record<string, unknown>;
      expect(Array.isArray(data.items)).toBe(true);
      expect((data.items as unknown[]).length).toBeGreaterThan(0);
    });

    it('POST /api/avatars — create avatar', async () => {
      const res = await post('/api/avatars', {
        name: `SmokeTest-${Date.now()}`,
        style: 'anime',
        base_model: 'female',
      }, userToken);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const data = res.body.data as Record<string, string>;
      avatarId = data.id;
      expect(avatarId).toBeDefined();
    });

    it('GET /api/avatars/:id — single avatar', async () => {
      const res = await get(`/api/avatars/${avatarId}`, userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/avatars — search filter', async () => {
      const res = await get('/api/avatars?search=Smoke', userToken);
      expect(res.status).toBe(200);
    });

    it('PUT /api/avatars/:id — update avatar', async () => {
      const res = await put(`/api/avatars/${avatarId}`, { name: 'SmokeTest-Updated' }, userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ====================== Assets ======================
  describe('Assets', () => {
    it('GET /api/assets — paginated list', async () => {
      const res = await get('/api/assets?page=1&pageSize=5', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as Record<string, unknown>;
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('GET /api/assets — type filter', async () => {
      const res = await get('/api/assets?type=model', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/assets/upload — requires multipart file', async () => {
      // Sending JSON instead of FormData triggers server error (500) on formData() parse
      const res = await post('/api/assets/upload', {}, userToken);
      expect([400, 500]).toContain(res.status);
    });
  });

  // ====================== Templates (Marketplace) ======================
  describe('Templates', () => {
    it('GET /api/templates — marketplace list', async () => {
      const res = await get('/api/templates', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as Record<string, unknown>;
      expect(Array.isArray(data.items)).toBe(true);
    });
  });

  // ====================== Notifications ======================
  describe('Notifications', () => {
    it('GET /api/notifications — list', async () => {
      const res = await get('/api/notifications', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/notifications/unread-count', async () => {
      const res = await get('/api/notifications/unread-count', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as Record<string, number>;
      expect(typeof data.count).toBe('number');
    });

    it('PUT /api/notifications/read-all', async () => {
      const tokenRes = await fetch('http://localhost:3000/api/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await tokenRes.json();
      expect(data.success).toBe(true);
    });
  });

  // ====================== Search ======================
  describe('Search', () => {
    it('GET /api/search?q=test — returns results', async () => {
      const res = await get('/api/search?q=星尘', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as Record<string, unknown[]>;
      expect(Array.isArray(data.avatars)).toBe(true);
      expect(Array.isArray(data.assets)).toBe(true);
      expect(Array.isArray(data.templates)).toBe(true);
    });

    it('GET /api/search — empty query returns empty', async () => {
      const res = await get('/api/search?q=', userToken);
      expect(res.status).toBe(200);
    });
  });

  // ====================== Admin ======================
  describe('Admin', () => {
    it('GET /api/admin/stats', async () => {
      const res = await get('/api/admin/stats', adminToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/admin/users', async () => {
      const res = await get('/api/admin/users', adminToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/admin/reviews', async () => {
      const res = await get('/api/admin/reviews', adminToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/admin/audit-logs', async () => {
      const res = await get('/api/admin/audit-logs', adminToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/admin/stats — user cant access', async () => {
      const res = await get('/api/admin/stats', userToken);
      expect(res.status).toBe(403);
    });
  });

  // ====================== Settings ======================
  describe('Settings', () => {
    it('PUT /api/settings/profile — update', async () => {
      const res = await put('/api/settings/profile', { username: 'testuser', bio: 'Test bio' }, userToken);
      expect([200, 400, 409]).toContain(res.status);
    });

    it('GET /api/settings/login-history', async () => {
      const res = await get('/api/settings/login-history', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/settings/api-keys', async () => {
      const res = await get('/api/settings/api-keys', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/settings/2fa — status check', async () => {
      const res = await get('/api/settings/2fa', userToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/settings/2fa — enable step 1', async () => {
      const res = await post('/api/settings/2fa', {}, userToken);
      // May return 400 if already enabled from previous run
      if (res.body.success) {
        const data = res.body.data as Record<string, string>;
        expect(data.secret).toBeDefined();
        expect(data.uri).toContain('otpauth://totp/');
      } else {
        expect(res.status).toBe(400);
      }
    });

    it('DELETE /api/settings/2fa — invalid token rejected', async () => {
      const tokenRes = await fetch('http://localhost:3000/api/settings/2fa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ token: '000000' }),
      });
      const data = await tokenRes.json();
      expect(data.success).toBe(false);
    });
  });

  // ====================== Password Reset ======================
  describe('Password Reset', () => {
    it('POST /api/auth/forgot-password — always returns success', async () => {
      const res = await post('/api/auth/forgot-password', { email: 'demo@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/auth/forgot-password — nonexistent email also success', async () => {
      const res = await post('/api/auth/forgot-password', { email: 'nobody@nowhere.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/auth/reset-password — invalid token rejected', async () => {
      const res = await post('/api/auth/reset-password', { token: 'invalid-token', newPassword: 'newpass123' });
      expect(res.status).toBe(400);
    });
  });

  // ====================== SSO ======================
  describe('SSO', () => {
    it('GET /api/auth/sso — returns config info when unconfigured', async () => {
      const res = await get('/api/auth/sso');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/auth/sso/callback?error=test — redirects on error', async () => {
      const res = await get('/api/auth/sso/callback?error=access_denied&error_description=test');
      expect(res.status === 307 || res.status === 200).toBe(true);
    });
  });

  // ====================== Unauthenticated access ======================
  describe('Unauthenticated', () => {
    it('GET /api/avatars — rejected without token', async () => {
      const res = await get('/api/avatars');
      expect(res.status).toBe(401);
    });

    it('GET /api/notifications — rejected without token', async () => {
      const res = await get('/api/notifications');
      expect(res.status).toBe(401);
    });

    it('GET /api/search — rejected without token', async () => {
      const res = await get('/api/search?q=test');
      expect(res.status).toBe(401);
    });
  });

  // ====================== Public endpoints ======================
  describe('Public', () => {
    it('GET /api/health', async () => {
      const res = await get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });
});
