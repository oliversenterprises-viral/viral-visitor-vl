import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FIRST_PAINT_FETCH_MS,
  firstPaintAbortController,
  withFirstPaintAbort,
} from '../../src/lib/first-paint-fetch';

describe('first-paint AbortController fail-fast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('caps public first-paint REST/RPC at 2s', () => {
    expect(FIRST_PAINT_FETCH_MS).toBe(2000);
    expect(FIRST_PAINT_FETCH_MS).toBeLessThanOrEqual(2000);
  });

  it('firstPaintAbortController uses AbortController and fires at ≤2s', async () => {
    vi.useFakeTimers();
    const { controller, signal, dispose } = firstPaintAbortController();
    expect(controller).toBeInstanceOf(AbortController);
    expect(signal.aborted).toBe(false);

    const aborted = new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve(), { once: true });
    });

    await vi.advanceTimersByTimeAsync(FIRST_PAINT_FETCH_MS);
    await aborted;
    expect(signal.aborted).toBe(true);
    dispose();
  });

  it('refuses a timeout above 2s', async () => {
    vi.useFakeTimers();
    const { signal, dispose } = firstPaintAbortController(30_000);
    const aborted = new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve(), { once: true });
    });
    await vi.advanceTimersByTimeAsync(2000);
    await aborted;
    expect(signal.aborted).toBe(true);
    dispose();
  });

  it('withFirstPaintAbort returns fallback when the RPC never resolves', async () => {
    vi.useFakeTimers();
    const hung = withFirstPaintAbort(async () => {
      await new Promise<string>(() => {
        /* hung public RPC */
      });
      return 'live';
    }, 'fallback');

    await vi.advanceTimersByTimeAsync(2000);
    await expect(hung).resolves.toBe('fallback');
  });

  it('withFirstPaintAbort returns the live value when the RPC finishes in time', async () => {
    await expect(
      withFirstPaintAbort(async () => 'live', 'fallback'),
    ).resolves.toBe('live');
  });

  it('passes the AbortController signal into the public fetch', async () => {
    const seen: AbortSignal[] = [];
    await withFirstPaintAbort(async (signal) => {
      seen.push(signal);
      expect(signal).toBeInstanceOf(AbortSignal);
      return 1;
    }, 0);
    expect(seen).toHaveLength(1);
  });
});
