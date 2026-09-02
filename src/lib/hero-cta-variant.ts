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
    badge: 'THIS WEEK • FREE • NO SIGNUP',
    titleLine1: 'Win the homepage.',
    titleAccent: 'Each step puts your site on this page. #1 owns the banner for 7 days.',
    subtitle:
      'Get a link. Send it. When a friend taps Get my link, your site can go live here — Rising drop, text line, then the banner.',
    trustLine: 'Open worldwide · recognition only · Site Drop ladder.',
    buttonLabel: 'Get my referral link',
  },
  prize: {
    badge: 'THIS WEEK • FREE • NO SIGNUP',
    titleLine1: 'Win the homepage.',
    titleAccent: 'Each step puts your site on this page. #1 owns the banner for 7 days.',
    subtitle:
      'Get a link. Send it. When a friend taps Get my link, your site can go live here — Rising drop, text line, then the banner.',
    trustLine: 'Open worldwide · recognition only · Site Drop ladder.',
    buttonLabel: 'Get my referral link',
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

/** Paint only the locked live Site Drop homepage lines. */
export function applyHeroCopyToDom(copy: HeroCtaCopy): void {
  setText('hero-title-line1', copy.titleLine1);
  setText('hero-title-accent', copy.titleAccent);
  setText('hero-subtitle', copy.subtitle);
  setButtonLabel('hero-get-link-btn', copy.buttonLabel);
}

/** Re-assert live Site Drop copy after CMS / i18n / A/B. Do not invent new lines. */
export function lock844HomepageCopy(): void {
  if (isReferredLanding()) return;
  applyHeroCopyToDom(HERO_CTA_COPY.control);
  setText(
    'hero-prize-one',
    'Paste your website in the slot. 1 friend → Rising drop. 2 → text line. #1 (not the owner) with 3+ friends → 7-day banner.',
  );
}

/** Apply feature-variant hero copy on direct landings (control leaves CMS/static defaults). */
export function applyHeroCtaVariant(): void {
  if (isReferredLanding()) return;

  const variant = getHeroCtaVariant();
  // control = static HTML / CMS; prize = conversion-optimized paint
  if (variant !== 'prize') return;

  applyHeroCopyToDom(HERO_CTA_COPY.prize);
}
