// ── Mocks (jest.mock hoisted — inline factories) ─────────
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    avatar: {
      count: jest.fn(),
    },
    petSessionLog: {
      count: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { getUserTitleStatuses, equipTitle, checkAndGrantTitles } from '@/lib/titles/service';
import { TITLE_DEFINITIONS } from '@/lib/constants';
import prisma from '@/lib/prisma';

describe('getUserTitleStatuses', () => {
  it('returns all titles with correct unlock status', () => {
    const unlocked = ['new_arrival', 'resident'];
    const statuses = getUserTitleStatuses(unlocked);

    expect(statuses.length).toBe(TITLE_DEFINITIONS.length);
    expect(statuses.find(s => s.definition.id === 'new_arrival')?.unlocked).toBe(true);
    expect(statuses.find(s => s.definition.id === 'resident')?.unlocked).toBe(true);
    expect(statuses.find(s => s.definition.id === 'hundred_days')?.unlocked).toBe(false);
  });

  it('returns all locked for empty unlocked list', () => {
    const statuses = getUserTitleStatuses([]);
    expect(statuses.every(s => !s.unlocked)).toBe(true);
  });

  it('every title definition has required fields', () => {
    for (const def of TITLE_DEFINITIONS) {
      expect(def.id).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(def.condition).toBeTruthy();
      expect(typeof def.adminOnly).toBe('boolean');
    }
  });
});

describe('equipTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('equips an unlocked title', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      unlockedTitles: ['new_arrival', 'resident'],
    });

    const result = await equipTitle('u1', 'new_arrival');
    expect(result).toBe('new_arrival');
  });

  it('throws when title is not unlocked', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      unlockedTitles: ['new_arrival'],
    });

    await expect(equipTitle('u1', 'hundred_days')).rejects.toThrow('Title not unlocked');
  });

  it('unequips when titleId is null', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      unlockedTitles: ['new_arrival'],
    });

    const result = await equipTitle('u1', null);
    expect(result).toBeNull();
  });
});

describe('checkAndGrantTitles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants new_arrival at 1 login day', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      unlockedTitles: [],
      totalLoginDays: 1,
    });

    const result = await checkAndGrantTitles('u1');
    expect(result).toContain('new_arrival');
  });

  it('grants resident at 30 login days', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      unlockedTitles: ['new_arrival'],
      totalLoginDays: 30,
    });

    const result = await checkAndGrantTitles('u1');
    expect(result).toContain('resident');
  });

  it('grants hundred_days at 100 login days', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      unlockedTitles: [],
      totalLoginDays: 100,
    });

    const result = await checkAndGrantTitles('u1');
    expect(result).toContain('hundred_days');
  });

  it('does not re-grant already unlocked titles', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      unlockedTitles: ['new_arrival'],
      totalLoginDays: 1,
    });

    await checkAndGrantTitles('u1');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('grants achievement titles based on counts', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      unlockedTitles: [],
      totalLoginDays: 0,
    });
    (prisma.avatar.count as jest.Mock).mockResolvedValueOnce(20);
    (prisma.petSessionLog.count as jest.Mock).mockResolvedValueOnce(10000);

    const result = await checkAndGrantTitles('u1');
    expect(result).toContain('stylist');
    expect(result).toContain('pet_whisperer');
  });

  it('does not grant stylist below threshold', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      unlockedTitles: [],
      totalLoginDays: 0,
    });
    (prisma.avatar.count as jest.Mock).mockResolvedValueOnce(5);
    (prisma.petSessionLog.count as jest.Mock).mockResolvedValueOnce(0);

    const result = await checkAndGrantTitles('u1');
    expect(result).not.toContain('stylist');
    expect(result).not.toContain('pet_whisperer');
  });
});
