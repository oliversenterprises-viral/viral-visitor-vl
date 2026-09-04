/**
 * P1 conversion — hero CTA A/B (feature vs control) for direct landings.
 * Referred landings keep funnel-conversion overrides.
 */

import { isReferredLanding } from './funnel-conversion';
import { getHeroCtaVariant, type HeroCtaVariant } from './optimizer-flags';
import {
  LOCKED_LIVE_FUNNEL_BADGE,
  LOCKED_LIVE_HOW_BADGE,
  LOCKED_LIVE_HOW_STEP1_DESC,
  LOCKED_LIVE_HOW_STEP2_DESC,
  LOCKED_LIVE_HOW_STEP3,
  LOCKED_LIVE_HOW_SUBTITLE,
  LOCKED_SITE_DROPS_CTA,
  LOCKED_SITE_DROPS_H1_ACCENT,
  LOCKED_SITE_DROPS_H1_LINE1,
  LOCKED_SITE_DROPS_RULE,
  LOCKED_SITE_DROPS_SUB,
} from './site-drops-copy';

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
    titleLine1: LOCKED_SITE_DROPS_H1_LINE1,
    titleAccent: LOCKED_SITE_DROPS_H1_ACCENT,
    subtitle: LOCKED_SITE_DROPS_SUB,
    trustLine: 'Open worldwide · recognition only · Site Drop ladder.',
    buttonLabel: LOCKED_SITE_DROPS_CTA,
  },
  prize: {
    badge: 'THIS WEEK • FREE • NO SIGNUP',
    titleLine1: LOCKED_SITE_DROPS_H1_LINE1,
    titleAccent: LOCKED_SITE_DROPS_H1_ACCENT,
    subtitle: LOCKED_SITE_DROPS_SUB,
    trustLine: 'Open worldwide · recognition only · Site Drop ladder.',
    buttonLabel: LOCKED_SITE_DROPS_CTA,
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

/** Paint only the locked 8:44 homepage lines. No extra first-paint copy. */
export function applyHeroCopyToDom(copy: HeroCtaCopy): void {
  setText('hero-title-line1', copy.titleLine1);
  setText('hero-title-accent', copy.titleAccent);
  setText('hero-subtitle', copy.subtitle);
  setButtonLabel('hero-get-link-btn', copy.buttonLabel);
}

/** Re-assert the 8:44 homepage after CMS / i18n / A/B. Do not invent new lines. */
export function lock844HomepageCopy(): void {
  if (isReferredLanding()) return;
  applyHeroCopyToDom(HERO_CTA_COPY.control);
  const badgeText = document.querySelector('#hero-badge [data-i18n-text]');
  if (badgeText) badgeText.textContent = 'THIS WEEK • FREE • NO SIGNUP';
  setText('hero-prize-one', LOCKED_SITE_DROPS_RULE);
  setText('funnel-journey-badge', LOCKED_LIVE_FUNNEL_BADGE);
  setText('how-it-works-badge', LOCKED_LIVE_HOW_BADGE);
  setText('how-it-works-subtitle', LOCKED_LIVE_HOW_SUBTITLE);
  setText('how-step1-desc', LOCKED_LIVE_HOW_STEP1_DESC);
  setText('how-it-works-step3', LOCKED_LIVE_HOW_STEP3);
  const howStep2 = document.getElementById('how-step2-desc');
  if (howStep2) howStep2.textContent = LOCKED_LIVE_HOW_STEP2_DESC;
  // Owner lock: large Site Drop board title stays Recent Activity.
  const boardTitle = document.getElementById('leaderboard-title');
  const painted = (boardTitle?.textContent || '').trim();
  if (boardTitle && (painted === 'Early Leaderboard' || painted === 'Live Leaderboard' || painted === '')) {
    boardTitle.textContent = 'Recent Activity';
  }
}

/** Apply feature-variant hero copy on direct landings (control leaves CMS/static defaults). */
export function applyHeroCtaVariant(): void {
  if (isReferredLanding()) return;

  const variant = getHeroCtaVariant();
  // control = static HTML / CMS; prize = conversion-optimized paint
  if (variant !== 'prize') return;

  applyHeroCopyToDom(HERO_CTA_COPY.prize);
}
