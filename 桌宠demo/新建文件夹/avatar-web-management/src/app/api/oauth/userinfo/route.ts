export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getPrisma, toSnakeCase } from '@/lib/db';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'Missing access token' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    );
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'Invalid or expired access token' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    );
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, username: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'User not found' },
        { status: 401 },
      );
    }

    const claims = toSnakeCase(user as unknown as Record<string, unknown>);

    return NextResponse.json(
      {
        sub: claims.id || payload.sub,
        email: claims.email,
        name: claims.username,
        preferred_username: claims.username,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
