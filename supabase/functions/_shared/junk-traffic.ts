/** Keep in sync with src/lib/junk-traffic.ts */

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

export function shouldSkipServerLandingWrite(
  eventName: string,
  utmSource: string | null | undefined,
): boolean {
  if (eventName !== 'SiteLanding') return false;
  return isJunkTrafficSource(utmSource);
}
