/**
 * Testcontainers global setup — starts PostgreSQL for integration tests.
 * Only activates when TESTCONTAINERS=true (opt-in, requires Docker + @testcontainers/postgresql).
 *
 * Install: npm install --save-dev @testcontainers/postgresql
 * Usage:   TESTCONTAINERS=true npm test
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let container: any = null;

export default async function globalSetup(): Promise<void> {
  if (process.env.TESTCONTAINERS !== 'true') {
    console.log('[testcontainers] Skipped — set TESTCONTAINERS=true to enable');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostgreSqlContainer } = require('@testcontainers/postgresql');
    console.log('[testcontainers] Starting PostgreSQL container...');
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('avatar_test')
      .withUsername('avatar_test')
      .withPassword('avatar_test')
      .withExposedPorts(5432)
      .start();

    const url = `postgresql://avatar_test:avatar_test@${container.getHost()}:${container.getMappedPort(5432)}/avatar_test`;
    process.env.DATABASE_URL = url;
    process.env.PG_POOL_MAX = '2';
    (globalThis as Record<string, unknown>).__testcontainerUrl = url;
    console.log(`[testcontainers] PostgreSQL ready at ${url}`);
  } catch (err) {
    console.error('[testcontainers] Failed to start PostgreSQL:', (err as Error).message);
    console.error('[testcontainers] Install with: npm install --save-dev @testcontainers/postgresql');
    throw err;
  }
}

export function getContainer() {
  return container;
}
