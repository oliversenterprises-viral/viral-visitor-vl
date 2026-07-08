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
    badge: 'FREE $10 CONTEST • 30 SECONDS',
    titleLine1: 'Free $10 contest — one tap, get your link.',
    titleAccent: 'No signup. No email. Climb the live board.',
    subtitle:
      'Tap below — your unique link appears in seconds. Share anywhere to compete for #1 and a homepage feature.',
    trustLine: 'Real Cash App prize · Board wide open · Your link in ~5 seconds',
    buttonLabel: 'Get my free link now',
  },
  linkedin: {
    badge: 'LIVE REFERRAL CONTEST',
    titleLine1: 'No-signup referral contest — try it in 30 seconds.',
    titleAccent: 'Free link, live leaderboard, real $10 Cash App prize.',
    subtitle:
      'Built for builders and marketers: tap once, copy your link, share anywhere. Every visit moves you up the board.',
    trustLine: 'No email wall · Skill-based contest · US 18+',
    buttonLabel: 'Get my free contest link',
  },
  reddit: {
    badge: 'BUILDER-FRIENDLY CONTEST',
    titleLine1: 'Free referral leaderboard — no signup friction.',
    titleAccent: 'Get your link in ~30 sec, then share to climb.',
    subtitle:
      'We optimized step 1 (get link) on purpose. Tap below, copy your URL, share once — watch the live board move.',
    trustLine: 'Transparent contest · $10 + homepage for #1 · Rules on site',
    buttonLabel: 'Get my link — 30 seconds',
  },
  telegram: {
    badge: '🏆 VIRALREFER CONTEST',
    titleLine1: 'Free link in ~30 seconds — climb to #1.',
    titleAccent: 'Win homepage feature + $10 Cash App.',
    subtitle:
      'Tap below to generate your unique link. Share in chats or channels — every referral counts on the live board.',
    trustLine: 'No signup · Instant link · Board still wide open',
    buttonLabel: 'Get my free contest link',
  },
  social: {
    badge: '2026 CASH PRIZE • FREE TO JOIN',
    titleLine1: 'Win $10 Cash App + homepage feature.',
    titleAccent: 'Get your free link in 30 seconds.',
    subtitle:
      'Free contest. Tap below, copy your link, share once — every friend who visits moves you up the live board.',
    trustLine: 'Real prize · No email · ~5 sec to your link',
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