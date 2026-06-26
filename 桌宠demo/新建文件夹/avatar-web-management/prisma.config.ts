import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx ./prisma/seed.ts',
  },
  datasource: {
    url: process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || 'postgresql://avatar:avatar_dev_2024@localhost:5432/avatar_management',
  },
});
