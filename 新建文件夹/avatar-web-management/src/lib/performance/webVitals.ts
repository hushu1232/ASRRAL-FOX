'use client';
// Web Vitals 监控 — LCP/FID/CLS 采集与 Sentry Performance 上报

import type { Metric } from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

const sentryReady = (): boolean => {
  try {
    return !!(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN);
  } catch {
    return false;
  }
};

function sendToSentry(metric: Metric) {
  // Use dynamic import to avoid bundling Sentry in every page
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.captureEvent({
      message: metric.name,
      level: 'info',
      measurements: {
        [metric.name]: {
          value: metric.value,
          unit: metric.name === 'CLS' ? 'none' : 'millisecond',
        },
      },
      contexts: {
        performance: {
          name: metric.name,
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          id: metric.id,
          navigationType: metric.navigationType,
        },
      },
    });
  }).catch(() => {
    // Sentry not available — noop
  });
}

function sendToConsole(metric: Metric) {
  const ratingEmoji =
    metric.rating === 'good' ? '\u{1F7E2}' :
    metric.rating === 'needs-improvement' ? '\u{1F7E1}' :
    '\u{1F534}';
  console.debug(
    `[WebVitals] ${ratingEmoji} ${metric.name}: ${metric.value.toFixed(metric.name === 'CLS' ? 4 : 1)} (${metric.rating})`
  );
}

function reportMetric(metric: Metric) {
  if (process.env.NODE_ENV === 'development') {
    sendToConsole(metric);
  }
  if (sentryReady()) {
    sendToSentry(metric);
  }
}

/**
 * Start collecting Core Web Vitals and reporting them.
 * Call once in a client component mounted on every page.
 */
export function initWebVitals() {
  onCLS(reportMetric);
  onFCP(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
  onTTFB(reportMetric);
}

/**
 * Track a custom performance metric and report to Sentry.
 */
export function trackCustomMetric(name: string, value: number, tags?: Record<string, string>) {
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.captureEvent({
      message: `custom.${name}`,
      level: 'info',
      measurements: {
        [name]: { value, unit: 'millisecond' },
      },
      tags,
    });
  }).catch(() => {});
}

/**
 * Measure and report the duration of an async operation.
 */
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    trackCustomMetric(name, duration);
  }
}
