export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { success, error } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';
import { petSyncStatusService, type ReportPetSyncMilestoneInput } from '@/lib/services/petSyncStatusService';

const log = createLogger('api:pet:sync-status');

export const GET = withAuth(async (_req, user) => {
  try {
    const status = await petSyncStatusService.getStatus(user.sub, user.workspaceId);
    return success(status);
  } catch (err) {
    log.error({ err }, 'Pet sync status failed');
    return error(err);
  }
});

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json().catch(() => ({}));
    const report = validateReportBody(body);
    const status = await petSyncStatusService.reportMilestone(user.sub, user.workspaceId, report);
    return success(status);
  } catch (err) {
    log.error({ err }, 'Pet sync status milestone failed');
    return error(err);
  }
});

function validateReportBody(body: unknown): ReportPetSyncMilestoneInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Pet sync status report body must be an object');
  }

  return body as ReportPetSyncMilestoneInput;
}
