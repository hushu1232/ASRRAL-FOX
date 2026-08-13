export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

/**
 * POST /api/revalidate — On-demand ISR revalidation webhook.
 * Expects JSON body: { secret, paths?: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    if (!REVALIDATE_SECRET) {
      return NextResponse.json({ success: false, error: 'Revalidation is not configured' }, { status: 503 });
    }
    const body = await req.json();
    const { secret, paths } = body as {
      secret?: string;
      paths?: string[];
    };

    if (secret !== REVALIDATE_SECRET) {
      return NextResponse.json({ success: false, error: 'Invalid secret' }, { status: 401 });
    }

    let revalidated = 0;

    if (paths?.length) {
      for (const p of paths) {
        revalidatePath(p);
        revalidated++;
      }
    }

    return NextResponse.json({
      success: true,
      revalidated,
      now: Date.now(),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
