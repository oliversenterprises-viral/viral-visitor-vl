/**
 * Fail-fast Site Drop ladder fetch.
 * Never wait on the full site_content REST scan — that hung the first screen.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { SITE_DROPS_KEY } from './site-drops';

export const SITE_DROPS_FETCH_TIMEOUT_MS = 2_000;

export const EMPTY_SITE_DROPS = { drops: [] as const, pending_entered: [] as const };

export type SiteDropsFetchResult = {
  raw: unknown;
  timedOut: boolean;
};

export type SiteDropsFetchFn = (signal: AbortSignal) => Promise<unknown>;

/** Race any ladder request against ≤2s. Timeout → empty payload, not a hang. */
export async function fetchPublicSiteDropsWithTimeout(
  run: SiteDropsFetchFn,
  timeoutMs: number = SITE_DROPS_FETCH_TIMEOUT_MS,
): Promise<SiteDropsFetchResult> {
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : SITE_DROPS_FETCH_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const raw = await Promise.race([
      run(ctrl.signal),
      new Promise<never>((_, reject) => {
        const fail = () => reject(new Error('site-drops-timeout'));
        if (ctrl.signal.aborted) fail();
        else ctrl.signal.addEventListener('abort', fail, { once: true });
      }),
    ]);
    return { raw, timedOut: false };
  } catch {
    return { raw: { ...EMPTY_SITE_DROPS }, timedOut: true };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSiteDropsRpc(): Promise<unknown> {
  const { data, error } = await supabase.rpc('get_public_site_drops');
  if (error || data == null) throw error || new Error('site-drops-rpc-empty');
  return data;
}

async function fetchSiteDropsRest(signal: AbortSignal): Promise<unknown> {
  const query = supabase
    .from('site_content')
    .select('value')
    .eq('key', SITE_DROPS_KEY)
    .limit(1);
  const withAbort =
    typeof (query as { abortSignal?: (s: AbortSignal) => typeof query }).abortSignal === 'function'
      ? (query as { abortSignal: (s: AbortSignal) => typeof query }).abortSignal(signal)
      : query;
  const { data, error } = await withAbort.maybeSingle();
  if (error || data == null) throw error || new Error('site-drops-rest-empty');
  return (data as { value?: unknown }).value;
}

/**
 * Dedicated ladder read: cheap RPC first, then a LIMIT 1 REST fallback.
 * Always unblocks in ≤ SITE_DROPS_FETCH_TIMEOUT_MS.
 */
export async function fetchPublicSiteDrops(
  timeoutMs: number = SITE_DROPS_FETCH_TIMEOUT_MS,
): Promise<SiteDropsFetchResult> {
  if (!isSupabaseConfigured) {
    return { raw: { ...EMPTY_SITE_DROPS }, timedOut: false };
  }

  return fetchPublicSiteDropsWithTimeout(async (signal) => {
    try {
      return await fetchSiteDropsRpc();
    } catch {
      if (signal.aborted) throw new Error('site-drops-timeout');
      return await fetchSiteDropsRest(signal);
    }
  }, timeoutMs);
}
