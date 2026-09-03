/**
 * Read/write site_content.site_drops with expire-on-write so stale pending cannot block.
 */

import {
  enqueuePendingEntered,
  expireSiteDrops,
  parseSiteDrops,
  SITE_DROPS_KEY,
  type SiteDropsState,
} from './site-drops.ts';

export type SiteContentClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        limit: (n: number) => {
          maybeSingle: () => Promise<{ data: { value?: unknown } | null; error: unknown }>;
        };
        maybeSingle: () => Promise<{ data: { value?: unknown } | null; error: unknown }>;
      };
    };
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string },
    ) => Promise<{ error: unknown }>;
  };
};

export async function loadSiteDropsState(
  supabaseAdmin: SiteContentClient,
): Promise<SiteDropsState> {
  const { data, error } = await supabaseAdmin
    .from('site_content')
    .select('value')
    .eq('key', SITE_DROPS_KEY)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return parseSiteDrops(data?.value);
}

export async function saveSiteDropsState(
  supabaseAdmin: SiteContentClient,
  state: SiteDropsState,
): Promise<void> {
  const { error } = await supabaseAdmin.from('site_content').upsert(
    {
      key: SITE_DROPS_KEY,
      value: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  if (error) throw error;
}

export async function pruneAndSaveSiteDrops(
  supabaseAdmin: SiteContentClient,
  now: Date = new Date(),
): Promise<SiteDropsState> {
  const current = await loadSiteDropsState(supabaseAdmin);
  const next = expireSiteDrops(current, now);
  const pendingChanged = next.pending_entered.length !== current.pending_entered.length;
  const dropsChanged = next.drops.length !== current.drops.length;
  if (pendingChanged || dropsChanged) {
    await saveSiteDropsState(supabaseAdmin, next);
  }
  return next;
}

export async function enqueuePendingAndSave(
  supabaseAdmin: SiteContentClient,
  code: string,
  now: Date = new Date(),
): Promise<SiteDropsState> {
  const current = await loadSiteDropsState(supabaseAdmin);
  const next = enqueuePendingEntered(current, code, now);
  const changed =
    next.pending_entered.length !== current.pending_entered.length ||
    next.drops.length !== current.drops.length ||
    next.pending_entered.some((row, i) => row.code !== current.pending_entered[i]?.code);
  if (changed) {
    await saveSiteDropsState(supabaseAdmin, next);
  }
  return next;
}
