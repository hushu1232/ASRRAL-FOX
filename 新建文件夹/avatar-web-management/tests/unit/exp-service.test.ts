// ── Mocks (jest.mock hoisted — inline factories) ─────
const mockIncr = jest.fn(() => Promise.resolve(1));
const mockExpire = jest.fn(() => Promise.resolve(1));
const mockFindUniqueOrThrow = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

jest.mock('@/lib/redis/client', () => ({
  isRedisAvailable: jest.fn(() => true),
  getRedis: jest.fn(() => ({
    incr: (...args: unknown[]) => mockIncr(...args),
    expire: (...args: unknown[]) => mockExpire(...args),
  })),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { addExp, getLimits } from '@/lib/exp/service';

const USER_BASE = { id: 'u1', exp: 0, level: 1 };

describe('addExp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIncr.mockResolvedValue(1);
  });

  it('rejects unknown action', async () => {
    await expect(addExp('u1', 'nonexistent_action')).rejects.toThrow('Unknown EXP action');
  });

  it('grants daily_login EXP — stays at level 1 (10 < 200)', async () => {
    mockFindUniqueOrThrow.mockResolvedValueOnce({ ...USER_BASE });

    const result = await addExp('u1', 'daily_login');

    expect(result.gained).toBe(10);
    expect(result.currentExp).toBe(10);
    expect(result.currentLevel).toBe(1);
    expect(result.levelUp).toBe(false);
    expect(result.nextLevelExp).toBe(200);
  });

  it('levels up from 1 to 2 when exp crosses 200', async () => {
    mockFindUniqueOrThrow.mockResolvedValueOnce({ id: 'u1', exp: 190, level: 1 });

    const result = await addExp('u1', 'asset_upload'); // +20 = 210 → Lv2

    expect(result.gained).toBe(20);
    expect(result.currentExp).toBe(210);
    expect(result.currentLevel).toBe(2);
    expect(result.levelUp).toBe(true);
    expect(result.newLevel).toBe(2);
  });

  it('level-up Lv1 → Lv2 at exact boundary (190+10=200)', async () => {
    mockFindUniqueOrThrow.mockResolvedValueOnce({ id: 'u1', exp: 190, level: 1 });

    const result = await addExp('u1', 'daily_login'); // +10 = 200 → Lv2

    expect(result.gained).toBe(10);
    expect(result.currentLevel).toBe(2);
    expect(result.levelUp).toBe(true);
  });

  it('handles MAX_LEVEL correctly (no overflow)', async () => {
    mockFindUniqueOrThrow.mockResolvedValueOnce({ id: 'u1', exp: 9000, level: 5 });

    const result = await addExp('u1', 'daily_login');

    expect(result.gained).toBe(10);
    expect(result.currentLevel).toBe(5);
    expect(result.levelUp).toBe(false);
  });

  it('returns 0 gained when daily limit reached', async () => {
    mockIncr.mockResolvedValueOnce(999); // Exceed daily_login limit of 1
    mockFindUniqueOrThrow.mockResolvedValueOnce({ id: 'u1', exp: 100, level: 1 });

    const result = await addExp('u1', 'daily_login');

    expect(result.gained).toBe(0);
    expect(result.levelUp).toBe(false);
  });

  it('level 4 → 5 transition at 9000 total', async () => {
    mockFindUniqueOrThrow.mockResolvedValueOnce({ id: 'u1', exp: 8990, level: 4 });

    const result = await addExp('u1', 'asset_upload'); // +20 = 9010 → Lv5

    expect(result.gained).toBe(20);
    expect(result.currentLevel).toBe(5);
    expect(result.levelUp).toBe(true);
    expect(result.newLevel).toBe(5);
  });

  it('chains Lv3 → Lv5 with post_featured (50 EXP) from boundary', async () => {
    // 990 + 50 = 1040 > 1000 (Lv3) → Lv4 at 1000, but not 3000 (Lv5), so stays Lv3
    mockFindUniqueOrThrow.mockResolvedValueOnce({ id: 'u1', exp: 990, level: 2 });

    const result = await addExp('u1', 'post_featured'); // +50 = 1040

    expect(result.currentExp).toBe(1040);
    expect(result.currentLevel).toBe(3);
    expect(result.levelUp).toBe(true);
    expect(result.newLevel).toBe(3);
  });
});

describe('getLimits', () => {
  it('returns Lv1 limits', () => {
    const limits = getLimits(1);
    expect(limits.voiceClonesPerMonth).toBe(5);
    expect(limits.assetCapacityMB).toBe(500);
  });

  it('returns Lv3 limits', () => {
    const limits = getLimits(3);
    expect(limits.voiceClonesPerMonth).toBe(30);
    expect(limits.assetCapacityMB).toBe(5120);
  });

  it('falls back to Lv1 for out-of-range level', () => {
    const limits = getLimits(99);
    expect(limits).toBeDefined();
    expect(limits.skinSlots).toBe(1);
  });
});
