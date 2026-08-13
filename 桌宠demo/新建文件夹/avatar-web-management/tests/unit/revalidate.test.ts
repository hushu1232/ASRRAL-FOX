jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

describe('revalidate route', () => {
  it('fails closed when no secret is configured', async () => {
    delete process.env.REVALIDATE_SECRET;
    jest.resetModules();
    const { POST } = require('@/app/api/revalidate/route');
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: 'dev-secret', paths: ['/'] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ success: false, error: 'Revalidation is not configured' });
  });
});
