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

/** Build a contextual CTA from leaderboard rank and referral count. */
export function buildShareRankCta(
  rank: number | null | undefined,
  referrals: number,
): ShareRankCta {
  if (rank === 1) {
    return {
      headline: "You're #1 — defend your spot!",
      subline: 'Every share keeps you on top. Quick Boost is fastest on mobile.',
      tone: 'gold',
      emphasizeBoost: true,
    };
  }
  if (rank != null && rank >= 2 && rank <= 3) {
    return {
      headline: `You're #${rank} — one push to #1!`,
      subline: 'Share now while momentum is hot. Top spot wins homepage + $10.',
      tone: 'emerald',
      emphasizeBoost: true,
    };
  }
  if (rank != null && rank >= 4) {
    return {
      headline: `You're #${rank} on the board`,
      subline: 'A few more shares could move you up — copy or Quick Boost below.',
      tone: 'violet',
    };
  }
  if (referrals > 0) {
    return {
      headline: `${referrals} referral${referrals === 1 ? '' : 's'} — share to rank!`,
      subline: 'Land on the public leaderboard with your next share.',
      tone: 'amber',
    };
  }
  return {
    headline: 'Share to land on the leaderboard',
    subline: 'Your link is ready — one tap to WhatsApp or copy your message.',
    tone: 'violet',
  };
}