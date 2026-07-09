/**
 * UTM-aware hero copy — match cold-ad traffic intent (traffic exchanges, social).
 */

import { isReferredLanding } from './funnel-conversion';
import { applyHeroCopyToDom, type HeroCtaCopy } from './hero-cta-variant';
import { getStoredUtmAttribution } from './utm-attribution';

export type UtmHeroSegment = 'traffic_exchange' | 'linkedin' | 'reddit' | 'telegram' | 'social';

const TRAFFIC_EXCHANGE_SOURCES = new Set([
  'pagerankcafe',
  'trafficadbar',
  'traffic_ad_bar',
  'herculist',
  'etrafficboss',
]);

const UTM_HERO_COPY: Record<UtmHeroSegment, HeroCtaCopy> = {
  traffic_exchange: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: 'Get your free link in 30 seconds.',
    titleAccent: 'One tap — climb the live board.',
    subtitle: 'Open worldwide. No signup. Share anywhere for homepage feature.',
    trustLine: 'Homepage feature for #1 · Link in ~5 seconds',
    buttonLabel: 'Get my free link now',
  },
  linkedin: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: 'Get your free link in 30 seconds.',
    titleAccent: 'Live rankings. Homepage feature for #1.',
    subtitle: 'Built for builders — one tap, share, climb the worldwide board.',
    trustLine: 'No email · Free forever · Worldwide 18+',
    buttonLabel: 'Get my free link',
  },
  reddit: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: 'Get your free link in 30 seconds.',
    titleAccent: 'No signup friction. Share to climb.',
    subtitle: 'Open worldwide. Tap below, copy, share once — watch the board move.',
    trustLine: 'Homepage feature for #1 · Rules on site',
    buttonLabel: 'Get my link — 30 seconds',
  },
  telegram: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: 'Get your free link in 30 seconds.',
    titleAccent: 'Climb to #1 — claim homepage feature.',
    subtitle: 'Share in chats or channels. Every referral counts live.',
    trustLine: 'Open worldwide · No signup · Instant link',
    buttonLabel: 'Get my free link',
  },
  social: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: 'Get your free link in 30 seconds.',
    titleAccent: 'Climb the live board. Claim a homepage feature.',
    subtitle: 'Open worldwide. Free forever. One tap, then share.',
    trustLine: 'Worldwide 18+ · Homepage feature for #1',
    buttonLabel: 'Get my free link',
  },
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
  if (med === 'social' || med === 'paid' || med === 'organic') return 'social';

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

  applyHeroCopyToDom(copy);
  const src = String(utm?.source || '').trim().toLowerCase();
  if (src) document.documentElement.setAttribute('data-vr-utm-source', src);
  return true;
}
