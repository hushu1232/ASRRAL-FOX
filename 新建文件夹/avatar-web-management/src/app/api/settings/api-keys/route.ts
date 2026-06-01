export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logAudit } from '@/lib/audit';

export const GET = withAuth(async (_req, user) => {

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.sub },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revoked: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ success: true, data: keys });
});

export const POST = withAuth(async (req, user) => {

  const { name } = await req.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
  }

  const rawKey = `ak_${uuidv4().replace(/-/g, '')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const id = uuidv4();

  await prisma.apiKey.create({
    data: {
      id,
      userId: user.sub,
      name,
      keyHash,
      keyPrefix: rawKey.slice(0, 10),
    },
  });

  logAudit({ userId: user.sub, action: 'api_key.create', resourceType: 'api_key', resourceId: id, details: { name, keyPrefix: rawKey.slice(0, 10) }, req, workspaceId: user.workspaceId });

  return NextResponse.json({ success: true, data: { id, name, key: rawKey, key_prefix: rawKey.slice(0, 10) } }, { status: 201 });
});
