export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/middleware';
import { updateExperiment, deleteExperiment } from '@/lib/experiments/store';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin:experiment');

export const PUT = requireRole('super_admin')(async (req: NextRequest, _auth, ctx?: { params?: Promise<unknown> }) => {
  try {
    const params = await ctx?.params;
    const id = (params as Record<string, string>)?.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Experiment ID required' }, { status: 400 });
    }

    const body = await req.json();
    const updated = await updateExperiment(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Experiment not found' }, { status: 404 });
    }

    log.info({ experimentId: id }, 'Experiment updated');
    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    log.error({ err }, 'Failed to update experiment');
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
});

export const DELETE = requireRole('super_admin')(async (_req: NextRequest, _auth, ctx?: { params?: Promise<unknown> }) => {
  try {
    const params = await ctx?.params;
    const id = (params as Record<string, string>)?.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Experiment ID required' }, { status: 400 });
    }

    const deleted = await deleteExperiment(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Experiment not found' }, { status: 404 });
    }

    log.info({ experimentId: id }, 'Experiment deleted');
    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    log.error({ err }, 'Failed to delete experiment');
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
});
