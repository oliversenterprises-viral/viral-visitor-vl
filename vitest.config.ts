import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['tests/vitest.setup.ts'],
          include: ['tests/unit/**/*.test.ts'],
          exclude: ['tests/unit/turnstile-call-sites.test.ts'],
        },
      },
      {
        test: {
          name: 'turnstile-sites',
          environment: 'jsdom',
          setupFiles: ['tests/vitest.turnstile-stub.setup.ts'],
          include: ['tests/unit/turnstile-call-sites.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});