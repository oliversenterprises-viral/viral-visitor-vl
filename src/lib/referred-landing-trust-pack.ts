/**
 * Phase 3 — hero trust pack.
 * Zip product: this overlay is not the public homepage.
 */

import type { LeaderboardEntry } from './types';

/** Zip product: do not paint "You're #1 — defend your spot" into the homepage hero. */
export function renderHeroTrustPack(_board: readonly LeaderboardEntry[]): void {
  const el = document.getElementById('hero-referred-trust-pack');
  if (!el) return;
  el.classList.add('hidden');
  el.setAttribute('hidden', '');
  el.innerHTML = '';
}

/** @deprecated Use renderHeroTrustPack */
export const renderReferredTrustPack = renderHeroTrustPack;
