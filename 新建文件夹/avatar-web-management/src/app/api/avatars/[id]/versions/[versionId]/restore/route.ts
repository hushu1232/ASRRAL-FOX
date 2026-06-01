export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { logAudit } from '@/lib/audit';
import { avatarService } from '@/lib/services/avatar.service';

export const POST = withAuth(async (_req, user, ctx) => {
  try {
    const params = (await ctx?.params) as { id: string; versionId: string } | undefined;
    const avatarId = params?.id || '';
    const versionId = params?.versionId || '';

    const result = await avatarService.restoreVersion(avatarId, versionId);

    logAudit({ userId: user.sub, action: 'avatar.version_restore', resourceType: 'avatar_version', resourceId: result.version.id as string, details: { avatarId, restoredFromVersionId: versionId, newVersionNumber: result.version.version_number }, req: _req, workspaceId: user.workspaceId });

    return success({ version: result.version, restoredFrom: result.restoredFrom }, 201);
  } catch (err) {
    return error(err);
  }
});
