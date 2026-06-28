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
    const origin = resolvePublicOrigin(req);

    return success(
      buildWebBridgePackageManifest({
        packageId: id,
        origin,
        petExport,
      }),
    );
  } catch (err) {
    return error(err);
  }
});
function resolvePublicOrigin(req: Request): string {
  const requestUrl = new URL(req.url);
  const forwardedProto = firstHeaderValue(req.headers.get('x-forwarded-proto'));
  const forwardedHost = firstHeaderValue(req.headers.get('x-forwarded-host'));
  const host = normalizePublicHost(forwardedHost || req.headers.get('host') || requestUrl.host);
  const protocol = forwardedProto || requestUrl.protocol.replace(/:$/, '') || 'http';

  return `${protocol}://${host}`;
}

function firstHeaderValue(value: string | null): string | undefined {
  return value?.split(',')[0]?.trim() || undefined;
}

function normalizePublicHost(host: string): string {
  if (host.startsWith('0.0.0.0')) {
    return `localhost${host.slice('0.0.0.0'.length)}`;
  }
  if (host.startsWith('[::]')) {
    return `localhost${host.slice('[::]'.length)}`;
  }
  if (host.startsWith('::')) {
    return `localhost${host.slice('::'.length)}`;
  }

  return host;
}
