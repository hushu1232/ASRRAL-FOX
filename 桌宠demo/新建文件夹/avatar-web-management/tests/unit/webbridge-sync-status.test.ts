import { ValidationError } from '@/lib/errors';
import {
  DESKTOP_SYNC_ERROR_MESSAGES,
  buildDesktopSyncStatus,
  normalizeDesktopMilestone,
  type DesktopSyncMilestone,
} from '@/lib/webbridge/sync-status';

const now = new Date('2026-06-27T12:00:00.000Z');

describe('webbridge sync status', () => {
  it('reports pending desktop pull when Web has newer config version', () => {
    const status = buildDesktopSyncStatus({
      now,
      desktopConnection: 'online',
      packageState: 'notPublished',
      webConfigVersion: 2,
      desktopKnownVersion: 1,
      desktopAppliedVersion: 1,
    });

    expect(status.summaryKind).toBe('pendingPull');
    expect(status.primaryAction).toBe('checkAgain');
    expect(status.isUpToDate).toBe(false);
  });

  it('reports local confirmation when desktop staged latest version', () => {
    const status = buildDesktopSyncStatus({
      now,
      desktopConnection: 'online',
      packageState: 'staged',
      webConfigVersion: 3,
      desktopKnownVersion: 3,
      desktopAppliedVersion: 2,
    });

    expect(status.summaryKind).toBe('localConfirmationRequired');
    expect(status.primaryAction).toBe('confirmInDesktop');
    expect(status.isUpToDate).toBe(false);
  });

  it('reports up to date when desktop applied version matches Web version', () => {
    const status = buildDesktopSyncStatus({
      now,
      desktopConnection: 'online',
      packageState: 'applied',
      webConfigVersion: 4,
      desktopKnownVersion: 4,
      desktopAppliedVersion: 4,
    });

    expect(status.summaryKind).toBe('upToDate');
    expect(status.primaryAction).toBe('none');
    expect(status.isUpToDate).toBe(true);
  });

  it('maps PACKAGE_HASH_MISMATCH to validation recovery guidance', () => {
    expect(DESKTOP_SYNC_ERROR_MESSAGES.PACKAGE_HASH_MISMATCH).toEqual({
      title: 'Package validation failed',
      recovery: 'Re-download the package from the Web management app.',
    });
  });

  it('accepts all known desktop milestones', () => {
    const knownMilestones: DesktopSyncMilestone[] = [
      'manifestFetched',
      'filesDownloaded',
      'hashValidated',
      'packageStaged',
      'confirmationRequested',
      'packageApplied',
      'packageFailed',
    ];

    expect(knownMilestones.map(normalizeDesktopMilestone)).toEqual(knownMilestones);
  });

  it('rejects unknown desktop milestones', () => {
    expect(() => normalizeDesktopMilestone('unexpectedMilestone')).toThrow(ValidationError);
    expect(() => normalizeDesktopMilestone('unexpectedMilestone')).toThrow(
      'Unknown desktop sync milestone: unexpectedMilestone'
    );
  });
});
