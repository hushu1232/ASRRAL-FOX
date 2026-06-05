export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getMetrics } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metrics = await getMetrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to collect metrics' }, { status: 500 });
  }
}
