// Web Vitals 接收端点 — 浏览器端 CWV 指标上报
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('web-vitals');

interface VitalsPayload {
  name: string;       // CLS | FID | LCP | INP | TTFB
  value: number;
  rating: string;     // good | needs-improvement | poor
  delta: number;
  id: string;
  navigationType: string;
  url: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: VitalsPayload = await req.json();

    // Log as structured data for log aggregation
    log.info({
      metric: body.name,
      value: Math.round(body.value * 100) / 100,
      rating: body.rating,
      url: body.url,
      navigationType: body.navigationType,
    }, `Web Vital: ${body.name}=${body.value.toFixed(2)} (${body.rating})`);

    return NextResponse.json({ success: true }, { status: 202 });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
}
