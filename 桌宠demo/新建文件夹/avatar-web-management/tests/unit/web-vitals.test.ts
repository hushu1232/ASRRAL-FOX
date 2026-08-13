import type { Metric } from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { initWebVitals, measureAsync, trackCustomMetric } from '@/lib/performance/webVitals';

jest.mock('web-vitals', () => ({
  onCLS: jest.fn(),
  onFCP: jest.fn(),
  onINP: jest.fn(),
  onLCP: jest.fn(),
  onTTFB: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  captureEvent: jest.fn(),
}));

const metric = {
  name: 'LCP',
  value: 1234.5,
  rating: 'good',
  delta: 1234.5,
  id: 'metric-1',
  navigationType: 'navigate',
} as Metric;

const waitForDynamicImport = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('web vitals reporting', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    debugSpy.mockRestore();
    jest.clearAllMocks();
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    if (originalDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
  });

  it('registers all core metrics and reports a metric in development', async () => {
    (process.env as unknown as Record<string, string>).NODE_ENV = 'development';
    initWebVitals();

    for (const handler of [onCLS, onFCP, onINP, onLCP, onTTFB]) {
      expect(handler).toHaveBeenCalledWith(expect.any(Function));
      const callback = (handler as jest.Mock).mock.calls[0][0] as (value: Metric) => void;
      callback(metric);
    }

    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('[WebVitals]'));
    await waitForDynamicImport();
  });

  it('sends custom metrics and measures async work duration', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://example.invalid/1';
    trackCustomMetric('load', 42, { route: '/dashboard' });
    const result = await measureAsync('query', async () => 'ok');

    expect(result).toBe('ok');
    await waitForDynamicImport();
  });
});
