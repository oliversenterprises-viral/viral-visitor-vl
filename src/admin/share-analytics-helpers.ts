/** Shape of a single share event as used by this analytics tab */
export type ShareAbVariantTag = 'a' | 'b' | 'unknown';

export interface ShareEvent {
  platform: string;
  referrer_code: string;
  created_at: string;
  referral_link?: string;
  ab_variant?: ShareAbVariantTag;
}

const REF_CODE_FROM_LINK_RE = /\/r\/([A-Za-z0-9_-]+)/i;

/** Extract VIRAL-XXXX from a referral URL path segment. */
export function extractReferrerCodeFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const match = String(link).match(REF_CODE_FROM_LINK_RE);
  return match?.[1] ? match[1].toUpperCase() : null;
}

/**
 * True for agent/smoke/E2E share rows — conservative patterns only (never real user codes).
 */
export function isTestShareReferrerCode(code: string): boolean {
  const c = (code || '').trim().toUpperCase();
  if (!c || c === 'UNKNOWN') return true;
  if (c === 'VIRAL-READY') return true;
  if (/PROBE/.test(c)) return true;
  if (/SMOKETEST/.test(c)) return true;
  if (/DEMOCODE/.test(c)) return true;
  if (/^DEMO\d+$/.test(c)) return true;
  if (/TESTFIX/.test(c)) return true;
  return false;
}

export function countTestShares(shares: readonly ShareEvent[]): number {
  return shares.filter((s) => isTestShareReferrerCode(s.referrer_code)).length;
}

export function listTestShareCodes(shares: readonly ShareEvent[]): string[] {
  const codes = new Set<string>();
  for (const s of shares) {
    if (isTestShareReferrerCode(s.referrer_code)) codes.add(s.referrer_code);
  }
  return [...codes].sort();
}

/** Normalize a shares row from admin-action or legacy schemas. */
export function normalizeShareRow(row: Record<string, unknown>): ShareEvent {
  const referralLink = String(row.referral_link || row.referralLink || '').trim();
  const directCode = String(row.referrer_code || row.referrerCode || '').trim();
  const fromLink = extractReferrerCodeFromLink(referralLink);
  const referrer_code =
    (directCode && directCode.toLowerCase() !== 'unknown' ? directCode : null) ||
    fromLink ||
    'unknown';

  const rawVariant = String(row.ab_variant || row.abVariant || '').toLowerCase().trim();
  const ab_variant: ShareAbVariantTag =
    rawVariant === 'a' || rawVariant === 'b' ? rawVariant : 'unknown';

  return {
    platform: String(row.platform || 'unknown').toLowerCase(),
    referrer_code,
    referral_link: referralLink || undefined,
    created_at: String(row.created_at || row.createdAt || new Date().toISOString()),
    ab_variant,
  };
}

/** Internal view model returned by the computation layer */
export interface AbVariantBreakdown {
  variant: ShareAbVariantTag;
  count: number;
  percentage: number;
}

export interface AnalyticsViewData {
  total: number;
  sortedPlatforms: Array<[string, number]>;
  topReferrers: Array<[string, number]>;
  abVariantBreakdown: AbVariantBreakdown[];
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
export function filterByDays(shares: readonly ShareEvent[], days: number): ShareEvent[] {
  if (days === 0) return [...shares];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return shares.filter((s) => new Date(s.created_at) >= cutoff);
}

/** Exported for testability (pure function). */
export function filterSharesBySearch(shares: readonly ShareEvent[], query: string): ShareEvent[] {
  const q = query.toLowerCase().trim();
  if (!q) return [...shares];
  return shares.filter(
    (s) =>
      (s.referrer_code || '').toLowerCase().includes(q) ||
      (s.platform || '').toLowerCase().includes(q),
  );
}

/** Exported for testability (pure function). */
export function filterSharesByPlatform(shares: readonly ShareEvent[], platform: string): ShareEvent[] {
  if (!platform || platform === 'all') return [...shares];
  return shares.filter((s) => (s.platform || '').toLowerCase() === platform.toLowerCase());
}

/** Applies day, search, and platform filters in one pass. */
export function applyShareFilters(
  shares: readonly ShareEvent[],
  days: number,
  search: string,
  platform: string,
): ShareEvent[] {
  let filtered = filterByDays(shares, days);
  filtered = filterSharesBySearch(filtered, search);
  filtered = filterSharesByPlatform(filtered, platform);
  return filtered;
}

/** Returns unique platform names sorted by share count (desc). */
export function getUniquePlatforms(shares: readonly ShareEvent[]): string[] {
  const counts: Record<string, number> = {};
  shares.forEach((s) => {
    const p = s.platform || 'unknown';
    counts[p] = (counts[p] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p);
}

/** Count shares by A/B variant (unknown = legacy rows without ab_variant). */
export function computeAbVariantBreakdown(
  shares: readonly ShareEvent[],
): AbVariantBreakdown[] {
  const counts: Record<ShareAbVariantTag, number> = { a: 0, b: 0, unknown: 0 };
  shares.forEach((s) => {
    const tag = s.ab_variant === 'a' || s.ab_variant === 'b' ? s.ab_variant : 'unknown';
    counts[tag] += 1;
  });
  const total = shares.length;
  const order: ShareAbVariantTag[] = ['a', 'b', 'unknown'];
  return order.map((variant) => ({
    variant,
    count: counts[variant],
    percentage: total > 0 ? Math.round((counts[variant] / total) * 100) : 0,
  }));
}

/**
 * Computes all analytics data needed for the Share Analytics tab.
 * Pure function — no side effects.
 */
export function computeAnalyticsData(filteredShares: readonly ShareEvent[]): AnalyticsViewData {
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

  const abVariantBreakdown = computeAbVariantBreakdown(filteredShares);
  const trackedAb = abVariantBreakdown.filter((r) => r.variant !== 'unknown');
  const trackedAbTotal = trackedAb.reduce((sum, r) => sum + r.count, 0);

  const insights: string[] = [];
  if (total === 0) {
    insights.push('No shares in the current view — try widening your filters.');
  } else {
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
      if (secondHalf > firstHalf * 1.4) insights.push('Shares have <strong>increased sharply</strong> recently');
      else if (secondHalf < firstHalf * 0.6) insights.push('Shares have <strong>declined</strong> recently');
    }
    insights.push(`Peak day: <strong>${peakDay.day}</strong> with ${peakDay.count} shares`);
    if (uniqueSharers > 0 && total >= 3) {
      const avg = Math.round((total / uniqueSharers) * 10) / 10;
      insights.push(`Share momentum: <strong>${avg}</strong> shares per unique sharer on average`);
    }
    if (trackedAbTotal >= 2 && trackedAb.length >= 2) {
      const leader = [...trackedAb].sort((a, b) => b.count - a.count)[0];
      insights.push(
        `A/B test: <strong>Variant ${leader.variant.toUpperCase()}</strong> leads (${leader.percentage}% of ${trackedAbTotal} tracked shares)`,
      );
    } else if (trackedAbTotal === 1 && trackedAb[0]) {
      insights.push(
        `A/B tracking: <strong>Variant ${trackedAb[0].variant.toUpperCase()}</strong> has the only tagged share so far`,
      );
    }
  }

  return {
    total,
    sortedPlatforms,
    topReferrers,
    abVariantBreakdown,
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