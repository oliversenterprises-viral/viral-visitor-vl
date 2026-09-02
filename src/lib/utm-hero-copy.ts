/**
 * UTM-aware hero copy — match cold-ad traffic intent (traffic exchanges, social).
 */

import { isReferredLanding } from './funnel-conversion';
import { applyHeroCopyToDom, type HeroCtaCopy } from './hero-cta-variant';
import { LOCKED_CTA, LOCKED_H1_ACCENT, LOCKED_H1_LINE1, LOCKED_SUB } from './prize-slot';
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
    titleLine1: LOCKED_H1_LINE1,
    titleAccent: LOCKED_H1_ACCENT,
    subtitle: LOCKED_SUB,
    trustLine: '',
    buttonLabel: LOCKED_CTA,
  },
  linkedin: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: LOCKED_H1_LINE1,
    titleAccent: LOCKED_H1_ACCENT,
    subtitle: LOCKED_SUB,
    trustLine: '',
    buttonLabel: LOCKED_CTA,
  },
  reddit: {
    badge: 'FREE • NO SIGNUP',
    titleLine1: LOCKED_H1_LINE1,
    titleAccent: LOCKED_H1_ACCENT,
    subtitle: LOCKED_SUB,
    trustLine: '',
    buttonLabel: LOCKED_CTA,
  },
  /** Paid ads (Reddit CPC etc.) — same intent, even more conversion-focused. */
  paid: {
    badge: 'FREE • 30 SECONDS',
    titleLine1: LOCKED_H1_LINE1,
    titleAccent: LOCKED_H1_ACCENT,
    subtitle: LOCKED_SUB,
    trustLine: '',
    buttonLabel: LOCKED_CTA,
  },
  telegram: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: LOCKED_H1_LINE1,
    titleAccent: LOCKED_H1_ACCENT,
    subtitle: LOCKED_SUB,
    trustLine: '',
    buttonLabel: LOCKED_CTA,
  },
  social: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: LOCKED_H1_LINE1,
    titleAccent: LOCKED_H1_ACCENT,
    subtitle: LOCKED_SUB,
    trustLine: '',
    buttonLabel: LOCKED_CTA,
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

  applyHeroCopyToDom(copy);
  const src = String(utm?.source || '').trim().toLowerCase();
  if (src) document.documentElement.setAttribute('data-vr-utm-source', src);
  return true;
}
