import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Shared across all workspace packages. Run from the repo root via `npm run lint`.
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.{js,mjs,ts}'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Browser-side code — the Aurelia webapp.
    files: ['packages/frontend/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Server-side and shared code — runs in Node.
    files: ['packages/backend/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
