/** Shared helpers for Referrals + Share Analytics admin tracking hubs. */

import type { AnalyticsViewData, ShareEvent } from './share-analytics-helpers';
import type { ShareConversionSummary } from '../lib/share-conversion';

export type AdminTabDaysFilter = 0 | 1 | 7 | 30;

export const ADMIN_TAB_DAYS_OPTIONS: ReadonlyArray<{ days: AdminTabDaysFilter; label: string }> = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 0, label: 'All time' },
];

export const REFERRALS_DAYS_STORAGE_KEY = 'vr_admin_referrals_filter_days';
export const SHARES_DAYS_STORAGE_KEY = 'vr_admin_shares_filter_days';
export const REFERRALS_AUTOREFRESH_KEY = 'vr_admin_autorefresh_referrals_ms';
export const SHARES_AUTOREFRESH_KEY = 'vr_admin_autorefresh_shares_ms';

export function parseAdminTabDaysFilter(raw: string | null): AdminTabDaysFilter {
  const n = Number(raw);
  if (n === 0 || n === 1 || n === 7 || n === 30) return n as AdminTabDaysFilter;
  return 0;
}

export function getStoredAdminTabDaysFilter(storageKey: string): AdminTabDaysFilter {
  try {
    return parseAdminTabDaysFilter(localStorage.getItem(storageKey));
  } catch {
    return 0;
  }
}

export function storeAdminTabDaysFilter(storageKey: string, days: AdminTabDaysFilter): void {
  try {
    localStorage.setItem(storageKey, String(days));
  } catch {
    /* non-fatal */
  }
}

export function adminTabDaysLabel(days: AdminTabDaysFilter): string {
  return ADMIN_TAB_DAYS_OPTIONS.find((o) => o.days === days)?.label ?? 'All time';
}

export function buildAdminTabDaysSelectHtml(
  storageKey: string,
  selectAttr: string,
  current?: AdminTabDaysFilter,
): string {
  const active = current ?? getStoredAdminTabDaysFilter(storageKey);
  const options = ADMIN_TAB_DAYS_OPTIONS.map(
    ({ days, label }) =>
      `<option value="${days}"${days === active ? ' selected' : ''}>${label}</option>`,
  ).join('');
  return `
    <label class="inline-flex items-center gap-1 text-[9px] text-zinc-500">
      <span>Range</span>
      <select ${selectAttr} class="bg-zinc-900 border border-white/15 rounded px-1 py-0.5 text-[9px] text-zinc-200 focus:border-violet-500/50">
        ${options}
      </select>
    </label>`;
}

export interface ReferralTrackingSummary {
  totalReal: number;
  inView: number;
  uniqueReferrers: number;
  today: number;
  highRiskIps: number;
  filterDays: AdminTabDaysFilter;
  topReferrer: string;
  topReferrerCount: number;
}

export function computeReferralTrackingSummary(
  totalReal: number,
  highRiskIpCount: number,
  filteredRows: ReadonlyArray<{ referrer_code?: string; created_at: string }>,
  filterDays: AdminTabDaysFilter,
): ReferralTrackingSummary {
  const uniqueReferrers = new Set(filteredRows.map((r) => r.referrer_code)).size;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = filteredRows.filter((r) => new Date(r.created_at) >= today).length;

  const counts: Record<string, number> = {};
  filteredRows.forEach((r) => {
    const code = r.referrer_code || 'unknown';
    counts[code] = (counts[code] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return {
    totalReal,
    inView: filteredRows.length,
    uniqueReferrers,
    today: todayCount,
    highRiskIps: highRiskIpCount,
    filterDays,
    topReferrer: top?.[0] ?? '—',
    topReferrerCount: top?.[1] ?? 0,
  };
}

export interface ShareTrackingSummary {
  totalAllTime: number;
  inView: number;
  uniqueSharers: number;
  platforms: number;
  topPlatform: string;
  topPlatformCount: number;
  peakDay: string;
  peakDayCount: number;
  conversionLeader: string;
  filterDays: AdminTabDaysFilter;
  testShareCount: number;
}

export function computeShareTrackingSummary(
  allShares: readonly ShareEvent[],
  filteredShares: readonly ShareEvent[],
  viewData: AnalyticsViewData,
  conversion: ShareConversionSummary,
  testShareCount: number,
  filterDays: AdminTabDaysFilter,
): ShareTrackingSummary {
  const topPlatform = viewData.sortedPlatforms[0];
  const leader = conversion.leaderVariant
    ? conversion.leaderVariant === 'a'
      ? 'Variant A'
      : 'Variant B'
    : '—';

  return {
    totalAllTime: allShares.length,
    inView: filteredShares.length,
    uniqueSharers: viewData.uniqueSharers,
    platforms: viewData.sortedPlatforms.length,
    topPlatform: topPlatform?.[0] ?? '—',
    topPlatformCount: topPlatform?.[1] ?? 0,
    peakDay: viewData.peakDay.day,
    peakDayCount: viewData.peakDay.count,
    conversionLeader: leader,
    filterDays,
    testShareCount,
  };
}

