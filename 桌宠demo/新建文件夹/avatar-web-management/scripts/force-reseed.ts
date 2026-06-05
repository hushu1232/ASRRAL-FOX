import { prisma } from '../src/lib/prisma';

async function forceReseed() {
  const tables = [
    'seller_payment_methods', 'payment_gateway_configs',
    'transactions', 'seller_payouts', 'orders', 'reviews', 'market_items',
    'avatar_versions', 'avatars', 'parts', 'part_rules', 'assets',
    'api_keys', 'password_reset_tokens', 'refresh_tokens',
    'notifications', 'audit_logs', 'users', 'workspaces'
  ];
  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${t}" CASCADE`);
      console.log(`Cleared: ${t}`);
    } catch (e) {
      console.log(`Skip: ${t} — ${(e as Error).message.split('\n')[0]}`);
    }
  }
  console.log('Done. Now run: npx tsx prisma/seed.ts');
  await prisma.$disconnect();
}
forceReseed();
