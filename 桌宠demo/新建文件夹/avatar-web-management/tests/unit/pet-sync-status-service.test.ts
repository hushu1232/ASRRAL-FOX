import { petSyncStatusService } from '@/lib/services/petSyncStatusService';

const mockPrismaClient = {
  petConfig: {
    findUnique: jest.fn(),
  },
  petSyncStatus: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

jest.mock('@/lib/db', () => ({
  getPrisma: jest.fn(() => mockPrismaClient),
}));

const userId = 'user-1';
const workspaceId = 'workspace-1';
const petConfigId = 'pet-config-1';
const updatedAt = new Date('2026-06-27T10:00:00.000Z');
const reportedAt = new Date('2026-06-27T10:01:00.000Z');
const reportedAtIso = reportedAt.toISOString();

function makePetConfig(overrides?: Record<string, unknown>) {
  return {
    id: petConfigId,
    userId,
    workspaceId,
    updatedAt,
    ...overrides,
  };
}

function makeSyncStatusRow(overrides?: Record<string, unknown>) {
  return {
    id: 'sync-status-1',
    petConfigId,
    desktopKnownVersion: null,
    desktopAppliedVersion: null,
    packageState: 'published',
    requiresLocalConfirmation: true,
    lastSyncAt: reportedAt,
    lastAppliedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastErrorDetail: null,
    updatedAt: reportedAt,
    createdAt: reportedAt,
    ...overrides,
  };
}

describe('petSyncStatusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default published status when no desktop report exists', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(null);

    const status = await petSyncStatusService.getStatus(userId, workspaceId);

    expect(status.packageState).toBe('published');
    expect(status.webConfigVersion).toBe(updatedAt.getTime());
    expect(status.desktopKnownVersion).toBeNull();
    expect(status.desktopAppliedVersion).toBeNull();
    expect(status.requiresLocalConfirmation).toBe(true);
    expect(status.summaryKind).toBe('pendingPull');
    expect(mockPrismaClient.petConfig.findUnique).toHaveBeenCalledWith({ where: { userId } });
    expect(mockPrismaClient.petSyncStatus.findUnique).toHaveBeenCalledWith({
      where: { petConfigId },
    });
  });

  it('packageStaged report updates known version and returns localConfirmationRequired', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(123),
      packageState: 'staged',
      requiresLocalConfirmation: true,
    }));

    const status = await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'packageStaged',
      packageVersion: 123,
      reportedAt: reportedAtIso,
    });

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith({
      where: { petConfigId },
      create: expect.objectContaining({
        petConfigId,
        desktopKnownVersion: BigInt(123),
        packageState: 'staged',
        requiresLocalConfirmation: true,
        lastSyncAt: reportedAt,
      }),
      update: expect.objectContaining({
        desktopKnownVersion: BigInt(123),
        packageState: 'staged',
        requiresLocalConfirmation: true,
        lastSyncAt: reportedAt,
      }),
    });
    expect(status.desktopKnownVersion).toBe(123);
    expect(status.packageState).toBe('staged');
    expect(status.summaryKind).toBe('localConfirmationRequired');
    expect(status.primaryAction).toBe('confirmInDesktop');
  });

  it('packageApplied report updates applied version', async () => {
    const appliedConfigUpdatedAt = new Date('2026-06-27T09:00:00.000Z');
    const appliedVersion = appliedConfigUpdatedAt.getTime();
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(
      makePetConfig({ updatedAt: appliedConfigUpdatedAt })
    );
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(appliedVersion),
      desktopAppliedVersion: BigInt(appliedVersion),
      packageState: 'applied',
      requiresLocalConfirmation: false,
      lastAppliedAt: reportedAt,
    }));

    const status = await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'packageApplied',
      packageVersion: appliedVersion,
      reportedAt: reportedAtIso,
    });

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith({
      where: { petConfigId },
      create: expect.objectContaining({
        petConfigId,
        desktopKnownVersion: BigInt(appliedVersion),
        desktopAppliedVersion: BigInt(appliedVersion),
        packageState: 'applied',
        requiresLocalConfirmation: false,
        lastSyncAt: reportedAt,
        lastAppliedAt: reportedAt,
      }),
      update: expect.objectContaining({
        desktopKnownVersion: BigInt(appliedVersion),
        desktopAppliedVersion: BigInt(appliedVersion),
        packageState: 'applied',
        requiresLocalConfirmation: false,
        lastSyncAt: reportedAt,
        lastAppliedAt: reportedAt,
      }),
    });
    expect(status.desktopAppliedVersion).toBe(appliedVersion);
    expect(status.packageState).toBe('applied');
    expect(status.summaryKind).toBe('upToDate');
    expect(status.isUpToDate).toBe(true);
  });

  it('rejects numeric reportedAt values', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());

    await expect(petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'manifestFetched',
      reportedAt: 123 as unknown as string,
    })).rejects.toThrow('Desktop reportedAt must be an ISO string');
    expect(mockPrismaClient.petSyncStatus.upsert).not.toHaveBeenCalled();
  });

  it('rejects parseable non-ISO reportedAt strings', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());

    await expect(petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'manifestFetched',
      reportedAt: 'June 27, 2026',
    })).rejects.toThrow('Desktop reportedAt must be an ISO string');
    expect(mockPrismaClient.petSyncStatus.upsert).not.toHaveBeenCalled();
  });
});
