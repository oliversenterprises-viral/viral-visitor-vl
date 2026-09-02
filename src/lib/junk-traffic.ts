/**
 * Traffic-exchange / rotator sources that burn Disk IO (writes + homepage polls)
 * without converting. Edge re-exports this file from supabase/functions/_shared/junk-traffic.ts.
 */

const JUNK_SOURCES = new Set([
  'rotate4all',
  'hitleap',
  'hits4pay',
  'trafficadbar',
  'trafficexchange',
  'easyhits4u',
  'addme',
  'websitetraffice',
  'websitetraffic',
  'hit2visit',
  'traffup',
  'herculist',
  'pagerankcafe',
  'leadsleap',
  'scout',
]);

const JUNK_NEEDLES = [
  'rotate4all',
  'hitleap',
  'hits4pay',
  'trafficadbar',
  'trafficexchange',
  'traffup',
  'herculist',
  'pagerankcafe',
  'leadsleap',
  'scout',
];

function normalizeSource(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isJunkTrafficSource(source: string | null | undefined): boolean {
  const s = normalizeSource(source);
  if (!s) return false;
  if (JUNK_SOURCES.has(s)) return true;
  return JUNK_NEEDLES.some((needle) => s.includes(needle));
}

export type LandingAttribution = {
  refCode?: string | null;
  affCode?: string | null;
  path?: string | null;
};

/** Friend /r/ or promoter /a/ arrival — these SiteLanding rows may persist. */
export function isAttributedLanding(attr?: LandingAttribution | null): boolean {
  if (!attr) return false;
  if (String(attr.refCode || '').trim()) return true;
  if (String(attr.affCode || '').trim()) return true;
  const path = String(attr.path || '').trim();
  return /^\/r\//i.test(path) || /^\/a\//i.test(path);
}

/**
 * Persist SiteLanding only for friend / promoter arrivals.
 * Homepage / rotator landings increment the daily visit counter instead (Edge).
 * Conversion events always persist. utmSource kept so client + Edge stay in sync.
 */
export function shouldSkipServerLandingWrite(
  eventName: string,
  _utmSource?: string | null,
  attribution?: LandingAttribution | null,
): boolean {
  if (eventName !== 'SiteLanding') return false;
  return !isAttributedLanding(attribution);
}

/** Desk / cheap counter: friend or promoter arrivals still count even with a junk UTM. */
export function shouldIncrementQualityLandingVisit(
  eventName: string,
  utmSource?: string | null,
  attribution?: LandingAttribution | null,
): boolean {
  if (eventName !== 'SiteLanding') return false;
  if (isAttributedLanding(attribution)) return true;
  return !isJunkTrafficSource(utmSource);
}

/** Homepage rotator / exchange hits — never the quality Visits tile. */
export function shouldIncrementJunkLandingVisit(
  eventName: string,
  utmSource?: string | null,
  attribution?: LandingAttribution | null,
): boolean {
  if (eventName !== 'SiteLanding') return false;
  if (isAttributedLanding(attribution)) return false;
  return isJunkTrafficSource(utmSource);
}

export function isJunkUtmEvent(event: {
  utm_source?: unknown;
  utmSource?: unknown;
}): boolean {
  return isJunkTrafficSource(String(event.utm_source || event.utmSource || ''));
}
