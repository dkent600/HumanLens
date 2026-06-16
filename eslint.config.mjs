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
    // Allow intentionally-unused names when prefixed with an underscore
    // (e.g. seam methods that satisfy an interface but ignore an argument).
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
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
  {
    // Protect the shared boundary: `shared` publishes ONLY client-safe DTOs, so
    // it must never import from backend or frontend (which would let an
    // internal-layer type migrate in and quietly breach client-safe ⊆ internal).
    // Catches package-name imports and relative-path escapes, type imports too.
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@humanlens/backend',
                '@humanlens/frontend',
                '**/backend/**',
                '**/frontend/**',
              ],
              message:
                'shared must stay client-safe: do not import from backend or frontend. Only client-safe DTOs belong in @humanlens/shared.',
            },
          ],
        },
      ],
    },
  },
);
