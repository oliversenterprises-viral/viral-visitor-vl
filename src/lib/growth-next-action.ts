/**
 * Growth Engine - next-best share action.
 * After Get my link: one obvious action - native share, else WhatsApp.
 * Credit still requires the friend to tap Get my link.
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

const CREDIT_SUB = 'A friend must tap Get my link to credit you.';

function shareKind(native: boolean): 'native_share' | 'whatsapp_boost' {
  return native ? 'native_share' : 'whatsapp_boost';
}

function shareCta(native: boolean): string {
  return native ? 'Share now' : 'Share on WhatsApp';
}

function shareIcon(native: boolean): string {
  return native ? 'fa-share-nodes' : 'fa-whatsapp';
}

/** Single highest-impact action for this visitor right now. */
export function resolveGrowthNextAction(input: GrowthNextActionInput): GrowthNextAction {
  if (!input.hasLink) {
    return {
      kind: 'get_link',
      headline: 'Start the viral loop',
      subline: 'Get your free link in ~30 seconds - no signup.',
      urgency: 'high',
      icon: 'fa-gift',
      ctaLabel: 'Get my referral link',
    };
  }

  const native = input.nativeShareAvailable;
  const kind = shareKind(native);
  const ctaLabel = shareCta(native);
  const icon = shareIcon(native);

  if (input.gapToNext === 1 && input.rank != null && input.rank > 1) {
    return {
      kind,
      headline: 'One referral from overtaking!',
      subline: CREDIT_SUB,
      urgency: 'critical',
      icon,
      ctaLabel,
    };
  }

  if (input.rank === 1) {
    return {
      kind,
      headline: 'Defend your #1 throne',
      subline: CREDIT_SUB,
      urgency: 'high',
      icon,
      ctaLabel,
    };
  }

  if (input.referrals === 0 && input.shareStreak === 0) {
    return {
      kind,
      headline: "You're in. Send your link.",
      subline: CREDIT_SUB,
      urgency: 'high',
      icon,
      ctaLabel,
    };
  }

  if (input.dailyShares < DAILY_SHARE_QUEST_GOAL) {
    const left = DAILY_SHARE_QUEST_GOAL - input.dailyShares;
    return {
      kind,
      headline: `Daily boost: ${left} share${left === 1 ? '' : 's'} left`,
      subline: CREDIT_SUB,
      urgency: 'high',
      icon,
      ctaLabel,
    };
  }

  if (input.gapToNext != null && input.gapToNext > 1 && input.rank != null && input.rank > 1) {
    return {
      kind,
      headline: `${input.gapToNext} referrals from rank #${input.rank - 1}`,
      subline: CREDIT_SUB,
      urgency: 'high',
      icon,
      ctaLabel,
    };
  }

  return {
    kind,
    headline: 'Send your link',
    subline: CREDIT_SUB,
    urgency: 'normal',
    icon,
    ctaLabel,
  };
}
