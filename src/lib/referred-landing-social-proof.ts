/**
 * Phase 2/3 — compact hero social proof (referred + direct landings).
 */

import { isReferredLanding } from './funnel-conversion';
import {
  buildDirectHeroSocialProofHtml,
  buildReferredHeroSocialProofHtml,
  type PublicActivityRow,
} from './public-activity';

function paintHeroSocialProof(el: HTMLElement, html: string): void {
  if (!html) {
    // Keep container available for FOMO re-paint; do not leave a dead hole
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }

  el.innerHTML = html;
  el.classList.remove('hidden');
  el.classList.add('hero-referred-social-proof--fresh');
  window.setTimeout(() => el.classList.remove('hero-referred-social-proof--fresh'), 1600);
}

/** Update (or hide) the hero social proof pill — all landing types. */
export function renderHeroSocialProof(
  rows: readonly PublicActivityRow[],
  velocityLastHour: number,
  uniqueReferrers = 0,
  leaderCount = 0,
): void {
  const el = document.getElementById('hero-referred-social-proof');
  if (!el) return;

  const html = isReferredLanding()
    ? buildReferredHeroSocialProofHtml(rows, velocityLastHour)
    : buildDirectHeroSocialProofHtml(rows, velocityLastHour, uniqueReferrers, leaderCount);

  paintHeroSocialProof(el, html);
}

/** @deprecated Use renderHeroSocialProof */
export const renderReferredHeroSocialProof = renderHeroSocialProof;