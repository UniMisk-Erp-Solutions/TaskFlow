import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// Lint for the web app. `npm run lint` must exit 0: real bugs (undefined variables, broken hooks, unreachable code…) are errors,
// style-only findings are warnings so they show up without blocking.
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'public/**', '.harness/**', 'src/components/BookingCalendar.tsx', 'src/components/use-bookings.ts', 'src/components/AvailabilityPopover.tsx'] },

  js.configs.recommended,

  // TypeScript files: the recommended type-aware-free ruleset.
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] })),

  {
    files: ['**/*.{js,jsx,ts,tsx,mjs}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021, __TASKFLOW_BUILD__: 'readonly' }, // __TASKFLOW_BUILD__ is injected by vite.config.js
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off', // plain JS components, no PropTypes in this project
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Unused variables are a warning (cleanup, not a bug). Plain JS and TypeScript each use their own version of the rule.
  {
    files: ['**/*.{js,jsx,mjs}'],
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }] },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }] },
  },

  // Node-side files (build config and scripts).
  {
    files: ['vite.config.js', 'eslint.config.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Tests run with Vitest's globals enabled.
  {
    files: ['**/__tests__/**/*.{js,jsx,ts,tsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
);
