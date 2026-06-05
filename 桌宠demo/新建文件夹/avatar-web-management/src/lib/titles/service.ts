import prisma from '@/lib/prisma';
import { TITLE_DEFINITIONS, TitleDef } from '@/lib/constants';
import { createLogger } from '@/lib/logger';

const log = createLogger('titles');

interface UserTitleStatus {
  definition: TitleDef;
  unlocked: boolean;
}

/** Check and auto-grant login-milestone titles based on user stats */
export async function checkAndGrantTitles(userId: string): Promise<string[]> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { unlockedTitles: true, totalLoginDays: true },
  });

  const unlocked = new Set<string>(user.unlockedTitles);
  let changed = false;

  // Login milestones
  const loginMilestones: [string, number][] = [
    ['new_arrival', 1],
    ['resident', 30],
    ['hundred_days', 100],
    ['yearly', 365],
    ['three_years', 1095],
  ];
  for (const [id, days] of loginMilestones) {
    if (user.totalLoginDays >= days && !unlocked.has(id)) {
      unlocked.add(id);
      changed = true;
    }
  }

  // Achievement titles — check against existing DB tables
  // stylist: 20 published avatars
  if (!unlocked.has('stylist')) {
    const avatarCount = await prisma.avatar.count({ where: { creatorId: userId, status: 'published' } });
    if (avatarCount >= 20) { unlocked.add('stylist'); changed = true; }
  }

  // pet_whisperer: 10000 pet session logs
  if (!unlocked.has('pet_whisperer')) {
    const logCount = await prisma.petSessionLog.count({ where: { userId } });
    if (logCount >= 10000) { unlocked.add('pet_whisperer'); changed = true; }
  }

  // Admin titles are never auto-granted — set manually by admin

  if (changed) {
    const newTitles = Array.from(unlocked);
    await prisma.user.update({
      where: { id: userId },
      data: { unlockedTitles: newTitles },
    });
    log.info({ userId, newTitles }, 'Titles granted');
    return newTitles;
  }

  return user.unlockedTitles;
}

export function getUserTitleStatuses(unlockedTitles: string[]): UserTitleStatus[] {
  const unlockedSet = new Set(unlockedTitles);
  return TITLE_DEFINITIONS.map((def) => ({
    definition: def,
    unlocked: unlockedSet.has(def.id),
  }));
}

export async function equipTitle(userId: string, titleId: string | null): Promise<string | null> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { unlockedTitles: true },
  });

  if (titleId !== null && !user.unlockedTitles.includes(titleId)) {
    throw new Error('Title not unlocked');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { activeTitle: titleId },
  });

  return titleId;
}
