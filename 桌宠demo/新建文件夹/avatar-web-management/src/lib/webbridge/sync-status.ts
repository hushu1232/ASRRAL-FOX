import { ValidationError } from '@/lib/errors';

export type DesktopConnectionState = 'unknown' | 'checking' | 'online' | 'offline';
export type DesktopPackageState =
  | 'notPublished'
  | 'published'
  | 'pulled'
  | 'staged'
  | 'applied'
  | 'failed';
export type DesktopPrimaryAction =
  | 'none'
  | 'checkAgain'
  | 'openDesktop'
  | 'confirmInDesktop'
  | 'viewDetails';
export type DesktopSummaryKind =
  | 'unknown'
  | 'desktopOffline'
  | 'pendingPull'
  | 'localConfirmationRequired'
  | 'upToDate'
  | 'failed';
export type DesktopSyncMilestone =
  | 'manifestFetched'
  | 'filesDownloaded'
  | 'hashValidated'
  | 'packageStaged'
  | 'confirmationRequested'
  | 'packageApplied'
  | 'packageFailed';
export type DesktopSyncErrorCode =
  | 'WEBBRIDGE_OFFLINE'
  | 'PACKAGE_HASH_MISMATCH'
  | 'LOCAL_CONFIRMATION_REQUIRED'
  | 'PACKAGE_APPLY_FAILED'
  | 'PACKAGE_DOWNLOAD_FAILED'
  | 'PACKAGE_SECURITY_BLOCKED';

export interface DesktopSyncError {
  code: DesktopSyncErrorCode;
  message?: string;
  milestone?: DesktopSyncMilestone;
  occurredAt?: string;
}

export interface DesktopSyncStatusInput {
  webConfigVersion: number;
  packageState?: DesktopPackageState;
  desktopConnection?: DesktopConnectionState;
  desktopKnownVersion?: number | null;
  desktopAppliedVersion?: number | null;
  requiresLocalConfirmation?: boolean;
  lastSyncAt?: Date | number | string | null;
  lastAppliedAt?: string | null;
  lastError?: DesktopSyncError | null;
  milestones?: readonly DesktopSyncMilestone[];
  now?: Date | number | string;
}

export interface DesktopSyncErrorMessage {
  title: string;
  recovery: string;
}

export interface DesktopSyncStatus {
  desktopConnection: DesktopConnectionState;
  packageState: DesktopPackageState;
  summaryKind: DesktopSummaryKind;
  primaryAction: DesktopPrimaryAction;
  isUpToDate: boolean;
  webConfigVersion: number;
  desktopKnownVersion: number | null;
  desktopAppliedVersion: number | null;
  requiresLocalConfirmation: boolean;
  lastSyncAt: Date | number | string | null;
  lastAppliedAt: string | null;
  lastError: DesktopSyncError | null;
  errorMessage: DesktopSyncErrorMessage | null;
  milestones: readonly DesktopSyncMilestone[];
}

export const DESKTOP_SYNC_ERROR_MESSAGES: Record<DesktopSyncErrorCode, DesktopSyncErrorMessage> = {
  WEBBRIDGE_OFFLINE: {
    title: 'Desktop app is offline',
    recovery: 'Open the desktop pet app, then check again from the Web management app.',
  },
  PACKAGE_HASH_MISMATCH: {
    title: 'Package validation failed',
    recovery: 'Re-download the package from the Web management app.',
  },
  LOCAL_CONFIRMATION_REQUIRED: {
    title: 'Desktop confirmation required',
    recovery: 'Confirm the staged package in the desktop pet app.',
  },
  PACKAGE_APPLY_FAILED: {
    title: 'Package apply failed',
    recovery: 'Open desktop details and retry applying the package.',
  },
  PACKAGE_DOWNLOAD_FAILED: {
    title: 'Package download failed',
    recovery: 'Check the desktop network connection and retry the download.',
  },
  PACKAGE_SECURITY_BLOCKED: {
    title: 'Package blocked by desktop security',
    recovery: 'Review the package details and publish a trusted package.',
  },
};

const KNOWN_DESKTOP_MILESTONES: readonly DesktopSyncMilestone[] = [
  'manifestFetched',
  'filesDownloaded',
  'hashValidated',
  'packageStaged',
  'confirmationRequested',
  'packageApplied',
  'packageFailed',
];

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function normalizeDesktopMilestone(value: unknown): DesktopSyncMilestone {
  if (KNOWN_DESKTOP_MILESTONES.includes(value as DesktopSyncMilestone)) {
    return value as DesktopSyncMilestone;
  }

  throw new ValidationError(`Unknown desktop sync milestone: ${String(value)}`);
}

export function buildDesktopSyncStatus(input: DesktopSyncStatusInput): DesktopSyncStatus {
  const packageState = input.packageState ?? 'notPublished';
  const desktopConnection = input.desktopConnection ?? deriveDesktopConnection(input);
  const lastError = input.lastError ?? null;
  const desktopKnownVersion = input.desktopKnownVersion ?? null;
  const desktopAppliedVersion = input.desktopAppliedVersion ?? null;
  const requiresLocalConfirmation = input.requiresLocalConfirmation ?? true;
  const statusBase = {
    desktopConnection,
    packageState,
    webConfigVersion: input.webConfigVersion,
    desktopKnownVersion,
    desktopAppliedVersion,
    requiresLocalConfirmation,
    lastSyncAt: input.lastSyncAt ?? null,
    lastAppliedAt: input.lastAppliedAt ?? null,
    lastError,
    errorMessage: lastError ? DESKTOP_SYNC_ERROR_MESSAGES[lastError.code] : null,
    milestones: input.milestones ?? [],
  };

  if (lastError || packageState === 'failed') {
    return {
      ...statusBase,
      summaryKind: 'failed',
      primaryAction: 'viewDetails',
      isUpToDate: false,
    };
  }

  if (desktopConnection === 'offline') {
    return {
      ...statusBase,
      summaryKind: 'desktopOffline',
      primaryAction: 'checkAgain',
      isUpToDate: false,
    };
  }

  if (
    packageState === 'applied' &&
    desktopAppliedVersion !== null &&
    desktopAppliedVersion >= input.webConfigVersion
  ) {
    return {
      ...statusBase,
      summaryKind: 'upToDate',
      primaryAction: 'none',
      isUpToDate: true,
    };
  }

  if (packageState === 'staged' || packageState === 'pulled') {
    return {
      ...statusBase,
      summaryKind: 'localConfirmationRequired',
      primaryAction: 'confirmInDesktop',
      isUpToDate: false,
    };
  }

  if (
    packageState === 'published' ||
    desktopKnownVersion === null ||
    desktopKnownVersion < input.webConfigVersion
  ) {
    return {
      ...statusBase,
      summaryKind: 'pendingPull',
      primaryAction: 'checkAgain',
      isUpToDate: false,
    };
  }

  return {
    ...statusBase,
    summaryKind: 'unknown',
    primaryAction: 'checkAgain',
    isUpToDate: false,
  };
}

function deriveDesktopConnection(input: DesktopSyncStatusInput): DesktopConnectionState {
  const lastSyncTime = timestampMs(input.lastSyncAt);

  if (lastSyncTime === null) {
    return 'unknown';
  }

  const nowTime = timestampMs(input.now ?? Date.now());

  if (nowTime === null) {
    return 'unknown';
  }

  return nowTime - lastSyncTime <= ONLINE_WINDOW_MS ? 'online' : 'offline';
}

function timestampMs(value: Date | number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();

  return Number.isFinite(time) ? time : null;
}
