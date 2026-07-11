/**
 * Growth Engine — smart next-best-action for maximum viral conversion.
 */

import { DAILY_SHARE_QUEST_GOAL } from './daily-share-quest';

export type GrowthNextActionKind =
  | 'get_link'
  | 'copy_link'
  | 'whatsapp_boost'
  | 'duel_invite'
  | 'native_share'
  | 'copy_message'
  | 'open_share_panel';

export type GrowthUrgency = 'critical' | 'high' | 'normal';

export interface GrowthNextActionInput {
  hasLink: boolean;
  funnelStep: number | null;
  referrals: number;
  rank: number | null;
  gapToNext: number | null;
  dailyShares: number;
  shareStreak: number;
  isMobile: boolean;
  nativeShareAvailable: boolean;
  /** Referred or ?challenge=1 session with a known rival code */
  duelInviteEligible?: boolean;
  landingRef?: string | null;
}

export interface GrowthNextAction {
  kind: GrowthNextActionKind;
  headline: string;
  subline: string;
  urgency: GrowthUrgency;
  icon: string;
  ctaLabel: string;
}

/** Single highest-impact action for this visitor right now. */
export function resolveGrowthNextAction(input: GrowthNextActionInput): GrowthNextAction {
  if (!input.hasLink) {
    return {
      kind: 'get_link',
      headline: 'Start the viral loop',
      subline: 'Get your free link in ~30 seconds — no signup.',
      urgency: 'high',
      icon: 'fa-gift',
      ctaLabel: 'Get my referral link',
    };
  }

  // Named rival (referred / challenge landing) — highest conversion path
  if (input.duelInviteEligible && input.landingRef) {
    const rival = input.landingRef.trim().toUpperCase();
    return {
      kind: 'duel_invite',
      headline: `Challenge ${rival} to a duel`,
      subline: 'Rivalry link with ?challenge=1 — friends race your rank.',
      urgency: 'critical',
      icon: 'fa-fire',
      ctaLabel: 'Challenge a friend',
    };
  }

  if (input.gapToNext === 1 && input.rank != null && input.rank > 1) {
    return {
      kind: 'whatsapp_boost',
      headline: 'One referral from overtaking!',
      subline: 'Share now — someone could sign up before you refresh.',
      urgency: 'critical',
      icon: 'fa-bolt',
      ctaLabel: 'Share to overtake',
    };
  }

  if (input.rank === 1) {
    return {
      kind: 'whatsapp_boost',
      headline: 'Defend your #1 throne',
      subline: 'Every share keeps competitors off the homepage feature.',
      urgency: 'high',
      icon: 'fa-crown',
      ctaLabel: 'Quick Boost — defend #1',
    };
  }

  // Challenge-first for brand-new sharers (P0 share desire)
  if (input.referrals === 0 && input.shareStreak === 0) {
    return {
      kind: 'duel_invite',
      headline: "You're in. Sharing is how you climb.",
      subline: 'Challenge a friend — rivalry is the strongest viral loop.',
      urgency: 'high',
      icon: 'fa-fire',
      ctaLabel: 'Challenge a friend',
    };
  }

  if (input.dailyShares < DAILY_SHARE_QUEST_GOAL) {
    const left = DAILY_SHARE_QUEST_GOAL - input.dailyShares;
    return {
      kind: 'duel_invite',
      headline: `Daily boost: ${left} share${left === 1 ? '' : 's'} left`,
      subline: 'Challenge another friend — keep the race alive.',
      urgency: 'high',
      icon: 'fa-trophy',
      ctaLabel: 'Challenge a friend',
    };
  }

  if (input.funnelStep === 2) {
    return {
      kind: 'copy_link',
      headline: 'Copy your link first',
      subline: 'Step 2 — then challenge a friend to beat you.',
      urgency: 'normal',
      icon: 'fa-copy',
      ctaLabel: 'Copy my link',
    };
  }

  if (input.gapToNext != null && input.gapToNext > 1 && input.rank != null && input.rank > 1) {
    return {
      kind: 'duel_invite',
      headline: `${input.gapToNext} referrals from rank #${input.rank - 1}`,
      subline: 'Challenge friends who will actually open your link.',
      urgency: 'high',
      icon: 'fa-fire',
      ctaLabel: 'Challenge a friend',
    };
  }

  if (input.isMobile && input.nativeShareAvailable) {
    return {
      kind: 'native_share',
      headline: 'Keep the momentum going',
      subline: 'One-tap share — or challenge a friend below.',
      urgency: 'normal',
      icon: 'fa-share-nodes',
      ctaLabel: 'Share everywhere',
    };
  }

  return {
    kind: 'duel_invite',
    headline: 'Your next viral push',
    subline: 'Challenge a friend — tracked WhatsApp duel link.',
    urgency: 'normal',
    icon: 'fa-fire',
    ctaLabel: 'Challenge a friend',
  };
}