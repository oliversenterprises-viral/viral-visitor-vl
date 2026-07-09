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
    badge: 'WORLDWIDE LEADERBOARD • 30 SECONDS',
    titleLine1: 'Worldwide free leaderboard — one tap, get your link.',
    titleAccent: 'No signup. No email. Climb the live board.',
    subtitle:
      'Tap below — your unique link appears in seconds. Share anywhere to compete for #1 and a homepage feature.',
    trustLine: 'Open worldwide · Homepage feature for #1 · No cash prize',
    buttonLabel: 'Get my free link now',
  },
  linkedin: {
    badge: 'WORLDWIDE REFERRAL LEADERBOARD',
    titleLine1: 'No-signup referral board — try it in 30 seconds.',
    titleAccent: 'Free worldwide, live rankings, homepage feature for #1.',
    subtitle:
      'Built for builders and marketers: tap once, copy your link, share anywhere. Every visit moves you up the board.',
    trustLine: 'No email wall · Free forever · Worldwide 18+',
    buttonLabel: 'Get my free link',
  },
  reddit: {
    badge: 'WORLDWIDE · BUILDER-FRIENDLY',
    titleLine1: 'Free referral leaderboard — no signup friction.',
    titleAccent: 'Get your link in ~30 sec, then share to climb.',
    subtitle:
      'We optimized step 1 (get link) on purpose. Tap below, copy your URL, share once — watch the live board move.',
    trustLine: 'Open worldwide · Homepage feature for #1 · No cash prize',
    buttonLabel: 'Get my link — 30 seconds',
  },
  telegram: {
    badge: '🏆 WORLDWIDE LEADERBOARD',
    titleLine1: 'Free link in ~30 seconds — climb to #1.',
    titleAccent: 'Claim a homepage feature for your site.',
    subtitle:
      'Tap below to generate your unique link. Share in chats or channels — every referral counts on the live board.',
    trustLine: 'Open worldwide · No signup · No cash prize',
    buttonLabel: 'Get my free link',
  },
  social: {
    badge: 'WORLDWIDE • FREE • NO SIGNUP',
    titleLine1: 'Climb the live board — claim a homepage feature.',
    titleAccent: 'Get your free link in 30 seconds.',
    subtitle:
      'Open worldwide. Free forever. Tap below, copy your link, share once — every friend who visits moves you up the live board.',
    trustLine: 'Worldwide 18+ · No cash prize · ~5 sec to your link',
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
