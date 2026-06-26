/** Pure helpers for visitor funnel stats panels — NovaCodeSwarm-Goal closure verified. */

/** Owner/admin IPs hidden from funnel stats display only (recording unchanged). */
export const ADMIN_FUNNEL_EXCLUDED_IPS = ['161.38.136.60'] as const;

/** ip_hash prefix for 161.38.136.60 (VISITOR_IP_HASH_SALT viralrefer-visitor-v1). */
export const ADMIN_FUNNEL_EXCLUDED_IP_HASHES = ['d8399295624890754c844c12'] as const;

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
  const landings = funnel.find((r) => r.name === 'SiteLanding')?.count ?? 0;
  const claims = funnel.find((r) => r.name === 'SubmitPrizeClaim')?.count ?? 0;
  const conversion =
    landings > 0 ? `${((claims / landings) * 100).toFixed(1)}%` : '—';
  return { totalEvents, landings, claims, conversion };
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

/** Resolved client IP when present on a funnel event (metadata or legacy top-level). */
export function getVisitorEventIp(event: Record<string, unknown>): string {
  const meta = metadataRecord(event);
  return String(meta.client_ip || event.client_ip || event.clientIp || '').trim();
}

export function isExcludedVisitorFunnelEvent(
  event: Record<string, unknown>,
  excludedIps: readonly string[] = ADMIN_FUNNEL_EXCLUDED_IPS,
  excludedHashes: readonly string[] = ADMIN_FUNNEL_EXCLUDED_IP_HASHES,
): boolean {
  const ip = getVisitorEventIp(event);
  if (ip && excludedIps.some((blocked) => blocked === ip)) return true;

  const hash = String(event.ip_hash || event.ipHash || '').trim().toLowerCase();
  if (!hash) return false;
  return excludedHashes.some(
    (blocked) => hash === blocked.toLowerCase() || hash.startsWith(blocked.toLowerCase()),
  );
}

/** Drop owner/test IPs from admin funnel panels — does not affect server recording. */
export function filterExcludedVisitorFunnelEvents(
  events: readonly Record<string, unknown>[],
  excludedIps: readonly string[] = ADMIN_FUNNEL_EXCLUDED_IPS,
  excludedHashes: readonly string[] = ADMIN_FUNNEL_EXCLUDED_IP_HASHES,
): Record<string, unknown>[] {
  return events.filter((e) => !isExcludedVisitorFunnelEvent(e, excludedIps, excludedHashes));
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