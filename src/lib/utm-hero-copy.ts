/**
 * UTM-aware hero copy — match cold-ad traffic intent (traffic exchanges, social).
 */

import { isReferredLanding } from './funnel-conversion';
import type { HeroCtaCopy } from './hero-cta-variant';
import { getStoredUtmAttribution } from './utm-attribution';

export type UtmHeroSegment =
  | 'traffic_exchange'
  | 'linkedin'
  | 'reddit'
  | 'telegram'
  | 'social'
  | 'paid';

const TRAFFIC_EXCHANGE_SOURCES = new Set([
  'pagerankcafe',
  'trafficadbar',
  'traffic_ad_bar',
  'herculist',
  'etrafficboss',
]);

/** Live homepage only. Do not paint a second product. */
const LIVE_HERO: HeroCtaCopy = {
  badge: 'THIS WEEK • FREE • NO SIGNUP',
  titleLine1: 'Win the homepage.',
  titleAccent: 'Each step puts your site on this page. #1 owns the banner for 7 days.',
  subtitle:
    'Get a link. Send it. When a friend taps Get my link, your site can go live here — Rising drop, text line, then the banner.',
  trustLine: 'Open worldwide · recognition only · Site Drop ladder.',
  buttonLabel: 'Get my referral link',
};

const UTM_HERO_COPY: Record<UtmHeroSegment, HeroCtaCopy> = {
  traffic_exchange: LIVE_HERO,
  linkedin: LIVE_HERO,
  reddit: LIVE_HERO,
  paid: LIVE_HERO,
  telegram: LIVE_HERO,
  social: LIVE_HERO,
};

/** Resolve UTM source + medium to a hero copy segment. */
export function resolveUtmHeroSegment(
  source: string | null | undefined,
  medium: string | null | undefined,
): UtmHeroSegment | null {
  const src = String(source || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  const med = String(medium || '')
    .trim()
    .toLowerCase();

  if (!src) return null;

  if (
    TRAFFIC_EXCHANGE_SOURCES.has(src) ||
    src === 'traffic_exchange' ||
    med === 'traffic_exchange' ||
    med === 'iframe'
  ) {
    return 'traffic_exchange';
  }
  if (src === 'linkedin') return 'linkedin';
  if (src === 'reddit') return 'reddit';
  if (src === 'telegram') return 'telegram';
  // Paid medium wins over generic social so ad landers get conversion copy
  if (med === 'paid' || med === 'cpc' || med === 'cpm' || med === 'ppc') return 'paid';
  if (med === 'social' || med === 'organic') return 'social';

  return null;
}

export function resolveUtmHeroCopy(
  source: string | null | undefined,
  medium: string | null | undefined,
): HeroCtaCopy | null {
  const segment = resolveUtmHeroSegment(source, medium);
  return segment ? UTM_HERO_COPY[segment] : null;
}

/** Apply UTM-tailored hero on direct landings when utm_source is set (overrides prize default). */
export function applyUtmHeroCopy(): boolean {
  if (isReferredLanding()) return false;

  const utm = getStoredUtmAttribution();
  const copy = resolveUtmHeroCopy(utm?.source, utm?.medium);
  if (!copy) return false;

  // 8:44 lock: same homepage for every visitor. Do not paint UTM variants.
  const src = String(utm?.source || '').trim().toLowerCase();
  if (src) document.documentElement.setAttribute('data-vr-utm-source', src);
  return true;
}
