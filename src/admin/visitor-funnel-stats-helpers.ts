/** Pure helpers for visitor funnel stats panels — NovaCodeSwarm-Goal closure verified. */

export {
  ADMIN_FUNNEL_EXCLUDED_IPS,
  ADMIN_FUNNEL_EXCLUDED_IP_HASHES,
  countTestVisitorFunnelEvents,
  filterTestVisitorFunnelEvents,
  getVisitorEventIp,
  isOwnerVisitorFunnelEvent,
  isTestVisitorFunnelEvent,
  isTestVisitorFunnelRefCode,
} from '../../supabase/functions/_shared/visitor-funnel-test';

import {
  countTestVisitorFunnelEvents,
  filterTestVisitorFunnelEvents,
  getVisitorEventIp,
} from '../../supabase/functions/_shared/visitor-funnel-test';

export interface FunnelRow {
  name: string;
  count: number;
  unique: number;
}

export interface CountryRow {
  country: string;
  unique: number;
  events: number;
}

/** Exported for testability (pure function). */
export function countryLabel(code: string): string {
  if (!code || code === '—') return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

/** Exported for testability (pure function). */
export function filterCountryRowsForDisplay(rows: readonly CountryRow[]): CountryRow[] {
  return rows.filter((c) => c.country !== '—');
}

/** Exported for testability (pure function). */
export function sortSourceEntries(bySource: Record<string, number>): Array<[string, number]> {
  return Object.entries(bySource).sort((a, b) => b[1] - a[1]);
}

/** Exported for testability (pure function). */
export function shouldShowUtmSources(bySource: Record<string, number>): boolean {
  const entries = Object.entries(bySource);
  if (entries.length > 1) return true;
  if (entries.length === 1 && entries[0][0] !== '(direct)') return true;
  return false;
}

/** Exported for testability (pure function). */
export function computeFunnelTotals(funnel: readonly FunnelRow[]) {
  const totalEvents = funnel.reduce((s, r) => s + r.count, 0);
  const landingUnique = funnel.find((r) => r.name === 'SiteLanding')?.unique ?? 0;
  const claimUnique = funnel.find((r) => r.name === 'SubmitPrizeClaim')?.unique ?? 0;
  const conversion =
    landingUnique > 0
      ? `${((claimUnique / landingUnique) * 100).toFixed(1)}%`
      : '—';
  return {
    totalEvents,
    landings: landingUnique,
    claims: claimUnique,
    conversion,
  };
}

/** Exported for testability (pure function). */
export function topCountries(rows: readonly CountryRow[], limit = 10): CountryRow[] {
  return [...rows].slice(0, limit);
}

export interface RecentReferralNotifierRow {
  referrer_code?: string;
  referred_ip?: string;
  ip_address?: string;
  created_at?: string;
}

function metadataRecord(event: Record<string, unknown>): Record<string, unknown> {
  const meta = event.metadata;
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

/** Drop owner/smoke/test rows from admin funnel panels — does not affect server recording. */
export function filterExcludedVisitorFunnelEvents(
  events: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  return filterTestVisitorFunnelEvents(events);
}

/** @deprecated Use isTestVisitorFunnelEvent — kept for existing tests. */
export function isExcludedVisitorFunnelEvent(event: Record<string, unknown>): boolean {
  return countTestVisitorFunnelEvents([event]) === 1;
}

/** Server stores client_ip in metadata; legacy rows may only have ip_hash. */
export function formatVisitorIpLabel(event: Record<string, unknown>): string {
  const ip = getVisitorEventIp(event);
  if (ip) return ip;
  const hash = String(event.ip_hash || event.ipHash || '').trim();
  if (hash) return `${hash.slice(0, 8)}…`;
  return '';
}

/** Compact context for a funnel event row (IP, ref, country, share platform). */
export function formatRecentVisitorEventDetail(event: Record<string, unknown>): string {
  const parts: string[] = [];
  const ip = formatVisitorIpLabel(event);
  if (ip) parts.push(ip);

  const ref = String(event.ref_code || event.refCode || '').trim();
  if (ref) parts.push(`ref:${ref}`);

  const country = String(event.country_code || event.countryCode || '').trim();
  if (country && country !== '—') parts.push(country);

  const meta = metadataRecord(event);
  const platform = meta.platform;
  if (platform) parts.push(String(platform));

  const path = meta.path;
  if (path && String(event.event_name || event.eventName) === 'SiteLanding') {
    parts.push(String(path));
  }

  return parts.join(' · ');
}

export function getReferralNotifierIp(row: RecentReferralNotifierRow): string {
  const ip = row.referred_ip ?? row.ip_address;
  return typeof ip === 'string' ? ip.trim() : '';
}

/** True when referral landed within the last N minutes (for notifier highlight). */
export function isRecentReferralNotifier(
  createdAt: string | undefined,
  withinMinutes = 60,
): boolean {
  if (!createdAt) return false;
  const ms = new Date(createdAt).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms <= withinMinutes * 60_000;
}

export function countRecentReferralNotifiers(
  rows: readonly RecentReferralNotifierRow[],
  withinMinutes = 60,
): number {
  return rows.filter((r) => isRecentReferralNotifier(r.created_at, withinMinutes)).length;
}