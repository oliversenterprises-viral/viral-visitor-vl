/**
 * Read/write site_content.site_drops with expire-on-write so stale pending cannot block.
 */

import {
  applySiteDropClimb,
  enqueuePendingEntered,
  expireSiteDrops,
  parseSiteDrops,
  siteForCode,
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

type ReferralCountClient = {
  from: (table: string) => unknown;
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>;
};

async function countLocksForCode(supabaseAdmin: ReferralCountClient, code: string): Promise<number | null> {
  try {
    const query = supabaseAdmin.from('referrals') as {
      select: (
        cols: string,
        opts?: { count?: string; head?: boolean },
      ) => { eq: (col: string, val: string) => Promise<{ count?: number | null; error?: unknown }> };
    };
    const result = await query.select('*', { count: 'exact', head: true }).eq('referrer_code', code);
    if (!result || typeof result !== 'object') return null;
    if ('error' in result && result.error) return null;
    if (typeof result.count === 'number') return result.count;
    return null;
  } catch {
    return null;
  }
}

async function challengerRankForCode(supabaseAdmin: ReferralCountClient, code: string): Promise<number | null> {
  if (typeof supabaseAdmin.rpc !== 'function') return null;
  try {
    const { data } = await supabaseAdmin.rpc('get_leaderboard', { min_referrals: 1 });
    if (!Array.isArray(data)) return null;
    const needle = code.toUpperCase();
    const row = data.find((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const rec = entry as { referrer_code?: unknown; rank?: unknown };
      return String(rec.referrer_code || '').toUpperCase() === needle;
    }) as { rank?: unknown } | undefined;
    const rank = Math.floor(Number(row?.rank) || 0);
    if (rank === 2 || rank === 3) return rank;
    return null;
  } catch {
    return null;
  }
}

/**
 * After a verified friend Get my link: if this referrer already pasted a website,
 * climb Just entered → Rising (and Challenger at board #2/#3). Never throws.
 */
export async function advanceSiteDropOnVerifiedCredit(
  supabaseAdmin: SiteContentClient,
  referrerCode: string,
  now: Date = new Date(),
): Promise<boolean> {
  try {
    const current = expireSiteDrops(await loadSiteDropsState(supabaseAdmin), now);
    const site = siteForCode(current, referrerCode);
    if (!site) return false;
    const extra = supabaseAdmin as SiteContentClient & ReferralCountClient;
    const locks = await countLocksForCode(extra, site.code);
    if (locks == null || locks < 1) return false;
    const rank = await challengerRankForCode(extra, site.code);
    const next = applySiteDropClimb(
      current,
      { code: site.code, url: site.url, label: site.label, locks, rank },
      now,
    );
    await saveSiteDropsState(supabaseAdmin, next);
    return true;
  } catch {
    return false;
  }
}
