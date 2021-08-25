module.exports = {
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx'],

  testRegex: '.*\\.spec.(jsx?|tsx?)$',

  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx,js,jsx}',
    '!packages/*/src/**/*.story.*',
    '!packages/workspaces-media-selector/src/**/*.{ts,tsx,js,jsx}',
  ],

  coverageThreshold: {
    global: {
      branches: 60,
      statements: 90,
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
