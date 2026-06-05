import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/middleware';

/** Set a payment method as default. */
export const POST = withAuth(async (req: NextRequest, user, ctx) => {
  const prisma = getPrisma();
  const params = (await ctx?.params) as { id: string } | undefined;
  const id = params?.id;
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

  // Unset all defaults for this seller
  await prisma.$executeRawUnsafe(
    `UPDATE seller_payment_methods SET is_default = false WHERE seller_id = $1`, user.sub
  );
  // Set new default
  await prisma.$executeRawUnsafe(
    `UPDATE seller_payment_methods SET is_default = true WHERE id = $1 AND seller_id = $2`, id, user.sub
  );

  return NextResponse.json({ success: true });
});
