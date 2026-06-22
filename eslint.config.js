import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * ESLint 10+ flat config for ViralRefer Premium
 * Vite + TypeScript (strict) + Tailwind v4 + no React/JSX
 *
 * This fixes the completely broken lint setup (missing eslint.config.js + legacy CLI flags).
 * Directly modeled on the proven working config from the sibling viral-visitor-vl project.
 * Aligned with tsconfig.json strictness (noUnused*, erasableSyntaxOnly, etc.).
 * Practical rules only — warnings instead of errors for patterns that exist in the real codebase
 * (any for globals/edge payloads, console for debug, etc.).
 */
export default tseslint.config(
  // Global ignores (replaces .eslintignore)
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'supabase/.temp/**',
      'playwright-report/**',
      'test-results/**',
      'lighthouse-report*.html',
      'bundle-visualizer.html',
    ],
  },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript recommended (includes parser + rules)
  ...tseslint.configs.recommended,

  // Project-specific overrides for src/ (and prepared for .tsx even though none exist today)
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      // TS strictness already handled by tsconfig; surface as warnings in lint
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Discourage explicit any (we have a deliberate handful for globals + edge functions; keep as warning)
      '@typescript-eslint/no-explicit-any': 'warn',

      // Allow console for ViralRefer debug namespace + error reporting
      'no-console': 'off',

      // Reasonable modern defaults
      'no-undef': 'off', // TS handles this
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },

  // Allow some relaxed rules in test files
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // setupBannersArrayEditor uses intentional separate probe parse for starter UX
  {
    files: ['src/admin/edit-content-tab.ts'],
    rules: {
      'no-useless-assignment': 'off',
    },
  },
);
