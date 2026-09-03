/**
 * HARD LOCK — homepage first-paint public REST/RPC.
 * Fail-fast with AbortController. Do not raise the cap. Do not await these
 * from initApp. A hung Supabase call must not hold Get my link.
 * Destination: live viralrefer.app. Site Drop English stays.
 */

/** Hard cap for public first-paint REST/RPC. Do not raise above 2s. */
export const FIRST_PAINT_FETCH_MS = 2000;

/** Regression lock: first screen hydrations are fire-and-forget + ≤2s abort. */
export const FIRST_PAINT_HARD_LOCK = 'no-await-hung-apis' as const;

export type FirstPaintAbort = {
  controller: AbortController;
  signal: AbortSignal;
  dispose: () => void;
};

/** AbortController that fires at ≤2s. Caller must dispose() to clear the timer. */
export function firstPaintAbortController(timeoutMs = FIRST_PAINT_FETCH_MS): FirstPaintAbort {
  const ms = Math.min(Math.max(1, timeoutMs), FIRST_PAINT_FETCH_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      /* already aborted */
    }
  }, ms);
  return {
    controller,
    signal: controller.signal,
    dispose: () => clearTimeout(timer),
  };
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('Aborted', 'AbortError');
}

/**
 * Run a public first-paint fetch with AbortController ≤2s.
 * Abort / network / parse failures return `fallback` so paint continues.
 * Rejects on abort even if the underlying RPC ignores the signal.
 */
export async function withFirstPaintAbort<T>(
  run: (signal: AbortSignal) => Promise<T>,
  fallback: T,
  timeoutMs = FIRST_PAINT_FETCH_MS,
): Promise<T> {
  const { signal, dispose } = firstPaintAbortController(timeoutMs);
  try {
    return await new Promise<T>((resolve, reject) => {
      if (signal.aborted) {
        reject(abortError(signal));
        return;
      }
      const onAbort = () => reject(abortError(signal));
      signal.addEventListener('abort', onAbort, { once: true });
      run(signal).then(
        (value) => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (err) => {
          signal.removeEventListener('abort', onAbort);
          reject(err);
        },
      );
    });
  } catch {
    return fallback;
  } finally {
    dispose();
  }
}
