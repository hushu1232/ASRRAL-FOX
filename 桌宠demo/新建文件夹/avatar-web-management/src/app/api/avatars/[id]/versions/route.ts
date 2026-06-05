export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { versionCreateSchema } from '@/lib/validators';
import { ValidationError } from '@/lib/errors';
import { logAudit } from '@/lib/audit';
import { avatarService } from '@/lib/services/avatar.service';

export const GET = withAuth(async (_req, user, ctx) => {
  try {
    const params = (await ctx?.params) as { id: string } | undefined;
    const id = params?.id || '';
    const versions = await avatarService.listVersions(id, user.workspaceId);
    return success(versions);
  } catch (err) {
    return error(err);
  }
});

export const POST = withAuth(async (req, user, ctx) => {
  try {
    const body = await req.json();
    const parsed = versionCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map(e => e.message).join(', '));
    }

    const params = (await ctx?.params) as { id: string } | undefined;
    const avatarId = params?.id || '';

    const version = await avatarService.createVersion(avatarId, parsed.data, user.workspaceId);

    logAudit({ userId: user.sub, action: 'avatar.version_create', resourceType: 'avatar_version', resourceId: version.id as string, details: { avatarId, versionNumber: version.version_number }, req, workspaceId: user.workspaceId });

    return success(version, 201);
  } catch (err) {
    return error(err);
  }
});
