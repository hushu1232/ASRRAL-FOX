export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createLogger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';

const log = createLogger('api:auth');

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: '密码至少8个字符' }, { status: 400 });
    }

    const row = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true, used: true },
    });

    if (!row || row.used || row.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: '重置链接无效或已过期' }, { status: 400 });
    }

    const hashed = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash: hashed },
      }),
      prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { used: true },
      }),
    ]);

    logAudit({ userId: row.userId, action: 'auth.reset_password', resourceType: 'auth', req });

    return NextResponse.json({ success: true, message: '密码已重置，请使用新密码登录' });
  } catch (err) {
    log.error({ err }, 'Reset password error');
    return NextResponse.json({ success: false, error: '重置失败' }, { status: 500 });
  }
}
