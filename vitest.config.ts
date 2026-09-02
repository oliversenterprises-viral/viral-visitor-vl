import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    teardownTimeout: 15000,
    // Worker teardown raced Vitest's console RPC (EnvironmentTeardownError /
    // onUserConsoleLog pending) after get-link-reveal logs. Skip intercept.
    disableConsoleIntercept: true,
    onConsoleLog(log) {
      // Expected when unit tests call register without a live Edge Function.
      // Returning false keeps the log off Vitest's RPC so worker teardown
      // does not fail with EnvironmentTeardownError / onUserConsoleLog.
      if (log.includes('register-referrer-link failed')) return false;
    },
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