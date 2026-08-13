describe('env validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('provides defaults for external desktop services', async () => {
    delete process.env.RIGGING_SERVICE_URL;
    delete process.env.GPT_SOVITS_URL;
    delete process.env.OLLAMA_URL;
    delete process.env.RIGGING_TIMEOUT_MS;

    const { validateEnv } = await import('@/env');
    const env = validateEnv();

    expect(env.RIGGING_SERVICE_URL).toBe('http://localhost:8001');
    expect(env.GPT_SOVITS_URL).toBe('http://localhost:8002');
    expect(env.OLLAMA_URL).toBe('http://localhost:11434');
    expect(env.RIGGING_TIMEOUT_MS).toBe(130000);
  });

  it('rejects malformed external service URLs', async () => {
    process.env.RIGGING_SERVICE_URL = 'not-a-url';

    const { validateEnv } = await import('@/env');

    expect(() => validateEnv()).toThrow(/RIGGING_SERVICE_URL/);
  });

  it('rejects malformed AIRI stage URLs', async () => {
    process.env.AIRI_STAGE_URL = 'not-a-url';

    const { validateEnv } = await import('@/env');

    expect(() => validateEnv()).toThrow(/AIRI_STAGE_URL/);
  });

  it('preserves optional Alife local health adapter settings', async () => {
    process.env.FOXD_ALIFE_LOCAL_HEALTH_ENABLED = 'true';
    process.env.FOXD_ALIFE_LOCAL_HEALTH_BASE_URL = 'http://127.0.0.1:8787';
    process.env.FOXD_ALIFE_LOCAL_HEALTH_TOKEN = 'local-token';
    process.env.FOXD_ALIFE_LOCAL_HEALTH_TIMEOUT_MS = '1500';

    const { validateEnv } = await import('@/env');
    const env = validateEnv();

    expect(env.FOXD_ALIFE_LOCAL_HEALTH_ENABLED).toBe('true');
    expect(env.FOXD_ALIFE_LOCAL_HEALTH_BASE_URL).toBe('http://127.0.0.1:8787');
    expect(env.FOXD_ALIFE_LOCAL_HEALTH_TOKEN).toBe('local-token');
    expect(env.FOXD_ALIFE_LOCAL_HEALTH_TIMEOUT_MS).toBe(1500);
  });
});
