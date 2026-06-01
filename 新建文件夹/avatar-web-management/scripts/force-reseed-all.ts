import { prisma } from '../src/lib/prisma';
import { seedDatabase } from '../src/lib/db/seed';
import { seedMarketData } from '../src/lib/db/seed-market';
import { seedForumData } from '../src/lib/db/seed-forum';

async function forceReseedAll() {
  // Clear everything
  const tables = [
    'seller_payment_methods', 'payment_gateway_configs',
    'transactions', 'seller_payouts', 'orders', 'reviews', 'market_items',
    'avatar_versions', 'avatars', 'parts', 'part_rules', 'assets',
    'api_keys', 'password_reset_tokens', 'refresh_tokens',
    'notifications', 'audit_logs', 'users', 'workspaces'
  ];
  for (const t of tables) {
    try { await prisma.$executeRawUnsafe(`DELETE FROM "${t}" CASCADE`); } catch {}
  }
  console.log('All tables cleared.');

  // Reseed everything in sequence
  await seedDatabase();
  await seedMarketData();
  await seedForumData();

  await prisma.$disconnect();
  console.log('Force reseed complete!');
}
forceReseedAll().catch(e => { console.error(e.message); process.exit(1); });
