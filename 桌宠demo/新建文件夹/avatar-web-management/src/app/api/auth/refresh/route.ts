export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken, revokeRefreshToken } from '@/lib/auth/jwt';
import { success, error } from '@/lib/api-response';
import { UnauthorizedError } from '@/lib/errors';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get('refreshToken');
    if (!cookie?.value) {
      throw new UnauthorizedError('No refresh token');
    }

    const payload = await verifyRefreshToken(cookie.value);
    if (!payload) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    await revokeRefreshToken(cookie.value);

    const user = await prisma.user.findFirst({
      where: { id: payload.sub, status: 'active' },
      select: { id: true, email: true, username: true, role: true, workspaceId: true, level: true, exp: true, activeTitle: true, unlockedTitles: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found or suspended');
    }

    logAudit({ userId: user.id, action: 'auth.token_refresh', resourceType: 'auth', req, workspaceId: user.workspaceId });

    const tokenPayload = { sub: user.id, email: user.email, role: user.role, ws: user.workspaceId };
    const accessToken = signAccessToken(tokenPayload);
    const refreshData = await signRefreshToken(user.id);

    const response = success({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        level: user.level,
        exp: user.exp,
        activeTitle: user.activeTitle,
        unlockedTitles: user.unlockedTitles,
      },
    });

    response.cookies.set('refreshToken', refreshData.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    return error(err);
  }
}
