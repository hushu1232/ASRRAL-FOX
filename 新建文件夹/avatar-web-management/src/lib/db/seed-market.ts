import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@/lib/logger';

const log = createLogger('db:seed-market');

const MARKET_ITEMS = [
  {
    title: '狐仙·白面金毛',
    description: '九尾妖狐 Live2D 模型，含全套表情和物理动画。适用于桌面宠物，支持拖拽交互和语音响应。',
    category: 'model',
    price: 0,
    currency: 'CNY',
    previewImages: ['/images/placeholder-template.svg'],
    files: ['/models/cattail/cattail.model3.json'],
    rating: 4.8,
    downloadCount: 2340,
    appliedCount: 1890,
  },
  {
    title: '赛博猫娘·Neon',
    description: '赛博朋克风格猫娘模型，霓虹发光材质，支持 Live2D 和 3D 双模式。含个性化语音包。',
    category: 'model',
    price: 4900,
    currency: 'CNY',
    previewImages: ['/images/placeholder-template.svg'],
    files: ['/models/cattail/cattail.model3.json'],
    rating: 4.5,
    downloadCount: 892,
    appliedCount: 654,
  },
  {
    title: '傲娇大小姐人格卡',
    description: '经典傲娇性格，包含 200+ 对话树，支持情境感知。适合搭配任何 Live2D 模型使用。',
    category: 'personality',
    price: 1500,
    currency: 'CNY',
    previewImages: ['/images/placeholder-template.svg'],
    files: ['/personalities/tsundere-v2.json'],
    rating: 4.9,
    downloadCount: 3560,
    appliedCount: 3120,
  },
  {
    title: '温柔邻家姐姐人格卡',
    description: '温柔体贴的邻家姐姐人格，含日常对话、天气预报、番茄钟提醒等功能模块。',
    category: 'personality',
    price: 0,
    currency: 'CNY',
    previewImages: ['/images/placeholder-template.svg'],
    files: ['/personalities/oneesan-v1.json'],
    rating: 4.7,
    downloadCount: 1890,
    appliedCount: 1560,
  },
  {
    title: '甜美女声·小樱',
    description: '甜美少女音色，基于 VITS 微调，支持中/日双语。含情绪语调自动调节（高兴/难过/生气）。',
    category: 'voice',
    price: 2900,
    currency: 'CNY',
    previewImages: ['/images/placeholder-template.svg'],
    files: ['/voices/sakura-vits.onnx'],
    rating: 4.6,
    downloadCount: 4320,
    appliedCount: 3890,
  },
  {
    title: '低沉男声·影',
    description: '沉稳男中音，适合绅士/执事型人格。VITS 模型，支持 3 种语言切换。',
    category: 'voice',
    price: 2900,
    currency: 'CNY',
    previewImages: ['/images/placeholder-template.svg'],
    files: ['/voices/kage-vits.onnx'],
    rating: 4.3,
    downloadCount: 1200,
    appliedCount: 980,
  },
  {
    title: '猫爪挥手动画包',
    description: '6 种猫爪交互动画：挥手、拍打、挠屏幕、比心、捂脸、伸懒腰。基于 DragonBones 骨骼动画。',
    category: 'animation',
    price: 800,
    currency: 'CNY',
    previewImages: ['/images/placeholder-template.svg', '/images/placeholder-template.svg'],
    files: ['/animations/cat-paw-pack.dbbin'],
    rating: 4.4,
    downloadCount: 5670,
    appliedCount: 5010,
  },
  {
    title: '赛博霓虹主题',
    description: '赛博朋克风格 UI 主题：霓虹紫/青色渐变，搭配桌面宠物控制面板和悬浮窗皮肤。',
    category: 'theme',
    price: 0,
    currency: 'CNY',
    previewImages: ['/images/placeholder-template.svg'],
    files: ['/themes/cyber-neon.json'],
    rating: 4.2,
    downloadCount: 3200,
    appliedCount: 2750,
  },
];

export async function seedMarketData(): Promise<void> {
  try {
    // Check if market data already exists
    const existingCount = await prisma.marketItem.count();
    if (existingCount > 0) {
      log.info('Market data already seeded (%d items), skipping', existingCount);
      return;
    }

    // Get users from Prisma (PostgreSQL)
    const users = await prisma.user.findMany({ select: { id: true, username: true, role: true } });
    log.info('Found %d users in database', users.length);

    if (users.length === 0) {
      log.warn('No users in database — run main seed first, then re-run market seed');
      return;
    }

    const demoUser = users.find(u => u.role === 'user') || users[0];
    const designerUser = users.find(u => u.role === 'user' && u.username === 'designer_01') || demoUser;
    // Users and workspaces already exist in PostgreSQL (seeded by seed.ts)

    log.info('Synced users to PostgreSQL');

    // Create market items
    const itemIds: string[] = [];
    for (const itemDef of MARKET_ITEMS) {
      const id = uuidv4();
      itemIds.push(id);
      const seller = (itemDef.price === 0 || itemDef.category === 'model') ? designerUser : demoUser;
      await prisma.marketItem.create({
        data: {
          id,
          sellerId: seller.id,
          title: itemDef.title,
          description: itemDef.description,
          category: itemDef.category,
          price: itemDef.price,
          currency: itemDef.currency,
          files: itemDef.files,
          previewImages: itemDef.previewImages,
          rating: itemDef.rating,
          downloadCount: itemDef.downloadCount,
          appliedCount: itemDef.appliedCount,
          status: 'approved',
        },
      });
    }
    log.info('Created %d market items', MARKET_ITEMS.length);

    // Create some orders
    const orderDefs = [
      { itemIdx: 2, status: 'completed' },
      { itemIdx: 4, status: 'completed' },
      { itemIdx: 6, status: 'completed' },
    ];
    for (const od of orderDefs) {
      const itemDef = MARKET_ITEMS[od.itemIdx];
      const amount = itemDef.price;
      const platformFee = Math.floor(amount * 0.3); // 30% platform fee
      const sellerPayout = amount - platformFee;
      await prisma.order.create({
        data: {
          id: uuidv4(),
          buyerId: demoUser.id,
          itemId: itemIds[od.itemIdx],
          amount,
          platformFee,
          sellerPayout,
          status: od.status,
        },
      });
    }
    log.info('Created %d orders', orderDefs.length);

    // Create reviews
    const reviewDefs = [
      { itemIdx: 0, rating: 5, comment: '超棒的模型！动画非常流畅，桌面宠物现在可爱多了！' },
      { itemIdx: 0, rating: 4, comment: '总体不错，但希望能增加更多表情变化。' },
      { itemIdx: 2, rating: 5, comment: '傲娇性格做得太真实了，对话很有代入感。' },
      { itemIdx: 4, rating: 5, comment: '声音非常甜美自然，听不出是合成音。' },
      { itemIdx: 4, rating: 4, comment: '日语发音很准，中文偶尔会有语调问题。' },
      { itemIdx: 6, rating: 5, comment: '动画很流畅，猫爪比心那个太可爱了！' },
    ];
    for (const rd of reviewDefs) {
      await prisma.review.create({
        data: {
          id: uuidv4(),
          itemId: itemIds[rd.itemIdx],
          userId: demoUser.id,
          rating: rd.rating,
          comment: rd.comment,
        },
      });
    }
    log.info('Created %d reviews', reviewDefs.length);

    log.info('Market seed completed!');
    log.info('  Items: %d across %d categories', MARKET_ITEMS.length, new Set(MARKET_ITEMS.map(i => i.category)).size);
    log.info('  Orders: %d', orderDefs.length);
    log.info('  Reviews: %d', reviewDefs.length);
  } catch (err) {
    log.error({ err }, 'Market seed failed');
    throw err;
  }
}
