/**
 * Viral loops orchestrator — wires all 5 loops into app lifecycle.
 */

import { getMyReferralCode } from '../public/globals';
import { initChallengeLanding, onChallengeLinkReady } from './challenge-mode';
import { syncCatchUpAnxietyBar } from './catch-up-anxiety';
import { renderCommunityUnlockMeter } from './community-unlock';
import { offerRankReceipt } from './rank-receipt-card';
import { renderWeeklySprintBoard } from './weekly-sprint';
import {
  fetchWeeklyReferralCount,
  fetchWeeklySprintLeaderboard,
} from './supabase';
import type { LeaderboardEntry } from './types';

function hasReferralLink(): boolean {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return !!input?.value?.trim();
}

/** Call at bootstrap (after attribution capture). */
export function initViralLoops(): void {
  initChallengeLanding();
}

/** Load public sprint + community widgets (no user code required). */
export async function loadPublicViralLoops(myCode?: string | null): Promise<void> {
  const code = myCode ?? getMyReferralCode();
  try {
    const [sprint, weeklyCount] = await Promise.all([
      fetchWeeklySprintLeaderboard(10),
      fetchWeeklyReferralCount(),
    ]);
    renderWeeklySprintBoard(sprint, code);
    renderCommunityUnlockMeter(weeklyCount);
  } catch {
    // non-fatal
  }
}

/** Sync user-specific loops after stats refresh. */
export function syncUserViralLoops(
  myCode: string | null,
  count: number,
  rank: number | null,
  board: readonly LeaderboardEntry[],
  link?: string,
): void {
  syncCatchUpAnxietyBar(count, rank, board, hasReferralLink());

  if (myCode && link) {
    void offerRankReceipt({ code: myCode, link, rank, referrals: count });
  }
}

/** After referral link is populated. */
export function onViralLoopsLinkReady(
  myCode: string,
  link: string,
  count: number,
  rank: number | null,
  board: readonly LeaderboardEntry[],
): void {
  onChallengeLinkReady();
  syncUserViralLoops(myCode, count, rank, board, link);
}