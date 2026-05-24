/** Shape of a single share event as used by this analytics tab */
export interface ShareEvent {
  platform: string;
  referrer_code: string;
  created_at: string;
}

/** Internal view model returned by the computation layer */
export interface AnalyticsViewData {
  total: number;
  sortedPlatforms: Array<[string, number]>;
  topReferrers: Array<[string, number]>;
  trendLabels: string[];
  trendData: number[];
  uniqueSharers: number;
  peakDay: { day: string; count: number };
  avgPerDay: number;
  insights: string[];
}


/**
 * Filters share events to the last N days (0 = all time).
 * Pure function.
 */
export function filterByDays(shares: ShareEvent[], days: number): ShareEvent[] {
  if (days === 0) return shares;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return shares.filter((s) => new Date(s.created_at) >= cutoff);
}

/**
 * Computes all analytics data needed for the Share Analytics tab.
 * Pure function — no side effects.
 */
export function computeAnalyticsData(filteredShares: ShareEvent[]): AnalyticsViewData {
  const total = filteredShares.length;

  const platformCounts: Record<string, number> = {};
  filteredShares.forEach((s) => {
    platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
  });
  const sortedPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);

  const referrerCounts: Record<string, number> = {};
  filteredShares.forEach((s) => {
    referrerCounts[s.referrer_code] = (referrerCounts[s.referrer_code] || 0) + 1;
  });
  const topReferrers = Object.entries(referrerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const dailyCounts: Record<string, number> = {};
  filteredShares.forEach((s) => {
    const day = new Date(s.created_at).toISOString().split('T')[0];
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });
  const sortedDays = Object.keys(dailyCounts).sort().slice(-14);
  const trendLabels = sortedDays;
  const trendData = sortedDays.map((day) => dailyCounts[day] || 0);

  const uniqueSharers = new Set(filteredShares.map((s) => s.referrer_code)).size;

  let peakDay = { day: '-', count: 0 };
  Object.entries(dailyCounts).forEach(([day, count]) => {
    if (count > peakDay.count) peakDay = { day, count };
  });

  const avgPerDay = trendData.length > 0 ? Math.round(total / trendData.length) : 0;

  const insights: string[] = [];
  if (sortedPlatforms.length > 0) {
    const top = sortedPlatforms[0];
    insights.push(`<strong>${top[0]}</strong> is your strongest channel (${Math.round((top[1] / total) * 100)}% of shares)`);
  }
  if (topReferrers.length >= 3) {
    const top3 = topReferrers.slice(0, 3).reduce((sum, [, c]) => sum + c, 0);
    insights.push(`Your top 3 referrers drive <strong>${Math.round((top3 / total) * 100)}%</strong> of all shares`);
  }
  if (trendData.length >= 5) {
    const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2)).reduce((a, b) => a + b, 0);
    const secondHalf = trendData.slice(Math.floor(trendData.length / 2)).reduce((a, b) => a + b, 0);
    if (secondHalf > firstHalf * 1.4) insights.push(`Shares have <strong>increased sharply</strong> recently`);
    else if (secondHalf < firstHalf * 0.6) insights.push(`Shares have <strong>declined</strong> recently`);
  }
  insights.push(`Peak day: <strong>${peakDay.day}</strong> with ${peakDay.count} shares`);

  return {
    total,
    sortedPlatforms,
    topReferrers,
    trendLabels,
    trendData,
    uniqueSharers,
    peakDay,
    avgPerDay,
    insights,
  };
}

/**
 * Simple number formatter used in the analytics UI.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}
