// Revoke refresh-token rows created before the SHA-256 migration.
//
// Dry run (safe default):
//   npx tsx scripts/revoke-legacy-refresh-tokens.ts
// Apply revocation:
//   npx tsx scripts/revoke-legacy-refresh-tokens.ts --apply

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SHA256_HEX = /^[a-f0-9]{64}$/i;

async function main() {
  const rows = await prisma.refreshToken.findMany({
    where: { revoked: false },
    select: { id: true, tokenHash: true },
  });
  const legacyIds = rows.filter((row) => !SHA256_HEX.test(row.tokenHash)).map((row) => row.id);

  console.log(`Unrevoked refresh-token rows: ${rows.length}`);
  console.log(`Legacy plaintext rows detected: ${legacyIds.length}`);

  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Re-run with --apply to revoke the detected rows.');
    return;
  }

  if (legacyIds.length === 0) {
    console.log('Nothing to revoke.');
    return;
  }

  const result = await prisma.refreshToken.updateMany({
    where: { id: { in: legacyIds } },
    data: { revoked: true },
  });
  console.log(`Revoked legacy refresh-token rows: ${result.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
