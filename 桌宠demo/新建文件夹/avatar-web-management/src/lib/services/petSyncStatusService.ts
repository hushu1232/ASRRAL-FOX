import { getPrisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import {
  buildDesktopSyncStatus,
  normalizeDesktopMilestone,
  type DesktopPackageState,
  type DesktopSyncError,
  type DesktopSyncErrorCode,
  type DesktopSyncMilestone,
  type DesktopSyncStatus,
} from '@/lib/webbridge/sync-status';

export interface ReportPetSyncMilestoneInput {
  milestone: DesktopSyncMilestone | string;
  packageVersion?: number | null;
  reportedAt?: string | null;
  error?: {
    code?: DesktopSyncErrorCode;
    message?: string;
    detail?: string;
  } | null;
}

interface PetConfigRow {
  id: string;
  userId: string;
  workspaceId: string;
  updatedAt: Date;
}

interface PetSyncStatusRow {
  id: string;
  petConfigId: string;
  desktopKnownVersion: bigint | number | null;
  desktopAppliedVersion: bigint | number | null;
  packageState: string;
  requiresLocalConfirmation: boolean;
  lastSyncAt: Date | null;
  lastAppliedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorDetail: string | null;
  updatedAt: Date;
  createdAt: Date;
}

interface PetSyncStatusPrisma {
  petConfig: {
    findUnique(args: { where: { userId: string } }): Promise<PetConfigRow | null>;
  };
  petSyncStatus: {
    findUnique(args: { where: { petConfigId: string } }): Promise<PetSyncStatusRow | null>;
    upsert(args: {
      where: { petConfigId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<PetSyncStatusRow>;
  };
}

const MILESTONE_PACKAGE_STATES: Record<DesktopSyncMilestone, DesktopPackageState> = {
  manifestFetched: 'published',
  filesDownloaded: 'pulled',
  hashValidated: 'pulled',
  packageStaged: 'staged',
  confirmationRequested: 'staged',
  packageApplied: 'applied',
  packageFailed: 'failed',
};

const DESKTOP_PACKAGE_STATES = new Set<DesktopPackageState>([
  'notPublished',
  'published',
  'pulled',
  'staged',
  'applied',
  'failed',
]);

export const petSyncStatusService = {
  async getStatus(userId: string, workspaceId: string): Promise<DesktopSyncStatus> {
    const prisma = getPetSyncStatusPrisma();
    const petConfig = await findPetConfig(prisma, userId, workspaceId);
    const webConfigVersion = webConfigVersionFromPetConfig(petConfig);
    const row = await prisma.petSyncStatus.findUnique({ where: { petConfigId: petConfig.id } });

    if (!row) {
      return buildDesktopSyncStatus({
        webConfigVersion,
        packageState: 'published',
        desktopKnownVersion: null,
        desktopAppliedVersion: null,
        requiresLocalConfirmation: true,
        lastAppliedAt: null,
      });
    }

    return statusFromRow(row, webConfigVersion);
  },

  async reportMilestone(
    userId: string,
    workspaceId: string,
    input: ReportPetSyncMilestoneInput
  ): Promise<DesktopSyncStatus> {
    const prisma = getPetSyncStatusPrisma();
    const petConfig = await findPetConfig(prisma, userId, workspaceId);
    const webConfigVersion = webConfigVersionFromPetConfig(petConfig);
    const milestone = normalizeDesktopMilestone(input.milestone);
    const reportedAt = normalizeReportedAt(input.reportedAt);
    const packageVersion = normalizePackageVersion(input.packageVersion);
    const effectiveVersion = BigInt(packageVersion ?? webConfigVersion);
    const packageState = MILESTONE_PACKAGE_STATES[milestone];

    const data: Record<string, unknown> = {
      desktopKnownVersion: effectiveVersion,
      packageState,
      requiresLocalConfirmation: packageState !== 'applied',
      lastSyncAt: reportedAt,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorDetail: null,
    };

    if (milestone === 'packageApplied') {
      data.desktopAppliedVersion = effectiveVersion;
      data.lastAppliedAt = reportedAt;
    }

    if (milestone === 'packageFailed') {
      const error = input.error ?? {};
      data.lastErrorCode = error.code ?? 'PACKAGE_APPLY_FAILED';
      data.lastErrorMessage = error.message ?? null;
      data.lastErrorDetail = error.detail ?? null;
    }

    const row = await prisma.petSyncStatus.upsert({
      where: { petConfigId: petConfig.id },
      create: {
        petConfigId: petConfig.id,
        ...data,
      },
      update: data,
    });

    return statusFromRow(row, webConfigVersion, reportedAt);
  },
};

function getPetSyncStatusPrisma(): PetSyncStatusPrisma {
  return getPrisma() as unknown as PetSyncStatusPrisma;
}

async function findPetConfig(
  prisma: PetSyncStatusPrisma,
  userId: string,
  workspaceId: string
): Promise<PetConfigRow> {
  const petConfig = await prisma.petConfig.findUnique({ where: { userId } });

  if (!petConfig || petConfig.workspaceId !== workspaceId) {
    throw new NotFoundError('PetConfig', userId);
  }

  return petConfig;
}

function webConfigVersionFromPetConfig(petConfig: PetConfigRow): number {
  const version = petConfig.updatedAt.getTime();

  if (!Number.isFinite(version)) {
    throw new ValidationError('Pet config updatedAt must be a valid date');
  }

  return version;
}

function normalizePackageVersion(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError('Desktop packageVersion must be a positive safe integer');
  }

  return value;
}

function normalizeReportedAt(value: string | null | undefined): Date {
  if (value === null || value === undefined) {
    return new Date();
  }

  if (typeof value !== 'string') {
    throw new ValidationError('Desktop reportedAt must be an ISO string');
  }

  const parsed = Date.parse(value);
  const reportedAt = new Date(value);

  if (!Number.isFinite(parsed) || reportedAt.toISOString() !== value) {
    throw new ValidationError('Desktop reportedAt must be an ISO string');
  }

  return reportedAt;
}

function statusFromRow(
  row: PetSyncStatusRow,
  webConfigVersion: number,
  now?: Date
): DesktopSyncStatus {
  const lastError = row.lastErrorCode
    ? ({
        code: row.lastErrorCode,
        message: row.lastErrorMessage ?? undefined,
        occurredAt: row.lastSyncAt?.toISOString(),
      } as DesktopSyncError)
    : null;

  return buildDesktopSyncStatus({
    webConfigVersion,
    packageState: toDesktopPackageState(row.packageState),
    desktopKnownVersion: numberFromBigInt(row.desktopKnownVersion),
    desktopAppliedVersion: numberFromBigInt(row.desktopAppliedVersion),
    requiresLocalConfirmation: row.requiresLocalConfirmation,
    lastSyncAt: row.lastSyncAt,
    lastAppliedAt: row.lastAppliedAt?.toISOString() ?? null,
    lastError,
    now,
  });
}

function toDesktopPackageState(value: string): DesktopPackageState {
  if (DESKTOP_PACKAGE_STATES.has(value as DesktopPackageState)) {
    return value as DesktopPackageState;
  }

  return 'notPublished';
}

function numberFromBigInt(value: bigint | number | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'bigint' ? Number(value) : value;
}
