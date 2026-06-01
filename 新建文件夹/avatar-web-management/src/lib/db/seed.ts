import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createLogger } from '@/lib/logger';

const log = createLogger('db:seed');

export async function seedDatabase(): Promise<void> {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    log.info('Database already has data, skipping seed');
    return;
  }

  log.info('Seeding demo data (Prisma/PostgreSQL)...');

  // Workspaces
  const adminWs = await prisma.workspace.create({ data: { name: '管理空间', plan: 'enterprise' } });
  const demoWs = await prisma.workspace.create({ data: { name: '演示空间', plan: 'pro' } });

  // Users
  const adminPw = await hashPassword('admin123');
  const demoPw = await hashPassword('demo1234');

  await prisma.user.create({ data: { workspaceId: adminWs.id, email: 'admin@example.com', username: 'admin', passwordHash: adminPw, role: 'super_admin' } });
  const demo = await prisma.user.create({ data: { workspaceId: demoWs.id, email: 'demo@example.com', username: 'demo_user', passwordHash: demoPw, role: 'user' } });
  const designer = await prisma.user.create({ data: { workspaceId: demoWs.id, email: 'designer@example.com', username: 'designer_01', passwordHash: demoPw, role: 'user' } });

  // Avatars
  const avatarDefs = [
    { name: '星尘·默认', style: 'anime', status: 'published' as const },
    { name: '商务精英', style: 'realistic', status: 'published' as const },
    { name: 'Q版小星', style: 'chibi', status: 'published' as const },
    { name: '韩系女主', style: 'korean', status: 'draft' as const },
    { name: '西部牛仔', style: 'western', status: 'draft' as const },
    { name: '低多边形英雄', style: 'lowpoly', status: 'draft' as const },
  ];

  for (let i = 0; i < avatarDefs.length; i++) {
    const a = avatarDefs[i];
    const baseModel = i % 2 === 0 ? '/models/base-female.glb' : '/models/base-male.glb';
    const avatar = await prisma.avatar.create({
      data: { workspaceId: demoWs.id, creatorId: demo.id, name: a.name, style: a.style, baseModel, status: a.status },
    });
    const version = await prisma.avatarVersion.create({
      data: {
        avatarId: avatar.id, versionNumber: 1,
        blendshapeSnapshot: '{}', bodyParams: '{}', equippedParts: '[]',
        modelPath: '/models/cattail/cattail.model3.json', status: i < 3 ? 'published' : 'draft',
      },
    });
    await prisma.avatar.update({ where: { id: avatar.id }, data: { currentVersionId: version.id } });
  }

  // Assets (sample files)
  const sampleAssets = [
    { filename: 'base-female.glb', assetType: 'model', format: 'glb', size: 1024 * 350 },
    { filename: 'base-male.glb', assetType: 'model', format: 'glb', size: 1024 * 380 },
    { filename: 'hair-long-flowing.glb', assetType: 'model', format: 'glb', size: 1024 * 120 },
    { filename: 'hair-short-bob.glb', assetType: 'model', format: 'glb', size: 1024 * 95 },
    { filename: 'top-tshirt-basic.glb', assetType: 'model', format: 'glb', size: 1024 * 80 },
    { filename: 'top-jacket-leather.glb', assetType: 'model', format: 'glb', size: 1024 * 150 },
    { filename: 'bottom-skirt-pleated.glb', assetType: 'model', format: 'glb', size: 1024 * 70 },
    { filename: 'bottom-pants-jeans.glb', assetType: 'model', format: 'glb', size: 1024 * 90 },
    { filename: 'shoes-sneakers.glb', assetType: 'model', format: 'glb', size: 1024 * 65 },
    { filename: 'shoes-boots.glb', assetType: 'model', format: 'glb', size: 1024 * 85 },
    { filename: 'accessory-glasses-round.glb', assetType: 'model', format: 'glb', size: 1024 * 20 },
    { filename: 'accessory-necklace.glb', assetType: 'model', format: 'glb', size: 1024 * 25 },
    { filename: 'albedo-diffuse-skin.png', assetType: 'texture', format: 'png', size: 1024 * 2048 },
    { filename: 'albedo-diffuse-outfit.png', assetType: 'texture', format: 'png', size: 1024 * 1536 },
    { filename: 'normal-map-detail.png', assetType: 'texture', format: 'png', size: 1024 * 1024 },
    { filename: 'makeup-blush.png', assetType: 'texture', format: 'png', size: 1024 * 512 },
    { filename: 'walk-cycle.fbx', assetType: 'animation', format: 'fbx', size: 1024 * 400 },
    { filename: 'idle-pose-relaxed.fbx', assetType: 'animation', format: 'fbx', size: 1024 * 120 },
    { filename: 'run-cycle.fbx', assetType: 'animation', format: 'fbx', size: 1024 * 350 },
    { filename: 'jump-pose.fbx', assetType: 'animation', format: 'fbx', size: 1024 * 80 },
    { filename: 'studio-lighting.hdr', assetType: 'hdri', format: 'hdr', size: 1024 * 2048 },
    { filename: 'outdoor-sunset.exr', assetType: 'hdri', format: 'exr', size: 1024 * 4096 },
  ];

  for (const a of sampleAssets) {
    await prisma.asset.create({
      data: {
        workspaceId: demoWs.id, uploaderId: demo.id, filename: a.filename,
        fileSize: a.size, mimeType: a.format === 'fbx' ? 'application/octet-stream' : `image/${a.format}`,
        storagePath: `/uploads/${demoWs.id}/${a.filename}`, assetType: a.assetType, format: a.format,
        license: 'cc_by', tags: JSON.stringify([a.assetType, a.format]),
      },
    });
  }
  log.info('Assets: %d files seeded', sampleAssets.length);

  // Templates
  const templateDefs = [
    { name: '樱花少女', style: 'anime' }, { name: '商务精英', style: 'realistic' },
    { name: 'K-POP偶像', style: 'korean' }, { name: '西部牛仔', style: 'western' },
    { name: '小星仙', style: 'chibi' }, { name: '精灵弓箭手', style: 'anime' },
  ];
  for (const t of templateDefs) {
    const avatar = await prisma.avatar.create({
      data: { workspaceId: demoWs.id, creatorId: designer.id, name: t.name, style: t.style, baseModel: '/models/base-female.glb', status: 'published', isTemplate: true },
    });
    const version = await prisma.avatarVersion.create({
      data: { avatarId: avatar.id, versionNumber: 1, blendshapeSnapshot: '{"eye_size":0.15,"mouth_width":0.1}', bodyParams: '{"height":0,"shoulder":-0.1,"waist":0.05}', equippedParts: '[]', modelPath: '/models/cattail/cattail.model3.json', status: 'published' },
    });
    await prisma.avatar.update({ where: { id: avatar.id }, data: { currentVersionId: version.id } });
  }
  // Mark first 3 avatars as templates too
  await prisma.avatar.updateMany({ where: { status: 'published', creatorId: demo.id }, data: { isTemplate: true } });

  // Notifications
  const notifs = [
    { type: 'system' as const, title: '欢迎来到AstralFox Market！', body: '浏览模型市场，为你的AI桌面宠物挑选个性化外观吧！', isRead: false },
    { type: 'review' as const, title: '形象"星尘·默认"审核已通过', body: '您的作品已通过审核，现已公开发布。', isRead: true },
    { type: 'comment' as const, title: 'designer_01 评论了您的形象', body: '这个模型的贴图处理得真好，能分享下制作过程吗？', isRead: true },
    { type: 'share' as const, title: '您的模板"樱花少女"被下载了5次', body: '该模板本周热度上升中', isRead: true },
    { type: 'storage' as const, title: '存储空间已使用 45%', body: '已使用 450MB / 1GB，建议清理不需要的资产。', isRead: true },
  ];
  for (const n of notifs) {
    await prisma.notification.create({ data: { userId: demo.id, type: n.type, title: n.title, body: n.body, isRead: n.isRead } });
  }

  // Audit logs
  const actions = ['用户登录', '创建形象', '保存版本', '上传资产', '修改配置'];
  for (const action of actions) {
    await prisma.auditLog.create({ data: { userId: demo.id, action, resourceType: 'avatar', resourceId: crypto.randomUUID(), ipAddress: '192.168.1.100' } });
  }

  log.info('Seed completed successfully (Prisma/PostgreSQL)');
  log.info('  admin@example.com / admin123 (super_admin)');
  log.info('  demo@example.com / demo1234 (user)');
  log.info('  designer@example.com / demo1234 (user)');
}
