// Rigging 健康检查 — API 透传
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { checkHealth } from '@/lib/rigging/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('rigging-health');

export async function GET() {
  try {
    const healthy = await checkHealth();
    return NextResponse.json({
      success: true,
      data: { rigging: healthy ? 'ok' : 'unreachable' },
    });
  } catch (err) {
    log.error({ err }, 'Rigging health check failed');
    return NextResponse.json({
      success: true,
      data: { rigging: 'unreachable' },
    });
  }
}
