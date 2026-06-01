/** @type {import('jest').Config} */
module.exports = {
  // Backend / API tests (Node environment)
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  roots: ['<rootDir>/tests', '<rootDir>/src/components'],
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.tsx',
    '**/src/components/__tests__/**/*.test.ts',
    '**/src/components/__tests__/**/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/tests/visual/',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2022',
        esModuleInterop: true,
        jsx: 'react-jsx',
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@?nanoid|dompurify|zustand)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^uuid$': '<rootDir>/tests/__mocks__/uuid.js',
    '^next-intl$': '<rootDir>/tests/__mocks__/next-intl.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.*',
    '!src/mock/**',
    '!src/types/**',
  ],
  // 覆盖率门槛 — 新代码必须达到，存量逐步提升
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 65,
      statements: 65,
    },
  },
};
