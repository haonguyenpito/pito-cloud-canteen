// We use ts-jest (not next/jest or babel-jest) because:
// - next.config.js requires 50+ production env vars at load time, blocking next/jest
// - next/babel preset has importAssertions/importAttributes plugin conflict in this setup
// - ts-jest handles TypeScript natively with no Babel conflicts

/** @type {import('jest').Config} */
module.exports = {
  silent: true,
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Only run tests inside tests/ — separate from any future src/ component tests
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],

  // TypeScript transform via ts-jest
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react', rootDir: '.' } }],
  },

  // Coverage thresholds — enforced when running `yarn test --coverage`.
  // Failing below these values means a refactor or restructure has removed
  // test coverage from a critical path. Raise thresholds as coverage improves;
  // never lower them without a documented reason.
  coverageThreshold: {
    'src/helpers/order/': { lines: 70, functions: 70 },
    'src/services/jobs/': { lines: 70, functions: 70 },
    'src/services/permissionChecker/': { lines: 70, functions: 70 },
    'src/pages/api/orders/': { lines: 70, functions: 70 },
    'src/pages/api/admin/payment/': { lines: 70, functions: 70 },
  },

  // Path aliases matching tsconfig.json "paths"
  moduleNameMapper: {
    // Sharetribe SDK — integrationSdk.ts calls createInstance() at module load,
    // which throws "clientId must be provided" without env vars. Mock globally.
    '^sharetribe-flex-integration-sdk$':
      '<rootDir>/tests/__mocks__/sharetribe-flex-integration-sdk.js',
    // CSS/SCSS modules
    '^.+\\.module\\.(css|sass|scss)$': '<rootDir>/tests/__mocks__/styleMock.js',
    '^.+\\.(css|sass|scss)$': '<rootDir>/tests/__mocks__/styleMock.js',
    // Static assets
    '^.+\\.(jpg|jpeg|png|gif|webp|avif|svg|ico|woff|woff2|ttf|eot)$':
      '<rootDir>/tests/__mocks__/fileMock.js',
    // TypeScript path aliases
    '^@apis/(.*)$': '<rootDir>/src/apis/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@helpers/(.*)$': '<rootDir>/src/helpers/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@redux/(.*)$': '<rootDir>/src/redux/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@sharetribe/(.*)$': '<rootDir>/src/sharetribe/$1',
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',
    '^@translations/(.*)$': '<rootDir>/src/translations/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@apiServices/(.*)$': '<rootDir>/src/pages/api/apiServices/$1',
  },
};
