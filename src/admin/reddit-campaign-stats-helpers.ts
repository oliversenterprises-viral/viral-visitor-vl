export interface RedditFunnelRow {
  name: string;
  count: number;
}

export const REDDIT_PIXEL_DISPLAY_ID = 'a2_jr6jdbg2r4';

/** Exported for testability (pure function). */
export function sortCampaignEntries(byCampaign: Record<string, number>): Array<[string, number]> {
  return Object.entries(byCampaign).sort((a, b) => b[1] - a[1]);
}

/** Exported for testability (pure function). */
export function shouldShowCampaignBreakdown(byCampaign: Record<string, number>): boolean {
  const entries = Object.entries(byCampaign);
  if (!entries.length) return false;
  if (entries.length === 1 && entries[0][0] === '(none)') return false;
  return true;
}

/** Exported for testability (pure function). */
export function computeRedditFunnelTotals(funnel: readonly RedditFunnelRow[]) {
  const total = funnel.reduce((s, r) => s + r.count, 0);
  const landings = funnel.find((r) => r.name === 'RedditLanding')?.count ?? 0;
  const claims = funnel.find((r) => r.name === 'SubmitPrizeClaim')?.count ?? 0;
  const conversion = landings > 0 ? `${((claims / landings) * 100).toFixed(1)}%` : '—';
  return { total, landings, claims, conversion };
}

/** Exported for testability (pure function). */
export function topCampaigns(entries: Array<[string, number]>, limit = 6): Array<[string, number]> {
  return entries.slice(0, limit);
}