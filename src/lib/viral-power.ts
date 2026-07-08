/**
 * Viral Power score — gamified momentum meter (0–100) from streak, referrals, rank, gap.
 */

export type ViralPowerTier = 'spark' | 'rising' | 'on_fire' | 'viral' | 'legend';

export interface ViralPowerInput {
  shareStreak: number;
  referrals: number;
  rank: number | null;
  gapToNext: number | null;
  dailySharesToday?: number;
}

export interface ViralPowerResult {
  score: number;
  tier: ViralPowerTier;
  label: string;
  tip: string;
  isOvertakeRush: boolean;
}

const TIER_META: Record<ViralPowerTier, { label: string; min: number }> = {
  spark: { label: 'Spark', min: 0 },
  rising: { label: 'Rising', min: 25 },
  on_fire: { label: 'On Fire', min: 50 },
  viral: { label: 'Viral Machine', min: 75 },
  legend: { label: 'Legend', min: 92 },
};

function tierFromScore(score: number): ViralPowerTier {
  if (score >= TIER_META.legend.min) return 'legend';
  if (score >= TIER_META.viral.min) return 'viral';
  if (score >= TIER_META.on_fire.min) return 'on_fire';
  if (score >= TIER_META.rising.min) return 'rising';
  return 'spark';
}

function buildTip(input: ViralPowerInput, tier: ViralPowerTier): string {
  const gap = input.gapToNext;
  const rank = input.rank;

  if (gap === 1 && rank != null && rank > 1) {
    return 'One referral away from overtaking — share NOW!';
  }
  if (rank === 1) return 'Defend #1 — every share counts.';
  if (tier === 'legend') return 'You are unstoppable — keep the pressure on.';
  if ((input.dailySharesToday ?? 0) < 3) {
    const left = 3 - (input.dailySharesToday ?? 0);
    return `Daily boost: ${left} more share${left === 1 ? '' : 's'} today for max power.`;
  }
  if (input.referrals === 0) return 'First share unlocks the leaderboard.';
  if (input.shareStreak < 3) return 'Stack shares back-to-back to climb faster.';
  return 'Momentum is building — don\'t stop now.';
}

/** Compute addictive power score and tier from live stats. */
export function computeViralPower(input: ViralPowerInput): ViralPowerResult {
  const streak = Math.max(0, input.shareStreak);
  const refs = Math.max(0, input.referrals);
  const rank = input.rank;
  const gap = input.gapToNext;
  const daily = Math.max(0, input.dailySharesToday ?? 0);

  const streakPts = Math.min(25, streak * 4);
  const refPts = Math.min(35, refs * 5);
  let rankPts = 0;
  if (rank === 1) rankPts = 25;
  else if (rank != null && rank <= 3) rankPts = 20;
  else if (rank != null && rank <= 10) rankPts = 12;
  else if (refs > 0) rankPts = 6;

  let gapPts = 0;
  if (gap === 1) gapPts = 15;
  else if (gap != null && gap <= 3) gapPts = 10;
  else if (gap != null && gap <= 5) gapPts = 5;

  const dailyPts = Math.min(10, daily * 3);

  const raw = streakPts + refPts + rankPts + gapPts + dailyPts;
  const score = Math.min(100, Math.round(raw));
  const tier = tierFromScore(score);
  const isOvertakeRush = gap === 1 && rank != null && rank > 1;

  return {
    score,
    tier,
    label: TIER_META[tier].label,
    tip: buildTip(input, tier),
    isOvertakeRush,
  };
}

export function viralPowerTierColor(tier: ViralPowerTier): string {
  switch (tier) {
    case 'legend':
      return 'from-amber-400 via-fuchsia-500 to-violet-500';
    case 'viral':
      return 'from-violet-500 to-fuchsia-500';
    case 'on_fire':
      return 'from-emerald-400 to-violet-500';
    case 'rising':
      return 'from-sky-400 to-violet-400';
    default:
      return 'from-zinc-500 to-violet-400';
  }
}