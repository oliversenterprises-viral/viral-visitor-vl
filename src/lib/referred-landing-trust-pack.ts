/**
 * Phase 3 — render hero trust pack (referred + direct landings).
 */

import {
  fetchMyLeaderboardRank,
  fetchMyReferralCount,
  fetchUniqueReferrerCount,
} from './supabase';
import { getMyReferralCode } from '../public/globals';
import type { LeaderboardEntry } from './types';
import { buildReferredTrustPackHtml } from './referred-trust-pack';

let trustPackInflight: Promise<void> | null = null;

/** Update trust pack under hero social proof — all landing types. */
export function renderHeroTrustPack(board: readonly LeaderboardEntry[]): void {
  if (trustPackInflight) return;

  trustPackInflight = (async () => {
    const el = document.getElementById('hero-referred-trust-pack');
    if (!el) return;

    try {
      const myCode = getMyReferralCode();
      const [uniqueReferrers, myCount, myRank] = await Promise.all([
        fetchUniqueReferrerCount(),
        myCode ? fetchMyReferralCount(myCode) : Promise.resolve(0),
        myCode ? fetchMyLeaderboardRank(myCode) : Promise.resolve(null),
      ]);

      const html = buildReferredTrustPackHtml({
        board,
        uniqueReferrers,
        myCode,
        myCount,
        myRank,
      });

      if (!html) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
      }

      el.innerHTML = html;
      el.classList.remove('hidden');
    } catch {
      el.classList.add('hidden');
    }
  })().finally(() => {
    trustPackInflight = null;
  });
}

/** @deprecated Use renderHeroTrustPack */
export const renderReferredTrustPack = renderHeroTrustPack;