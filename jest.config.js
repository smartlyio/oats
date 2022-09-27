module.exports = {
  moduleFileExtensions: ['js', 'ts', 'tsx'],
  moduleNameMapper: {
    '@smartlyio/oats$': '<rootDir>/packages/oats/index.ts',
    '@smartlyio/oats-runtime$': '<rootDir>/packages/oats-runtime/src/runtime.ts',
    '@smartlyio/oats-axios-adapter$': '<rootDir>/packages/oats-axios-adapter/index.ts',
    '@smartlyio/oats-koa-adapter$': '<rootDir>/packages/oats-koa-adapter/index.ts',
    '@smartlyio/oats-fast-check$': '<rootDir>/packages/oats-fast-check/src/index.ts'
  },
  testRegex: '.*\\.spec.ts$',
  collectCoverageFrom: ['packages/*/src/**/*.{ts,js}'],
  coverageThreshold: {
    global: {
      branches: 20,
      statements: 20
    }
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/*/dist'],
  transform: {
    '^.+\\.(ts|js)x?$': ['ts-jest', { isolatedModules: true, diagnostics: true }]
  },
  setupFilesAfterEnv: []
};
