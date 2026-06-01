import { get, post, loginAs } from './helpers';

describe('GET /api/avatars', () => {
  let token: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  it('returns paginated avatar list', async () => {
    const res = await get('/api/avatars', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(typeof res.body.data.total).toBe('number');
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('rejects unauthenticated access', async () => {
    const res = await get('/api/avatars');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('supports style filter', async () => {
    const res = await get('/api/avatars?style=anime', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('supports search filter', async () => {
    const res = await get('/api/avatars?search=%E6%98%9F%E5%B0%98', token); // URL-encoded "星尘"

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/avatars', () => {
  let token: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  it('creates a new avatar', async () => {
    const res = await post('/api/avatars', {
      name: 'Test Avatar from Jest',
      style: 'anime',
      base_model: 'female',
    }, token);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('Test Avatar from Jest');
  });

  it('rejects creation with missing name', async () => {
    const res = await post('/api/avatars', { style: 'anime' }, token);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
