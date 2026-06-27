/**
 * Shared owner/smoke/automation detection for Edit Content admin stats
 * (visitor_events + banner_events).
 */

import { ADMIN_FUNNEL_EXCLUDED_IPS } from './visitor-funnel-test.ts';

export {
  ADMIN_FUNNEL_EXCLUDED_IPS,
  getVisitorEventIp,
  groupVisitorEventsByIp,
  isTestVisitorFunnelEvent,
  filterTestVisitorFunnelEvents,
  countTestVisitorFunnelEvents,
} from './visitor-funnel-test.ts';

/** Azure / GitHub Actions / Playwright egress ranges used by smoke & E2E. */
export const AZURE_SMOKE_IP_RE = /^20\.|^48\.|^52\.|^74\.|^135\./;

export function isAutomationUserAgent(ua: string | null | undefined): boolean {
  const s = String(ua || '').trim();
  if (!s) return false;
  if (s === 'node') return true;
  if (/HeadlessChrome/i.test(s)) return true;
  if (/\b(vitest|playwright|smoke|headless|automation)\b/i.test(s)) return true;
  return false;
}

export function isOwnerStatsIp(ip: string | null | undefined): boolean {
  const normalized = String(ip || '').trim();
  if (!normalized) return false;
  return (ADMIN_FUNNEL_EXCLUDED_IPS as readonly string[]).includes(normalized);
}

export function isProbeStatsIp(ip: string | null | undefined): boolean {
  return /^203\.0\.113\./.test(String(ip || '').trim());
}

export function getBannerEventIp(row: Record<string, unknown>): string {
  const additional =
    row.additional && typeof row.additional === 'object'
      ? (row.additional as Record<string, unknown>)
      : {};
  return String(row.ip || row.ip_address || additional.ip || '').trim();
}

export function getBannerEventUserAgent(row: Record<string, unknown>): string {
  const additional =
    row.additional && typeof row.additional === 'object'
      ? (row.additional as Record<string, unknown>)
      : {};
  return String(row.user_agent || additional.user_agent || '').trim();
}

/** Owner IP, probe nets, headless/smoke UA, or Azure smoke egress. */
export function isTestBannerEvent(row: Record<string, unknown>): boolean {
  const ip = getBannerEventIp(row);
  if (isOwnerStatsIp(ip)) return true;
  if (isProbeStatsIp(ip)) return true;

  const ua = getBannerEventUserAgent(row);
  if (isAutomationUserAgent(ua)) return true;

  if (AZURE_SMOKE_IP_RE.test(ip) && isAutomationUserAgent(ua)) return true;

  return false;
}

export function filterTestBannerEvents(
  events: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  return events.filter((event) => !isTestBannerEvent(event));
}

export function countTestBannerEvents(events: readonly Record<string, unknown>[]): number {
  return events.length - filterTestBannerEvents(events).length;
}