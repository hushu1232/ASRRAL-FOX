export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { petSyncStatusService, type ReportPetSyncPullInput } from '@/lib/services/petSyncStatusService';
import { success, error } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:sync');

async function exportForDesktop(userId: string, workspaceId: string) {
  return petService.exportConfig(userId, workspaceId);
}

export const GET = withAuth(async (_req, user) => {
  try {
    const config = await exportForDesktop(user.sub, user.workspaceId);
    return success(config);
  } catch (err) {
    log.error({ err }, 'Pet sync failed');
    return error(err);
  }
});

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json().catch(() => ({}));
    const report = validateSyncBody(body);
    const config = await exportForDesktop(user.sub, user.workspaceId);
    await petSyncStatusService.reportConfigPull(user.sub, user.workspaceId, report, config.version);
    return success(config);
  } catch (err) {
    log.error({ err }, 'Pet sync failed');
    return error(err);
  }
});

function validateSyncBody(body: unknown): ReportPetSyncPullInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Pet sync report body must be an object');
  }

  return body as ReportPetSyncPullInput;
}
