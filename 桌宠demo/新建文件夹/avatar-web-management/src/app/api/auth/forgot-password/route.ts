export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';

const log = createLogger('api:auth');

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, error: '请输入邮箱地址' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      logAudit({ action: 'auth.forgot_password_unknown', resourceType: 'auth', details: { email }, req });
      return NextResponse.json({ success: true, message: '如果该邮箱已注册，您将收到密码重置链接' });
    }

    const token = uuidv4() + '-' + uuidv4();

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    logAudit({ userId: user.id, action: 'auth.forgot_password', resourceType: 'auth', details: { email }, req });

    const resetUrl = `${req.nextUrl.origin}/reset-password?token=${token}`;
    log.info('Password reset link for %s: %s', email, resetUrl);

    return NextResponse.json({ success: true, message: '如果该邮箱已注册，您将收到密码重置链接' });
  } catch (err) {
    log.error({ err }, 'Forgot password error');
    return NextResponse.json({ success: false, error: '请求失败' }, { status: 500 });
  }
}
