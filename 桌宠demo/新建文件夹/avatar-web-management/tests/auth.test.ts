import { post, get, loginAs } from './helpers';

describe('POST /api/auth/login', () => {
  it('returns 200 and JWT token for valid credentials', async () => {
    const res = await post('/api/auth/login', {
      email: 'demo@example.com',
      password: 'demo1234',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.accessToken.split('.')).toHaveLength(3);
    expect(res.body.data.user.email).toBe('demo@example.com');
  });

  it('returns 401 for wrong password', async () => {
    const res = await post('/api/auth/login', {
      email: 'demo@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for non-existent user', async () => {
    const res = await post('/api/auth/login', {
      email: 'nobody@example.com',
      password: 'whatever123',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for missing credentials', async () => {
    const res = await post('/api/auth/login', {});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('JWT access control', () => {
  it('allows access to /api/avatars with valid token', async () => {
    const token = await loginAs('demo@example.com', 'demo1234');
    expect(token).toBeDefined();

    const res = await get('/api/avatars', token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects access to /api/admin/users with non-admin token', async () => {
    const token = await loginAs('demo@example.com', 'demo1234');
    expect(token).toBeDefined();

    const res = await get('/api/admin/users', token);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
