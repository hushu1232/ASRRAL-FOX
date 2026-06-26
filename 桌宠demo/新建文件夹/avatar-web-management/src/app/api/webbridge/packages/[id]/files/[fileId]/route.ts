export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { error } from '@/lib/api-response';
import { petService } from '@/lib/services/petService';
import { buildWebBridgePackageFile } from '@/lib/webbridge/package-service';

interface RouteParams {
  id: string;
  fileId: string;
}

export const GET = withAuth(async (_req, user, ctx) => {
  try {
    const { id, fileId } = await (ctx?.params as Promise<RouteParams>);
    const petExport = await petService.exportConfig(user.sub, user.workspaceId);
    const file = buildWebBridgePackageFile({
      packageId: id,
      fileId,
      petExport,
    });

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        'content-type': file.contentType,
        'content-length': String(file.bytes.byteLength),
      },
    });
  } catch (err) {
    return error(err);
  }
});
