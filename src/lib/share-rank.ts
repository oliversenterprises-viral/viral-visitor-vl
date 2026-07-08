/**
 * Leaderboard rank helpers for share message personalization.
 */

import type { LeaderboardEntry } from './types';

/** Find a referrer's public leaderboard rank (null if not on board). */
export function findRankOnLeaderboard(
  referrerCode: string,
  board: readonly LeaderboardEntry[],
): number | null {
  const code = referrerCode.trim().toUpperCase();
  if (!code) return null;
  const entry = board.find((e) => (e.referrer_code || '').toUpperCase() === code);
  return entry?.rank ?? null;
}

export function formatRankForShare(rank: number | null | undefined): string {
  if (!rank || rank < 1) return '';
  if (rank === 1) return "I'm #1 on the leaderboard — ";
  return `I'm #${rank} on the leaderboard — `;
}