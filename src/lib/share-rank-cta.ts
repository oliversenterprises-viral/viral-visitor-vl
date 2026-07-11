/**
 * Rank-based share CTAs — dynamic headlines in the share panel.
 */

export type ShareRankCtaTone = 'gold' | 'emerald' | 'violet' | 'amber';

export interface ShareRankCta {
  headline: string;
  subline: string;
  tone: ShareRankCtaTone;
  /** Hint for UI emphasis: boost WhatsApp on mobile when leading. */
  emphasizeBoost?: boolean;
}

/** Build a contextual CTA from leaderboard rank, referral count, and gap. */
export function buildShareRankCta(
  rank: number | null | undefined,
  referrals: number,
  gapToNext?: number | null,
): ShareRankCta {
  if (rank === 1) {
    return {
      headline: "You're #1 — defend your spot!",
      subline: 'Every share keeps you on top. Challenge friends who might dethrone you.',
      tone: 'gold',
      emphasizeBoost: true,
    };
  }
  if (rank != null && rank >= 2 && gapToNext === 1) {
    return {
      headline: `You're #${rank} — one referral to climb!`,
      subline: 'Near-win mode. Challenge a friend or Quick Boost now.',
      tone: 'amber',
      emphasizeBoost: true,
    };
  }
  if (rank != null && rank >= 2 && rank <= 3) {
    return {
      headline: `You're #${rank} — one push toward #1!`,
      subline:
        gapToNext != null && gapToNext > 1
          ? `${gapToNext} more referrals to the next rank. Top spot claims homepage feature.`
          : 'Share now while momentum is hot. Top spot claims homepage feature.',
      tone: 'emerald',
      emphasizeBoost: true,
    };
  }
  if (rank != null && rank >= 4) {
    return {
      headline: `You're #${rank} on the board`,
      subline:
        gapToNext != null && gapToNext >= 1
          ? `${gapToNext} more to climb — challenge a friend who will actually join.`
          : 'A few more shares could move you up — challenge a friend below.',
      tone: 'violet',
    };
  }
  if (referrals > 0) {
    return {
      headline: `${referrals} referral${referrals === 1 ? '' : 's'} — share to rank!`,
      subline: 'Land on the public leaderboard. Your status card unlocks with rank.',
      tone: 'amber',
    };
  }
  return {
    headline: "You're in. Sharing is how you climb.",
    subline: 'Challenge a friend first — rivalry beats a cold link drop.',
    tone: 'violet',
  };
}
