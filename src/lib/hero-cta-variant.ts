/**
 * P1 conversion — hero CTA A/B (feature vs control) for direct landings.
 * Referred landings keep funnel-conversion overrides.
 */

import { isReferredLanding } from './funnel-conversion';
import { getHeroCtaVariant, type HeroCtaVariant } from './optimizer-flags';
import { emptyPrizeSlot, paintPrizeSlot } from './prize-slot';
import {
  LOCKED_SITE_DROPS_BADGE,
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
    badge: LOCKED_SITE_DROPS_BADGE,
    titleLine1: LOCKED_SITE_DROPS_H1_LINE1,
    titleAccent: LOCKED_SITE_DROPS_H1_ACCENT,
    subtitle: LOCKED_SITE_DROPS_SUB,
    trustLine: 'Open worldwide · recognition only · Site Drop ladder.',
    buttonLabel: LOCKED_SITE_DROPS_CTA,
  },
  prize: {
    badge: LOCKED_SITE_DROPS_BADGE,
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

function setHeroBadge(text: string): void {
  const root = document.getElementById('hero-badge');
  if (!root) return;
  const span = root.querySelector('[data-i18n-text]');
  if (span) {
    span.textContent = text;
    return;
  }
  const fallback = root.querySelector('span');
  if (fallback) {
    fallback.textContent = text;
    return;
  }
  root.textContent = text;
}

function hideZipHeroOverlay(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('hidden');
  el.setAttribute('hidden', '');
  if (id === 'hero-daily-crown-line' || id === 'hero-sprint-line') el.textContent = '';
  if (
    id === 'hero-referred-trust-pack' ||
    id === 'hero-referred-social-proof' ||
    id === 'daily-champion-strip'
  ) {
    el.innerHTML = '';
  }
}

/** Paint only the locked zip homepage lines. No extra first-paint copy. */
export function applyHeroCopyToDom(copy: HeroCtaCopy): void {
  if (copy.badge) setHeroBadge(copy.badge);
  setText('hero-title-line1', copy.titleLine1);
  setText('hero-title-accent', copy.titleAccent);
  setText('hero-subtitle', copy.subtitle);
  setButtonLabel('hero-get-link-btn', copy.buttonLabel);
}

/** Re-assert the zip homepage after CMS / i18n / A/B / Daily Crown. Do not invent new lines. */
export function lock844HomepageCopy(): void {
  if (isReferredLanding()) return;
  applyHeroCopyToDom(HERO_CTA_COPY.control);
  setHeroBadge(LOCKED_SITE_DROPS_BADGE);
  setText('hero-prize-one', LOCKED_SITE_DROPS_RULE);
  paintPrizeSlot(emptyPrizeSlot());
  hideZipHeroOverlay('hero-daily-crown-line');
  hideZipHeroOverlay('hero-sprint-line');
  hideZipHeroOverlay('hero-referred-trust-pack');
  hideZipHeroOverlay('hero-referred-social-proof');
  hideZipHeroOverlay('vr-verified-total');
  hideZipHeroOverlay('daily-champion-strip');
  hideZipHeroOverlay('daily-crown-section');
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
