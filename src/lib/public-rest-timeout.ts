/**
 * Homepage public REST/RPC fail-fast.
 * Hung Supabase calls must abort in ≤2s so first paint never waits on a spinner.
 */

export const PUBLIC_REST_TIMEOUT_MS = 2_000;

/**
 * Run a public REST/RPC with an AbortSignal that fires at PUBLIC_REST_TIMEOUT_MS.
 * Always resolves to `fallback` on timeout, abort, or throw — never hangs.
 */
export async function withPublicRestTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  fallback: T,
): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      ctrl.abort();
      resolve(fallback);
    }, PUBLIC_REST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([run(ctrl.signal), timeout]);
  } catch {
    return fallback;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
