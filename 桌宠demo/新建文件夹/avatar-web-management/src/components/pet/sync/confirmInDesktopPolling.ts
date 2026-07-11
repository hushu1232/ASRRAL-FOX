import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

/** Poll cadence while waiting for desktop confirmation (ms). */
export const CONFIRM_WAIT_POLL_MS = 8_000;

/** How long the applied-success banner stays visible without dismiss (ms). */
export const APPLIED_SUCCESS_BANNER_MS = 12_000;

export function isConfirmWaitStatus(status: DesktopSyncStatus | null | undefined): boolean {
  if (!status) {
    return false;
  }

  return (
    status.primaryAction === 'confirmInDesktop' ||
    status.summaryKind === 'localConfirmationRequired'
  );
}

export function isAppliedUpToDateStatus(status: DesktopSyncStatus | null | undefined): boolean {
  if (!status) {
    return false;
  }

  return status.summaryKind === 'upToDate' || (status.packageState === 'applied' && status.isUpToDate);
}

/**
 * True only on the transition from confirm-wait → applied/upToDate.
 * Initial page load already upToDate must not show the banner.
 */
export function shouldShowAppliedSuccess(
  previous: DesktopSyncStatus | null | undefined,
  next: DesktopSyncStatus | null | undefined,
): boolean {
  if (!isConfirmWaitStatus(previous)) {
    return false;
  }

  return isAppliedUpToDateStatus(next);
}
