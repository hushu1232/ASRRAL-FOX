import {
  isAppliedUpToDateStatus,
  isConfirmWaitStatus,
  shouldShowAppliedSuccess,
} from '@/components/pet/sync/confirmInDesktopPolling';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

function status(overrides: Partial<DesktopSyncStatus> = {}): DesktopSyncStatus {
  return {
    desktopConnection: 'online',
    packageState: 'staged',
    summaryKind: 'localConfirmationRequired',
    primaryAction: 'confirmInDesktop',
    isUpToDate: false,
    webConfigVersion: 3,
    desktopKnownVersion: 3,
    desktopAppliedVersion: 2,
    requiresLocalConfirmation: true,
    lastSyncAt: '2026-07-11T00:00:00.000Z',
    lastAppliedAt: null,
    lastError: null,
    errorMessage: null,
    milestones: ['packageStaged', 'confirmationRequested'],
    ...overrides,
  };
}

describe('confirmInDesktopPolling helpers', () => {
  it('detects confirm-wait from primaryAction or summaryKind', () => {
    expect(isConfirmWaitStatus(status())).toBe(true);
    expect(
      isConfirmWaitStatus(
        status({ primaryAction: 'checkAgain', summaryKind: 'localConfirmationRequired' }),
      ),
    ).toBe(true);
    expect(
      isConfirmWaitStatus(
        status({
          packageState: 'applied',
          summaryKind: 'upToDate',
          primaryAction: 'none',
          isUpToDate: true,
          requiresLocalConfirmation: false,
        }),
      ),
    ).toBe(false);
    expect(isConfirmWaitStatus(null)).toBe(false);
  });

  it('detects applied/upToDate status', () => {
    expect(
      isAppliedUpToDateStatus(
        status({
          packageState: 'applied',
          summaryKind: 'upToDate',
          primaryAction: 'none',
          isUpToDate: true,
          requiresLocalConfirmation: false,
        }),
      ),
    ).toBe(true);
    expect(isAppliedUpToDateStatus(status())).toBe(false);
  });

  it('shows applied success only on confirm-wait → applied transition', () => {
    const waiting = status();
    const applied = status({
      packageState: 'applied',
      summaryKind: 'upToDate',
      primaryAction: 'none',
      isUpToDate: true,
      requiresLocalConfirmation: false,
      desktopAppliedVersion: 3,
    });

    expect(shouldShowAppliedSuccess(waiting, applied)).toBe(true);
    expect(shouldShowAppliedSuccess(null, applied)).toBe(false);
    expect(shouldShowAppliedSuccess(applied, applied)).toBe(false);
    expect(shouldShowAppliedSuccess(waiting, waiting)).toBe(false);
  });
});
