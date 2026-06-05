import { seedDatabase } from '../src/lib/db/seed';
import { seedMarketData } from '../src/lib/db/seed-market';
import { seedForumData } from '../src/lib/db/seed-forum';

async function main() {
  await seedDatabase();
  await seedMarketData();
  await seedForumData();
  console.log('Seed completed successfully.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
