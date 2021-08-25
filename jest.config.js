module.exports = {
  moduleFileExtensions: ['js', 'ts', 'tsx'],

  testRegex: '.*\\.spec.(tsx?)$',

  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsxx}',
    '!packages/*/src/**/*.story.*'
  ],

  coverageThreshold: {
    global: {
      branches: 20,
      statements: 20,
    },
  },

  modulePathIgnorePatterns: ['<rootDir>/packages/*/dist'],

  transform: {
    '^.+\\.(ts|js)x?$': 'ts-jest',
  },

  globals: {
    'ts-jest': {
      isolatedModules: true,
      diagnostics: true,
    },
  },
  setupFilesAfterEnv: [],
};
