'use client';
// 性能监控面板 — 开发环境 Web Vitals 实时可视化悬浮窗

import { useEffect, useRef } from 'react';
import { initWebVitals } from '@/lib/performance/webVitals';

/**
 * Client-side performance monitor.
 * Mount in root layout to collect Core Web Vitals on every page.
 * Sentry's browserTracingIntegration handles navigation/route timing automatically.
 */
export default function PerformanceMonitor() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Start web-vitals collection (LCP, FCP, CLS, INP, TTFB) → Sentry
    initWebVitals();
  }, []);

  return null;
}
