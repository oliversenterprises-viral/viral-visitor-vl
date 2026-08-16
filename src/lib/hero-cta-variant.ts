/**
 * P1 conversion — hero CTA A/B (feature vs control) for direct landings.
 * Referred landings keep funnel-conversion overrides.
 */

import { isReferredLanding } from './funnel-conversion';
import { getHeroCtaVariant, type HeroCtaVariant } from './optimizer-flags';

export interface HeroCtaCopy {
  badge?: string;
  titleLine1: string;
  titleAccent: string;
  subtitle: string;
  trustLine: string;
  buttonLabel: string;
}

/** Tight conversion copy — one action, worldwide, no cash spam. */
export const HERO_CTA_COPY: Record<HeroCtaVariant, HeroCtaCopy> = {
  control: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: '#1 gets a homepage banner',
    titleAccent: 'for their site.',
    subtitle: 'Tap Get my free link. Send it. When a friend taps Get my link, you climb.',
    trustLine: 'Free. No signup. No cash. Just send your link.',
    buttonLabel: 'Get my free link',
  },
  prize: {
    badge: 'WORLDWIDE • FREE',
    titleLine1: '#1 gets a homepage banner',
    titleAccent: 'for their site.',
    subtitle: 'Tap Get my free link. Send it. When a friend taps Get my link, you climb.',
    trustLine: 'Free. No signup. No cash. Just send your link.',
    buttonLabel: 'Get my free link',
  },
};

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setButtonLabel(buttonId: string, label: string): void {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  const span = btn.querySelector('span');
  if (span) span.textContent = label;
  else btn.textContent = label;
}

/** Paint hero copy onto the public homepage (direct landings only). */
export function applyHeroCopyToDom(copy: HeroCtaCopy): void {
  if (copy.badge) setText('hero-badge', copy.badge);
  setText('hero-title-line1', copy.titleLine1);
  setText('hero-title-accent', copy.titleAccent);
  setText('hero-subtitle', copy.subtitle);
  setText('hero-trust-line', copy.trustLine);
  setButtonLabel('hero-get-link-btn', copy.buttonLabel);
}

/** Apply feature-variant hero copy on direct landings (control leaves CMS/static defaults). */
export function applyHeroCtaVariant(): void {
  if (isReferredLanding()) return;

  const variant = getHeroCtaVariant();
  // control = static HTML / CMS; prize = conversion-optimized paint
  if (variant !== 'prize') return;

  applyHeroCopyToDom(HERO_CTA_COPY.prize);
}
