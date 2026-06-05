export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/middleware';
import { revokeOAuthClient } from '@/lib/auth/oauth-provider';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin:oauth-client');

export const DELETE = requireRole('super_admin')(async (_req: NextRequest, _auth, ctx?: { params?: Promise<unknown> }) => {
  try {
    const params = await ctx?.params;
    const id = (params as Record<string, string>)?.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Client ID required' }, { status: 400 });
    }

    const revoked = await revokeOAuthClient(id);
    if (!revoked) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    log.info({ clientId: id }, 'OAuth client revoked');
    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    log.error({ err }, 'Failed to revoke OAuth client');
    return NextResponse.json({ success: false, error: 'Failed to revoke client' }, { status: 500 });
  }
});
