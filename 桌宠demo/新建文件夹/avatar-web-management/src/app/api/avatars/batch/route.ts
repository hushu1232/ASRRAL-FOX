export const runtime = 'nodejs';

import { z } from 'zod';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { ValidationError } from '@/lib/errors';
import { avatarService } from '@/lib/services/avatar.service';

const batchSchema = z.object({
  action: z.enum(['delete', 'publish', 'unpublish', 'archive']),
  ids: z.array(z.string()).min(1).max(100),
});

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((e) => e.message).join(', '));
    }

    const result = await avatarService.batch(parsed.data.action, parsed.data.ids, user.workspaceId);
    return success(result);
  } catch (err) {
    return error(err);
  }
});
