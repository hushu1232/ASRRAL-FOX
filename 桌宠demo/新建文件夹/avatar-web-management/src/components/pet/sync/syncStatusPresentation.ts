import type { StatusChipTone } from '@/components/ui/StatusChip';
import type {
  DesktopPackageState,
  DesktopSummaryKind,
  DesktopSyncStatus,
} from '@/lib/webbridge/sync-status';

export type SyncLifecycleStage = 'published' | 'staged' | 'applied';

export interface SyncLifecycleStep {
  key: SyncLifecycleStage;
  titleKey: string;
  descriptionKey: string;
  state: 'finish' | 'process' | 'wait' | 'error';
}

export const SUMMARY_TONES: Record<DesktopSummaryKind, StatusChipTone> = {
  unknown: 'neutral',
  desktopOffline: 'warning',
  pendingPull: 'processing',
  localConfirmationRequired: 'warning',
  upToDate: 'success',
  failed: 'error',
};

export const PACKAGE_STATE_TONES: Record<DesktopPackageState, StatusChipTone> = {
  notPublished: 'neutral',
  published: 'processing',
  pulled: 'warning',
  staged: 'warning',
  applied: 'success',
  failed: 'error',
};

export function getPackageStateLabelKey(state: DesktopPackageState): string {
  return `packageStateLabel.${state}`;
}

export function getPackageStateDescriptionKey(state: DesktopPackageState): string {
  return `packageStateDescription.${state}`;
}

export function getRuntimeDetailKey(summaryKind: DesktopSummaryKind): string {
  return `detail.${summaryKind}`;
}

export function getPreviewChipLabelKey(summaryKind: DesktopSummaryKind): string {
  return `previewChip.${summaryKind}`;
}

export function getLifecycleSteps(status: DesktopSyncStatus): SyncLifecycleStep[] {
  if (status.packageState === 'notPublished') {
    return [
      {
        key: 'published',
        titleKey: 'lifecycle.published.title',
        descriptionKey: 'lifecycle.published.description',
        state: 'wait',
      },
      {
        key: 'staged',
        titleKey: 'lifecycle.staged.title',
        descriptionKey: 'lifecycle.staged.description',
        state: 'wait',
      },
      {
        key: 'applied',
        titleKey: 'lifecycle.applied.title',
        descriptionKey: 'lifecycle.applied.description',
        state: 'wait',
      },
    ];
  }

  return [
    {
      key: 'published',
      titleKey: 'lifecycle.published.title',
      descriptionKey: 'lifecycle.published.description',
      state: status.packageState === 'failed' ? 'error' : 'finish',
    },
    {
      key: 'staged',
      titleKey: 'lifecycle.staged.title',
      descriptionKey: 'lifecycle.staged.description',
      state: getStagedLifecycleState(status),
    },
    {
      key: 'applied',
      titleKey: 'lifecycle.applied.title',
      descriptionKey: 'lifecycle.applied.description',
      state: getAppliedLifecycleState(status),
    },
  ];
}

function getStagedLifecycleState(status: DesktopSyncStatus): SyncLifecycleStep['state'] {
  if (status.packageState === 'failed') {
    return hasMilestone(status, 'packageStaged') ? 'error' : 'wait';
  }

  if (
    status.packageState === 'staged' ||
    status.packageState === 'applied' ||
    hasMilestone(status, 'packageStaged') ||
    hasMilestone(status, 'confirmationRequested') ||
    hasMilestone(status, 'packageApplied')
  ) {
    return status.requiresLocalConfirmation ? 'process' : 'finish';
  }

  if (status.packageState === 'pulled') {
    return 'process';
  }

  if (status.summaryKind === 'pendingPull') {
    return 'process';
  }

  return 'wait';
}

function getAppliedLifecycleState(status: DesktopSyncStatus): SyncLifecycleStep['state'] {
  if (status.packageState === 'failed') {
    return 'error';
  }

  if (status.isUpToDate || status.packageState === 'applied') {
    return 'finish';
  }

  if (status.requiresLocalConfirmation) {
    return 'process';
  }

  return 'wait';
}

function hasMilestone(status: DesktopSyncStatus, milestone: DesktopSyncStatus['milestones'][number]) {
  return status.milestones.includes(milestone);
}
