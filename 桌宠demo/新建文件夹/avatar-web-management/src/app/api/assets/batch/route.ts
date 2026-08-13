export const runtime = 'nodejs';

import { z } from 'zod';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { ValidationError } from '@/lib/errors';
import { logAudit } from '@/lib/audit';
import { assetService } from '@/lib/services/asset.service';

const batchSchema = z.object({
  action: z.enum(['delete', 'archive']),
  ids: z.array(z.string()).min(1).max(100),
});

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((e) => e.message).join(', '));
    }

    const { action, ids } = parsed.data;
    const result = await assetService.batch(action, ids, user.workspaceId);

    for (const id of ids) {
      logAudit({ userId: user.sub, action: `asset.${action}`, resourceType: 'asset', resourceId: id, req, workspaceId: user.workspaceId });
    }

    return success(result);
  } catch (err) {
    return error(err);
  }
});
