/**
 * Lightweight banner event helpers (local storage + pure stats).
 * Isolated from content.ts side-effects to avoid circular import bugs in admin panels.
 */

import { latestEvents } from './stats-helpers';

export const BANNER_EVENTS_KEY = 'viralrefer_banner_events';

export function getBannerKey(banner: { label?: string; redirectUrl?: string }): string {
  const lab = (banner.label || '').trim();
  const u = (banner.redirectUrl || '').trim();
  return lab && u ? `${lab}|${u}` : u || lab || 'unknown';
}

export function getLocalBannerEvents(): Array<Record<string, unknown>> {
  try {
    return JSON.parse(localStorage.getItem(BANNER_EVENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearBannerEvents(): void {
  localStorage.removeItem(BANNER_EVENTS_KEY);
}

export function computeBannerStats(events: Array<Record<string, unknown>>) {
  const perBannerMap: Record<
    string,
    { key: string; label: string; redirectUrl: string; impressions: number; clicks: number }
  > = {};

  for (const e of events) {
    const key = String(
      e.key ||
        getBannerKey({
          label: typeof e.label === 'string' ? e.label : undefined,
          redirectUrl:
            typeof e.redirectUrl === 'string'
              ? e.redirectUrl
              : typeof e.redirect_url === 'string'
                ? e.redirect_url
                : undefined,
        }),
    );
    if (!perBannerMap[key]) {
      perBannerMap[key] = {
        key,
        label: String(e.label || key.split('|')[0] || 'untitled'),
        redirectUrl: String(e.redirectUrl || e.redirect_url || ''),
        impressions: 0,
        clicks: 0,
      };
    }
    const eventType = String(e.type || e.event_type || '').toLowerCase();
    if (eventType === 'impression') perBannerMap[key].impressions++;
    else if (eventType === 'click') perBannerMap[key].clicks++;
  }

  return {
    perBanner: Object.values(perBannerMap),
    lastEvents: latestEvents(events, 5),
    total: events.length,
  };
}
