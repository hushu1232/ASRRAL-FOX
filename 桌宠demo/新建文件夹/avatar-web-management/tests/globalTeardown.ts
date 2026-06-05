import { getContainer } from './globalSetup';

export default async function globalTeardown(): Promise<void> {
  const container = getContainer();
  if (container) {
    console.log('[testcontainers] Stopping PostgreSQL container...');
    await container.stop();
    console.log('[testcontainers] Container stopped.');
  }
}
