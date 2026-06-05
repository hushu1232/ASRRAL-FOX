// Rigging 管线状态查询 — 轮询降级
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getPipelineStatus } from '@/lib/rigging/pipeline';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const status = getPipelineStatus(id);

  if (!status) {
    return NextResponse.json(
      { success: false, error: `Pipeline not found: ${id}` },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: status });
}
