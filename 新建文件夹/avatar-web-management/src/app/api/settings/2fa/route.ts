export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';
import { generateTotpSecret, generateTotpUri, verifyTotp } from '@/lib/auth/totp';

export const GET = withAuth(async (_req, user) => {

  const row = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { totpSecret: true },
  });
  const enabled = !!row?.totpSecret;
  return NextResponse.json({ success: true, data: { enabled } });
});

export const POST = withAuth(async (_req, user) => {

  const row = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { totpSecret: true, email: true },
  });
  if (!row) {
    return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
  }
  if (row.totpSecret) {
    return NextResponse.json({ success: false, error: '2FA已启用' }, { status: 400 });
  }

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.sub }, data: { totpSecret: secret } });

  const uri = generateTotpUri(row.email, secret);
  return NextResponse.json({ success: true, data: { secret, uri } });
});

export const PUT = withAuth(async (req, user) => {

  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ success: false, error: '请输入验证码' }, { status: 400 });
  }

  const row = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { totpSecret: true },
  });
  if (!row?.totpSecret) {
    return NextResponse.json({ success: false, error: '请先生成2FA密钥' }, { status: 400 });
  }

  const valid = verifyTotp(row.totpSecret, token);
  if (!valid) {
    return NextResponse.json({ success: false, error: '验证码无效' }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: '2FA验证成功，已启用双因素认证' });
});

export const DELETE = withAuth(async (req, user) => {

  const { token } = await req.json();

  const row = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { totpSecret: true },
  });

  if (row?.totpSecret && token) {
    const valid = verifyTotp(row.totpSecret, token);
    if (!valid) {
      return NextResponse.json({ success: false, error: '验证码无效' }, { status: 400 });
    }
  }

  await prisma.user.update({ where: { id: user.sub }, data: { totpSecret: null } });
  return NextResponse.json({ success: true, message: '2FA已禁用' });
});
