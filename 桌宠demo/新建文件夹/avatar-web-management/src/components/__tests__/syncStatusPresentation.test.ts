import { getLifecycleSteps } from '@/components/pet/sync/syncStatusPresentation';
import {
  buildDesktopSyncStatus,
  type DesktopSyncStatus,
} from '@/lib/webbridge/sync-status';

function createStatus(overrides: Partial<DesktopSyncStatus> = {}): DesktopSyncStatus {
  return {
    desktopConnection: 'online',
    packageState: 'published',
    summaryKind: 'pendingPull',
    primaryAction: 'checkAgain',
    isUpToDate: false,
    webConfigVersion: 12,
    desktopKnownVersion: 11,
    desktopAppliedVersion: 11,
    requiresLocalConfirmation: false,
    lastSyncAt: '2026-06-27T08:00:00.000Z',
    lastAppliedAt: null,
    lastError: null,
    errorMessage: null,
    milestones: [],
    ...overrides,
  };
}

describe('syncStatusPresentation', () => {
  it('keeps every lifecycle step waiting when no package is published', () => {
    const steps = getLifecycleSteps(
      createStatus({
        packageState: 'notPublished',
        summaryKind: 'unknown',
        desktopKnownVersion: null,
        desktopAppliedVersion: null,
      }),
    );

    expect(steps.map((step) => step.state)).toEqual(['wait', 'wait', 'wait']);
  });

  it('keeps normalized unpublished pending-pull lifecycle idle', () => {
    const status = buildDesktopSyncStatus({
      webConfigVersion: 2,
      packageState: 'notPublished',
      desktopKnownVersion: null,
    });

    expect(status.summaryKind).toBe('pendingPull');
    expect(status.requiresLocalConfirmation).toBe(true);
    expect(getLifecycleSteps(status).map((step) => step.state)).toEqual([
      'wait',
      'wait',
      'wait',
    ]);
  });

  it('keeps pulled package in staged process even without local confirmation', () => {
    const steps = getLifecycleSteps(
      createStatus({
        packageState: 'pulled',
        summaryKind: 'localConfirmationRequired',
        requiresLocalConfirmation: false,
      }),
    );

    expect(steps.find((step) => step.key === 'staged')?.state).toBe('process');
    expect(steps.find((step) => step.key === 'applied')?.state).toBe('wait');
  });
});
