import { describe, expect, it } from 'vitest';
import { FIRST_SCREEN_FETCH_TIMEOUT_MS, withInitTimeout } from '../../src/app';

describe('first-screen fail-fast', () => {
  it('times out hung fetches in 2s instead of blocking first paint', async () => {
    expect(FIRST_SCREEN_FETCH_TIMEOUT_MS).toBe(2_000);
    expect(FIRST_SCREEN_FETCH_TIMEOUT_MS).toBeLessThan(3_000);

    const hung = new Promise<string>(() => {
      /* never resolves — hung PostgREST */
    });
    const started = Date.now();
    const result = await withInitTimeout(hung, 'first-screen');
    const elapsed = Date.now() - started;

    expect(result).toBe('first-screen');
    expect(elapsed).toBeGreaterThanOrEqual(FIRST_SCREEN_FETCH_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(FIRST_SCREEN_FETCH_TIMEOUT_MS + 400);
  });
});
