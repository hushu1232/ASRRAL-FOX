export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { addExp } from '@/lib/exp/service';

// POST /api/user/exp — report an EXP-earning action
export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const { action, metadata } = body;

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { success: false, error: 'action is required' },
        { status: 400 },
      );
    }

    const result = await addExp(user.sub, action, metadata);

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Unknown EXP action')) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 400 },
      );
    }
    throw err;
  }
});
