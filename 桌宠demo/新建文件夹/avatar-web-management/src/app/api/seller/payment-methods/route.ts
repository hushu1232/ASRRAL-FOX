import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/middleware';
import { success, error as apiError } from '@/lib/api-response';

/** List seller's payment methods. */
export const GET = withAuth(async (_req: NextRequest, user) => {
  const prisma = getPrisma();
  const methods = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM seller_payment_methods WHERE seller_id = $1 ORDER BY is_default DESC, created_at DESC`,
    user.sub
  );
  return success(methods);
});

/** Add a payment method. */
export const POST = withAuth(async (req: NextRequest, user) => {
  const prisma = getPrisma();
  const body = await req.json();
  const { type, account, accountName } = body;

  if (!type || !account || !accountName) {
    return NextResponse.json({ success: false, error: 'type, account, accountName are required' }, { status: 400 });
  }
  if (!['alipay', 'wechat', 'bank'].includes(type)) {
    return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
  }

  const isFirst = (await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(
    `SELECT COUNT(*) as cnt FROM seller_payment_methods WHERE seller_id = $1`, user.sub
  ))[0]?.cnt === 0;

  await prisma.$executeRawUnsafe(
    `INSERT INTO seller_payment_methods (seller_id, type, account, account_name, is_default, verified, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    user.sub, type, account, accountName, isFirst, false
  );

  return success({ message: 'Payment method added' });
});
