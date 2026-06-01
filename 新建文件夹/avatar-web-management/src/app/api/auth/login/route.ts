export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { success, error } from '@/lib/api-response';
import { loginSchema } from '@/lib/validators';
import { ValidationError, UnauthorizedError } from '@/lib/errors';
import { generateCsrfToken } from '@/lib/csrf';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map(e => e.message).join(', '));
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findFirst({
      where: { email, status: 'active' },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        role: true,
        workspaceId: true,
        status: true,
        level: true,
        exp: true,
        activeTitle: true,
        unlockedTitles: true,
      },
    });

    if (!user) {
      logAudit({ action: 'auth.login_failed', resourceType: 'auth', details: { email, reason: 'user_not_found' }, req });
      throw new UnauthorizedError('邮箱或密码错误');
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      logAudit({ userId: user.id, action: 'auth.login_failed', resourceType: 'auth', details: { email, reason: 'wrong_password' }, req, workspaceId: user.workspaceId });
      throw new UnauthorizedError('邮箱或密码错误');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logAudit({ userId: user.id, action: 'auth.login', resourceType: 'auth', req, workspaceId: user.workspaceId });

    const payload = { sub: user.id, email: user.email, role: user.role, ws: user.workspaceId };
    const accessToken = signAccessToken(payload);
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

    response.cookies.set('XSRF-TOKEN', generateCsrfToken(), {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });

    return response;
  } catch (err) {
    return error(err);
  }
}
