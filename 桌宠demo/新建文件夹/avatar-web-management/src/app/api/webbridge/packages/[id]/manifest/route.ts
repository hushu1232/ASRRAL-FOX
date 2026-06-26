export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { success, error } from '@/lib/api-response';
import { petService } from '@/lib/services/petService';
import { buildWebBridgePackageManifest } from '@/lib/webbridge/package-service';

interface RouteParams {
  id: string;
}

export const GET = withAuth(async (req, user, ctx) => {
  try {
    const { id } = await (ctx?.params as Promise<RouteParams>);
    const petExport = await petService.exportConfig(user.sub, user.workspaceId);
    const origin = new URL(req.url).origin;

    return success(buildWebBridgePackageManifest({
      packageId: id,
      origin,
      petExport,
    }));
  } catch (err) {
    return error(err);
  }
});
