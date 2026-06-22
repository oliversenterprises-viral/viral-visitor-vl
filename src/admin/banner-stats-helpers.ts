export interface BannerStatRow {
  key: string;
  label: string;
  redirectUrl: string;
  impressions: number;
  clicks: number;
}

export type BannerSortKey = 'impressions' | 'clicks' | 'ctr';

/** Exported for testability (pure function). */
export function formatBannerCtr(impressions: number, clicks: number): string {
  if (!impressions) return '—';
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

/** Exported for testability (pure function). */
export function computeBannerTotals(rows: readonly BannerStatRow[]) {
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  return { impressions, clicks, ctr: formatBannerCtr(impressions, clicks) };
}

/** Exported for testability (pure function). */
export function sortBannerRows(rows: readonly BannerStatRow[], sortBy: BannerSortKey): BannerStatRow[] {
  return [...rows].sort((a, b) => {
    if (sortBy === 'ctr') {
      const ctrA = a.impressions ? a.clicks / a.impressions : 0;
      const ctrB = b.impressions ? b.clicks / b.impressions : 0;
      return ctrB - ctrA;
    }
    return b[sortBy] - a[sortBy];
  });
}

/** Exported for testability (pure function). */
export function filterBannerRowsBySearch(rows: readonly BannerStatRow[], query: string): BannerStatRow[] {
  const q = query.toLowerCase().trim();
  if (!q) return [...rows];
  return rows.filter(
    (r) =>
      r.label.toLowerCase().includes(q) ||
      r.redirectUrl.toLowerCase().includes(q) ||
      r.key.toLowerCase().includes(q),
  );
}

/** Picks best CTR row with at least minImpressions (pure). */
export function findTopPerformer(rows: readonly BannerStatRow[], minImpressions = 3): BannerStatRow | null {
  const eligible = rows.filter((r) => r.impressions >= minImpressions);
  if (!eligible.length) return null;
  const sorted = sortBannerRows(eligible, 'ctr');
  return sorted[0] ?? null;
}