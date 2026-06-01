export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { assetService } from '@/lib/services/asset.service';

export const GET = withAuth(async (req, user, ctx) => {
  const pathSegments = req.nextUrl.pathname.split('/').filter(Boolean);
  const assetId = pathSegments[pathSegments.indexOf('assets') + 1] || '';

  try {
    const { fileUrl } = await assetService.getFileInfo(assetId, user.workspaceId);

    const redirectUrl = fileUrl.startsWith('/')
      ? new URL(fileUrl, req.url).toString()
      : fileUrl;

    return NextResponse.redirect(redirectUrl);
  } catch {
    return NextResponse.json({ success: false, error: '资源不存在或无权访问' }, { status: 404 });
  }
});
