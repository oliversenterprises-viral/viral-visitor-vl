/**
 * UTM-aware hero copy — match cold-ad traffic intent (traffic exchanges, social).
 */

import { isReferredLanding } from './funnel-conversion';
import type { HeroCtaCopy } from './hero-cta-variant';
import { LOCKED_SITE_DROPS_H1_ACCENT, LOCKED_SITE_DROPS_H1_LINE1 } from './site-drops-copy';
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

const UTM_HERO_COPY: Record<UtmHeroSegment, HeroCtaCopy> = {
  traffic_exchange: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: LOCKED_SITE_DROPS_H1_LINE1,
    titleAccent: LOCKED_SITE_DROPS_H1_ACCENT,
    subtitle: 'Open worldwide. No signup. Share anywhere for homepage feature.',
    trustLine: 'Homepage feature for #1 · Link in ~5 seconds',
    buttonLabel: 'Get my link',
  },
  linkedin: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: LOCKED_SITE_DROPS_H1_LINE1,
    titleAccent: LOCKED_SITE_DROPS_H1_ACCENT,
    subtitle: 'Built for builders — one tap, share, climb the worldwide board.',
    trustLine: 'No email · Free forever · Worldwide 18+',
    buttonLabel: 'Get my link',
  },
  reddit: {
    badge: 'FREE • NO SIGNUP',
    titleLine1: LOCKED_SITE_DROPS_H1_LINE1,
    titleAccent: LOCKED_SITE_DROPS_H1_ACCENT,
    subtitle:
      'No account. No app install. Get a unique referral link in seconds, share it, and watch your rank update live.',
    trustLine: 'Step 1: Get link · Step 2: Share · Homepage feature for verified #1',
    buttonLabel: 'Get my link',
  },
  /** Paid ads (Reddit CPC etc.) — same intent, even more conversion-focused. */
  paid: {
    badge: 'FREE • 30 SECONDS',
    titleLine1: LOCKED_SITE_DROPS_H1_LINE1,
    titleAccent: LOCKED_SITE_DROPS_H1_ACCENT,
    subtitle:
      'You are one tap from your unique link. Share it with friends — real referrals move the live leaderboard.',
    trustLine: 'No signup · Free forever · Share once to start',
    buttonLabel: 'Get my link',
  },
  telegram: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: LOCKED_SITE_DROPS_H1_LINE1,
    titleAccent: LOCKED_SITE_DROPS_H1_ACCENT,
    subtitle: 'Share in chats or channels. Every referral counts live.',
    trustLine: 'Open worldwide · No signup · Instant link',
    buttonLabel: 'Get my link',
  },
  social: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: LOCKED_SITE_DROPS_H1_LINE1,
    titleAccent: LOCKED_SITE_DROPS_H1_ACCENT,
    subtitle: 'Open worldwide. Free forever. One tap, then share.',
    trustLine: 'Worldwide 18+ · Homepage feature for #1',
    buttonLabel: 'Get my link',
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
