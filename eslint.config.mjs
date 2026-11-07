import js from '@eslint/js';
import ts from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
export default ts.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'prototype/**',
      'test-results/**',
      'playwright-report/**',
      '.asr-venv/**',
      '.models/**',
      'release/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        Buffer: 'readonly',
        AbortController: 'readonly',
        performance: 'readonly',
      },
    },
  },
  prettierConfig,
);
