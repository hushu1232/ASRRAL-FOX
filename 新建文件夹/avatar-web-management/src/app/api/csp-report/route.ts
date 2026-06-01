export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('csp');

/**
 * CSP violation report endpoint.
 * Browsers POST `{ csp-report: { blocked-uri, violated-directive, ... } }` here.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report = body?.['csp-report'] || body;

    log.warn({
      blockedUri: report['blocked-uri'],
      violatedDirective: report['violated-directive'],
      documentUri: report['document-uri'],
      originalPolicy: report['original-policy']?.substring(0, 120),
    }, 'CSP violation reported');

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
