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

export const HERO_CTA_COPY: Record<HeroCtaVariant, HeroCtaCopy> = {
  control: {
    titleLine1: 'Get your free link in 30 seconds.',
    titleAccent: 'Climb to #1 — claim homepage feature.',
    subtitle:
      'Free worldwide. No signup. Copy your link and share anywhere — every referral moves you up the live board.',
    trustLine: 'Open worldwide • No email • No payment • Your link in ~5 seconds',
    buttonLabel: 'Get my referral link',
  },
  prize: {
    badge: 'WORLDWIDE • FREE LEADERBOARD',
    titleLine1: 'Claim a homepage feature for your site.',
    titleAccent: 'Get your link in 30 seconds — climb to #1.',
    subtitle:
      'Open worldwide. Free forever. No signup. Tap below, copy your link, share once — every friend who visits moves you up the live board.',
    trustLine: 'Worldwide 18+ • Homepage feature for #1 • No cash prize',
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
  if (variant !== 'prize') return;

  applyHeroCopyToDom(HERO_CTA_COPY.prize);
}
