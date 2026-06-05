import prisma from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger('db:seed-forum');

export async function seedForumData(): Promise<void> {
  const boardCount = await prisma.board.count();
  if (boardCount > 0) {
    log.info('Forum data already exists, skipping seed');
    return;
  }

  log.info('Seeding forum data...');

  await prisma.board.createMany({
    data: [
      {
        name: '求助问答',
        slug: 'qa',
        description: '遇到问题？在这里提问，社区成员会帮助你解答',
        type: 'qa',
        sortOrder: 0,
        icon: 'QuestionCircleOutlined',
        color: '#22c55e',
      },
      {
        name: '晒单分享',
        slug: 'discussion',
        description: '分享你的桌宠搭配、使用心得和创意玩法',
        type: 'discussion',
        sortOrder: 1,
        icon: 'MessageOutlined',
        color: '#8b5cf6',
      },
      {
        name: '官方公告',
        slug: 'official',
        description: '版本更新、活动通知和维护公告',
        type: 'official',
        sortOrder: 2,
        icon: 'NotificationOutlined',
        color: '#f59e0b',
      },
    ],
  });

  log.info('Forum seed completed — 3 boards created');
}
