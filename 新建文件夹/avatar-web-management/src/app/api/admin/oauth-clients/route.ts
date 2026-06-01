export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireRole } from '@/lib/auth/middleware';
import {
  createOAuthClient,
  listOAuthClients,
  revokeOAuthClient,
} from '@/lib/auth/oauth-provider';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin:oauth-clients');

export const GET = requireRole('super_admin')(async (_req, _auth) => {
  try {
    const clients = await listOAuthClients();
    const safe = clients.map((c) => ({
      id: c.id,
      name: c.name,
      clientId: c.clientId,
      redirectUris: c.redirectUris,
      scopes: c.scopes,
      grantTypes: c.grantTypes,
      isPublic: c.isPublic,
    }));
    return NextResponse.json({ success: true, data: safe });
  } catch (err) {
    log.error({ err }, 'Failed to list OAuth clients');
    return NextResponse.json({ success: false, error: 'Failed to list clients' }, { status: 500 });
  }
});

export const POST = requireRole('super_admin')(async (req) => {
  try {
    const body = await req.json();
    const { name, redirect_uris, scopes, grant_types, is_public } = body;

    if (!name || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return NextResponse.json(
        { success: false, error: 'name and redirect_uris are required' },
        { status: 400 },
      );
    }

    const client = await createOAuthClient({
      name,
      redirectUris: redirect_uris,
      scopes,
      grantTypes: grant_types,
      isPublic: is_public,
    });

    log.info({ name, clientId: client.clientId }, 'OAuth client created');

    return NextResponse.json({
      success: true,
      data: {
        id: client.id,
        name: client.name,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        redirectUris: client.redirectUris,
        scopes: client.scopes,
        grantTypes: client.grantTypes,
        isPublic: client.isPublic,
      },
    });
  } catch (err) {
    log.error({ err }, 'Failed to create OAuth client');
    return NextResponse.json({ success: false, error: 'Failed to create client' }, { status: 500 });
  }
});
