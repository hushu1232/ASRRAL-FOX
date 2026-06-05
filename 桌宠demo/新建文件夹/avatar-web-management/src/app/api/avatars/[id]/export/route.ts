export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { createLogger } from '@/lib/logger';
import { exportService } from '@/lib/services/export.service';

const log = createLogger('api:export');

export const GET = withAuth(async (req, user) => {
  const format = (req.nextUrl.searchParams.get('format') || 'glb').toLowerCase();
  if (!['glb', 'vrm'].includes(format)) {
    return NextResponse.json({ success: false, error: 'format must be glb or vrm' }, { status: 400 });
  }

  const avatarId = req.nextUrl.pathname.split('/').filter(Boolean).at(-2) || '';

  try {
    const { buffer, filename, contentType } = await exportService.exportAvatar(
      avatarId,
      format as 'glb' | 'vrm',
      user.workspaceId
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    log.error({ err }, 'Export error');
    const message = err instanceof Error ? err.message : 'Export failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
