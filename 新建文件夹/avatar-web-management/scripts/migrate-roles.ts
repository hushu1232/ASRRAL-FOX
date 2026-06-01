// Role migration script: simplifies 5 roles → 3 roles
// Run: npx tsx scripts/migrate-roles.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Role Migration: 5 roles → 3 roles ===\n');

  // 1. Show current distribution
  const before = await prisma.user.groupBy({ by: ['role'], _count: true });
  console.log('Before migration:');
  before.forEach(r => console.log(`  ${r.role}: ${r._count}`));
  console.log('');

  // 2. Migrate designer → user
  const d1 = await prisma.user.updateMany({ where: { role: 'designer' }, data: { role: 'user' } });
  console.log(`designer → user: ${d1.count} users migrated`);

  // 3. Migrate auditor → workspace_admin
  const d2 = await prisma.user.updateMany({ where: { role: 'auditor' }, data: { role: 'workspace_admin' } });
  console.log(`auditor → workspace_admin: ${d2.count} users migrated`);

  // 4. Migrate moderator → workspace_admin
  const d3 = await prisma.user.updateMany({ where: { role: 'moderator' }, data: { role: 'workspace_admin' } });
  console.log(`moderator → workspace_admin: ${d3.count} users migrated`);

  // 5. Migrate admin → super_admin
  const d4 = await prisma.user.updateMany({ where: { role: 'admin' }, data: { role: 'super_admin' } });
  console.log(`admin → super_admin: ${d4.count} users migrated`);

  console.log('');

  // 6. Show new distribution
  const after = await prisma.user.groupBy({ by: ['role'], _count: true });
  console.log('After migration:');
  after.forEach(r => console.log(`  ${r.role}: ${r._count}`));

  const total = after.reduce((sum, r) => sum + r._count, 0);
  console.log(`\nTotal users: ${total}`);
  console.log('=== Migration complete ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
