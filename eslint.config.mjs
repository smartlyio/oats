import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';
import jest from 'eslint-plugin-jest';
import importPlugin from 'eslint-plugin-import';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import eslint from '@eslint/js';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.vscode/**',
      '**/.github/**',
      '**/.git/**',
      '**/bin/**',
      '**/dist/**',
      '**/tmp/**',
      '**/*.generated.ts',
      '**/*.js',
      './eslint.config.mjs'
    ]
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        project: [
          './tsconfig.json',
          './packages/*/tsconfig.json',
          './packages/*/tsconfig.test.json'
        ],
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [importPlugin.flatConfigs.typescript]
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error',
      'prettier/prettier': 'error',
      'require-atomic-updates': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/camelcase': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': false }
      ],
      'import/no-cycle': 'error',
      'import/no-useless-path-segments': 'error',
      'import/no-self-import': 'error',
      'import/no-mutable-exports': 'error',
      'import/no-deprecated': 'error',
      'import/export': 'error'
    }
  },
  {
    files: ['test/**/*.ts', 'packages/*/test/**/*.ts'],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      'jest/valid-expect-in-promise': 'off',
      'jest/no-identical-title': 'off',
      'jest/no-try-expect': 'off',
      'jest/expect-expect': 'off',
      'jest/no-standalone-expect': 'off',
      'jest/valid-describe': 'off',
      '@typescript-eslint/ban-ts-comment': 'off'
    }
  },
  {
    files: ['packages/oats-runtime/**/*.ts', 'packages/oats-migrate-adapter/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-types': ['error'],
      'import/no-nodejs-modules': 'error'
    }
  },
  {
    files: ['./render.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-floating-promises': 'off'
    }
  },
  {
    files: ['packages/oats-fetch-adapter/**/*.ts'],
    rules: {
      'import/no-nodejs-modules': 'error'
    }
  },
  {
    files: ['packages/oats-runtime/**/*.ts'],
    rules: {
      'import/no-cycle': 'off'
    }
  }
);
