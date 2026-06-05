import { seedDatabase } from '../src/lib/db/seed';
seedDatabase()
  .then(() => console.log('Seed OK'))
  .catch(e => {
    console.error('ERROR:', e.message);
    if (e.meta) console.error('META:', JSON.stringify(e.meta));
    if (e.stack) console.error(e.stack.split('\n').slice(0, 8).join('\n'));
    process.exit(1);
  });
