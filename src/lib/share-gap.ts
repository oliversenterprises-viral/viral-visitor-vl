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

export type DistanceToGloryTone = 'gold' | 'critical' | 'amber' | 'violet' | 'emerald';

export interface DistanceToGlory {
  /** Compact line for sticky meter (e.g. "3 to rank #4"). */
  line: string;
  /** Longer subline for Share Command Center. */
  subline: string;
  /** Rank display token ("#12" | "—" | "#1"). */
  rankLabel: string;
  /** Gap display token ("3" | "—" | "0"). */
  gapLabel: string;
  tone: DistanceToGloryTone;
  /** 0–100 progress toward next rank (or full when #1 / unranked with refs). */
  progressPercent: number;
}

/**
 * Always-on "distance to glory" copy for sticky meter + share panel.
 * Pure — no DOM. Homepage feature is the trophy (not cash).
 */
export function buildDistanceToGlory(
  rank: number | null | undefined,
  gap: number | null | undefined,
  referrals: number,
): DistanceToGlory {
  const refs = Number.isFinite(referrals) && referrals >= 0 ? Math.floor(referrals) : 0;

  if (rank === 1) {
    return {
      line: '#1 — defend your spot',
      subline: 'Every share keeps you on the homepage-feature throne.',
      rankLabel: '#1',
      gapLabel: '0',
      tone: 'gold',
      progressPercent: 100,
    };
  }

  if (rank != null && rank > 1 && gap != null && gap >= 1) {
    const nextRank = rank - 1;
    const critical = gap === 1;
    return {
      line: critical
        ? `1 more to rank #${nextRank}`
        : `${gap} more to rank #${nextRank}`,
      subline: critical
        ? 'One referral from climbing — share now.'
        : `You're #${rank}. Share to close the gap to #${nextRank}.`,
      rankLabel: `#${rank}`,
      gapLabel: String(gap),
      tone: critical ? 'critical' : gap <= 3 ? 'amber' : 'violet',
      progressPercent: Math.max(8, Math.min(92, Math.round(100 / (gap + 1)))),
    };
  }

  if (refs > 0) {
    return {
      line: `${refs} referral${refs === 1 ? '' : 's'} — share to rank`,
      subline: 'First public rank unlocks your status card flex.',
      rankLabel: '—',
      gapLabel: '—',
      tone: 'emerald',
      progressPercent: Math.min(60, refs * 12),
    };
  }

  return {
    line: 'First referral unlocks your rank',
    subline: "You're in. Sharing is how you climb — challenge a friend.",
    rankLabel: '—',
    gapLabel: '—',
    tone: 'violet',
    progressPercent: 6,
  };
}