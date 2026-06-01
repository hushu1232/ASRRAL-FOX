'use client';

import { useEffect } from 'react';
import { onCLS, onLCP, onINP, onTTFB, type Metric } from 'web-vitals';

function report(metric: Metric) {
  const body = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.pathname,
  };

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/metrics/web-vitals', JSON.stringify(body));
  }

  if (process.env.NODE_ENV === 'development') {
    const color =
      metric.rating === 'good' ? 'green' : metric.rating === 'needs-improvement' ? 'orange' : 'red';
    console.log(
      `%c[WebVitals] %c${metric.name} %c${metric.value.toFixed(1)} %c${metric.rating}`,
      'color: #888', 'font-weight: bold', `color: ${color}`, `color: ${color}`,
    );
  }
}

export default function WebVitals() {
  useEffect(() => {
    onCLS(report);
    onLCP(report);
    onINP(report);
    onTTFB(report);
  }, []);

  return null;
}
