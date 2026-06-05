import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  rootDir: '../..', // project root, since this config is in tests/visual/
  roots: ['<rootDir>/tests/visual'],
  testMatch: ['**/*.visual.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/visual/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2022',
        esModuleInterop: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testTimeout: 60000, // browser screenshots take longer
  verbose: true,
};

export default config;
