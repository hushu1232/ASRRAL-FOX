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
    expect(status.lastAppliedAt).toBeNull();
    expect(status.summaryKind).toBe('pendingPull');
    expect(mockPrismaClient.petConfig.findUnique).toHaveBeenCalledWith({ where: { userId } });
    expect(mockPrismaClient.petSyncStatus.findUnique).toHaveBeenCalledWith({
      where: { petConfigId },
    });
  });

  it('packageStaged report updates known version and returns localConfirmationRequired', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(null);
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
    const appliedAt = new Date('2026-06-27T10:06:00.000Z');
    const appliedAtIso = appliedAt.toISOString();
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(
      makePetConfig({ updatedAt: appliedConfigUpdatedAt })
    );
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(null);
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(appliedVersion),
      desktopAppliedVersion: BigInt(appliedVersion),
      packageState: 'applied',
      requiresLocalConfirmation: false,
      lastSyncAt: appliedAt,
      lastAppliedAt: appliedAt,
    }));

    const status = await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'packageApplied',
      packageVersion: appliedVersion,
      reportedAt: appliedAtIso,
    });

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith({
      where: { petConfigId },
      create: expect.objectContaining({
        petConfigId,
        desktopKnownVersion: BigInt(appliedVersion),
        desktopAppliedVersion: BigInt(appliedVersion),
        packageState: 'applied',
        requiresLocalConfirmation: false,
        lastSyncAt: appliedAt,
        lastAppliedAt: appliedAt,
      }),
      update: expect.objectContaining({
        desktopKnownVersion: BigInt(appliedVersion),
        desktopAppliedVersion: BigInt(appliedVersion),
        packageState: 'applied',
        requiresLocalConfirmation: false,
        lastSyncAt: appliedAt,
        lastAppliedAt: appliedAt,
      }),
    });
    expect(status.desktopAppliedVersion).toBe(appliedVersion);
    expect(status.lastAppliedAt).toBe('2026-06-27T10:06:00.000Z');
    expect(status.packageState).toBe('applied');
    expect(status.summaryKind).toBe('upToDate');
    expect(status.isUpToDate).toBe(true);
  });

  it('ignores stale same-version milestones that would move applied status backward', async () => {
    const appliedVersion = updatedAt.getTime();
    const appliedAt = new Date('2026-06-27T10:02:00.000Z');
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(appliedVersion),
      desktopAppliedVersion: BigInt(appliedVersion),
      packageState: 'applied',
      requiresLocalConfirmation: false,
      lastSyncAt: appliedAt,
      lastAppliedAt: appliedAt,
    }));

    const status = await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'packageStaged',
      packageVersion: appliedVersion,
      reportedAt: reportedAtIso,
    });

    expect(mockPrismaClient.petSyncStatus.upsert).not.toHaveBeenCalled();
    expect(status.packageState).toBe('applied');
    expect(status.desktopAppliedVersion).toBe(appliedVersion);
    expect(status.summaryKind).toBe('upToDate');
  });

  it('ignores older package version milestones after a newer version was applied', async () => {
    const appliedVersion = updatedAt.getTime();
    const olderVersion = appliedVersion - 1;
    const appliedAt = new Date('2026-06-27T10:02:00.000Z');
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(appliedVersion),
      desktopAppliedVersion: BigInt(appliedVersion),
      packageState: 'applied',
      requiresLocalConfirmation: false,
      lastSyncAt: appliedAt,
      lastAppliedAt: appliedAt,
    }));

    const status = await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'packageApplied',
      packageVersion: olderVersion,
      reportedAt: reportedAtIso,
    });

    expect(mockPrismaClient.petSyncStatus.upsert).not.toHaveBeenCalled();
    expect(status.desktopAppliedVersion).toBe(appliedVersion);
    expect(status.summaryKind).toBe('upToDate');
  });

  it('refreshes lastSyncAt for same-version same-state reports', async () => {
    const version = updatedAt.getTime();
    const staleSyncAt = new Date('2026-06-27T09:50:00.000Z');
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(version),
      packageState: 'published',
      requiresLocalConfirmation: true,
      lastSyncAt: staleSyncAt,
    }));
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(version),
      packageState: 'published',
      requiresLocalConfirmation: true,
      lastSyncAt: reportedAt,
    }));

    const status = await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'manifestFetched',
      packageVersion: version,
      reportedAt: reportedAtIso,
    });

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        desktopKnownVersion: BigInt(version),
        packageState: 'published',
        lastSyncAt: reportedAt,
      }),
    }));
    expect(status.lastSyncAt).toBe(reportedAt);
    expect(status.desktopConnection).toBe('online');
  });

  it('refreshes packageFailed details for same-version failure reports', async () => {
    const version = updatedAt.getTime();
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(version),
      packageState: 'failed',
      requiresLocalConfirmation: true,
      lastSyncAt: new Date('2026-06-27T09:50:00.000Z'),
      lastErrorCode: 'PACKAGE_APPLY_FAILED',
      lastErrorMessage: 'Old failure',
    }));
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(version),
      packageState: 'failed',
      requiresLocalConfirmation: true,
      lastSyncAt: reportedAt,
      lastErrorCode: 'PACKAGE_HASH_MISMATCH',
      lastErrorMessage: 'New failure',
      lastErrorDetail: 'Expected abc',
    }));

    const status = await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'packageFailed',
      packageVersion: version,
      reportedAt: reportedAtIso,
      error: {
        code: 'PACKAGE_HASH_MISMATCH',
        message: 'New failure',
        detail: 'Expected abc',
      },
    });

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        lastErrorCode: 'PACKAGE_HASH_MISMATCH',
        lastErrorMessage: 'New failure',
        lastErrorDetail: 'Expected abc',
        lastSyncAt: reportedAt,
      }),
    }));
    expect(status.lastError?.code).toBe('PACKAGE_HASH_MISMATCH');
    expect(status.lastError?.message).toBe('New failure');
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

  it('rejects invalid reportedAt calendar dates', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());

    await expect(petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'manifestFetched',
      reportedAt: '2026-02-30T10:01:00Z',
    })).rejects.toThrow('Desktop reportedAt must be an ISO string');
    expect(mockPrismaClient.petSyncStatus.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid reportedAt time ranges', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());

    await expect(petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'manifestFetched',
      reportedAt: '2026-06-27T24:00:00Z',
    })).rejects.toThrow('Desktop reportedAt must be an ISO string');
    expect(mockPrismaClient.petSyncStatus.upsert).not.toHaveBeenCalled();
  });

  it('accepts no-millisecond Z reportedAt values', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(null);
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(updatedAt.getTime()),
      packageState: 'published',
      lastSyncAt: reportedAt,
    }));

    await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'manifestFetched',
      reportedAt: '2026-06-27T10:01:00Z',
    });

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ lastSyncAt: new Date('2026-06-27T10:01:00Z') }),
      update: expect.objectContaining({ lastSyncAt: new Date('2026-06-27T10:01:00Z') }),
    }));
  });

  it('accepts offset reportedAt values', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(null);
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(updatedAt.getTime()),
      packageState: 'published',
      lastSyncAt: reportedAt,
    }));

    await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'manifestFetched',
      reportedAt: '2026-06-27T18:01:00.000+08:00',
    });

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ lastSyncAt: reportedAt }),
      update: expect.objectContaining({ lastSyncAt: reportedAt }),
    }));
  });

  it('rejects unknown inbound desktop error codes', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());

    await expect(petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'packageFailed',
      reportedAt: reportedAtIso,
      error: {
        code: 'UNKNOWN_DESKTOP_ERROR' as never,
      },
    })).rejects.toThrow('Unknown desktop sync error code: UNKNOWN_DESKTOP_ERROR');
    expect(mockPrismaClient.petSyncStatus.upsert).not.toHaveBeenCalled();
  });

  it('falls back safely for unknown persisted desktop error codes', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(makeSyncStatusRow({
      packageState: 'failed',
      lastErrorCode: 'UNKNOWN_PERSISTED_ERROR',
      lastErrorMessage: 'raw persisted message',
    }));

    const status = await petSyncStatusService.getStatus(userId, workspaceId);

    expect(status.lastError?.code).toBe('PACKAGE_APPLY_FAILED');
    expect(status.lastError?.technicalDetail).toBe(
      'Unknown persisted desktop sync error code: UNKNOWN_PERSISTED_ERROR'
    );
  });
});
