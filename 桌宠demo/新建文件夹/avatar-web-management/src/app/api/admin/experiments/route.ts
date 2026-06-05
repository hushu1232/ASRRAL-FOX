export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/middleware';
import { loadExperimentsFromDb, createExperiment } from '@/lib/experiments/store';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin:experiments');

export const GET = requireRole('super_admin')(async () => {
  try {
    const experiments = await loadExperimentsFromDb();
    return NextResponse.json({ success: true, data: experiments });
  } catch (err) {
    log.error({ err }, 'Failed to list experiments');
    return NextResponse.json({ success: false, error: 'Failed to list experiments' }, { status: 500 });
  }
});

export const POST = requireRole('super_admin')(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { name, key, traffic, variants } = body;

    if (!name || !key || !Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'name, key, and variants (non-empty array) are required' },
        { status: 400 },
      );
    }

    const totalWeight = variants.reduce((sum: number, v: { weight?: number }) => sum + (v.weight || 0), 0);
    if (Math.abs(totalWeight - 100) > 1) {
      return NextResponse.json(
        { success: false, error: `Variant weights must sum to 100 (got ${totalWeight})` },
        { status: 400 },
      );
    }

    const experiment = await createExperiment({ name, key, traffic, variants });
    if (!experiment) {
      return NextResponse.json({ success: false, error: 'Failed to create experiment' }, { status: 500 });
    }

    log.info({ name, key }, 'Experiment created');
    return NextResponse.json({ success: true, data: experiment });
  } catch (err) {
    log.error({ err }, 'Failed to create experiment');
    return NextResponse.json({ success: false, error: 'Failed to create experiment' }, { status: 500 });
  }
});
