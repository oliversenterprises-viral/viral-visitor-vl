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

  if (input.duelInviteEligible && input.landingRef) {
    const rival = input.landingRef.trim().toUpperCase();
    return {
      kind: 'duel_invite',
      headline: `Send duel invite — beat ${rival}`,
      subline: 'Challenge link opens with rivalry stats. Highest viral conversion path.',
      urgency: 'critical',
      icon: 'fa-fire',
      ctaLabel: 'Duel invite — WhatsApp',
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
      subline: 'Every share keeps competitors off your spot.',
      urgency: 'high',
      icon: 'fa-crown',
      ctaLabel: 'Quick Boost — defend #1',
    };
  }

  if (input.dailyShares < DAILY_SHARE_QUEST_GOAL) {
    const left = DAILY_SHARE_QUEST_GOAL - input.dailyShares;
    return {
      kind: input.isMobile && input.nativeShareAvailable ? 'native_share' : 'whatsapp_boost',
      headline: `Daily boost: ${left} share${left === 1 ? '' : 's'} left`,
      subline: 'Hit 3 shares today for max viral power.',
      urgency: 'high',
      icon: 'fa-trophy',
      ctaLabel: input.isMobile ? 'Share everywhere (1 tap)' : 'Quick Boost — WhatsApp',
    };
  }

  if (input.funnelStep === 2) {
    return {
      kind: 'copy_link',
      headline: 'Copy your link first',
      subline: 'Step 2 — then blast it to your network.',
      urgency: 'normal',
      icon: 'fa-copy',
      ctaLabel: 'Copy my link',
    };
  }

  if (input.referrals === 0 && input.shareStreak === 0) {
    return {
      kind: input.isMobile ? 'whatsapp_boost' : 'open_share_panel',
      headline: 'Launch your first share',
      subline: 'One share puts you on the path to the leaderboard.',
      urgency: 'high',
      icon: 'fa-share-nodes',
      ctaLabel: input.isMobile ? 'Quick Boost — WhatsApp' : 'Open share tools',
    };
  }

  if (input.isMobile && input.nativeShareAvailable) {
    return {
      kind: 'native_share',
      headline: 'Keep the momentum going',
      subline: 'One-tap share to every app on your phone.',
      urgency: 'normal',
      icon: 'fa-share-nodes',
      ctaLabel: 'Share everywhere',
    };
  }

  return {
    kind: 'whatsapp_boost',
    headline: 'Your next viral push',
    subline: 'WhatsApp converts fastest — tracked in your analytics.',
    urgency: 'normal',
    icon: 'fa-brands fa-whatsapp',
    ctaLabel: 'Quick Boost — WhatsApp',
  };
}