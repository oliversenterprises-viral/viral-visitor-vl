/**
 * Gap-to-leader math for share messages and stats UI.
 */

import type { LeaderboardEntry } from './types';

/** Referrals needed to overtake the person directly above (or reach #1). */
export function referralsToNextRank(
  myCode: string,
  myCount: number,
  board: readonly LeaderboardEntry[],
): number | null {
  const code = myCode.trim().toUpperCase();
  const entry = board.find((e) => (e.referrer_code || '').toUpperCase() === code);
  if (!entry) return board.length > 0 ? board[0]!.referral_count - myCount + 1 : null;

  const rank = entry.rank;
  if (rank <= 1) return null;

  const above = board.find((e) => e.rank === rank - 1);
  if (!above) return null;

  const gap = above.referral_count - myCount + 1;
  return gap > 0 ? gap : 1;
}

/** Short nudge line for share copy when user is chasing a rank. */
export function formatShareGapNudge(
  rank: number | null | undefined,
  gap: number | null,
): string {
  if (!rank || rank < 1 || gap == null || gap < 1) return '';
  if (rank === 1) return '';
  if (gap === 1) return 'One more referral to move up — ';
  return `${gap} more referrals to climb — `;
}