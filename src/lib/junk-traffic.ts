/**
 * Traffic-exchange / rotator sources that burn Disk IO (writes + homepage polls)
 * without converting. Keep in sync with supabase/functions/_shared/junk-traffic.ts.
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

/**
 * Never persist SiteLanding (rotator / cheap traffic floods the table + ipapi).
 * Conversion events (GetReferralLink, Copy, Share, prize claim) always persist.
 * utmSource kept so client + Edge call sites stay in sync.
 */
export function shouldSkipServerLandingWrite(
  eventName: string,
  _utmSource?: string | null,
): boolean {
  return eventName === 'SiteLanding';
}
