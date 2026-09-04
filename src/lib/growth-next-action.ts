/**
 * Growth Engine - next-best share action.
 * After Get my link: one obvious action - native share, else WhatsApp.
 * Credit still requires the friend to tap Get my link.
 */

import { DAILY_SHARE_QUEST_GOAL } from './daily-share-quest';
import { t } from './i18n';

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

function creditSub(): string {
  return t('growth.credit_sub');
}

function shareKind(native: boolean): 'native_share' | 'whatsapp_boost' {
  return native ? 'native_share' : 'whatsapp_boost';
}

function shareCta(native: boolean): string {
  return native ? t('growth.cta_native') : t('growth.cta_whatsapp');
}

function shareIcon(native: boolean): string {
  return native ? 'fa-share-nodes' : 'fa-whatsapp';
}

/** Single highest-impact action for this visitor right now. */
export function resolveGrowthNextAction(input: GrowthNextActionInput): GrowthNextAction {
  if (!input.hasLink) {
    return {
      kind: 'get_link',
      headline: t('growth.get_headline'),
      subline: t('growth.get_sub'),
      urgency: 'high',
      icon: 'fa-gift',
      ctaLabel: t('hero.cta'),
    };
  }

  const native = input.nativeShareAvailable;
  const kind = shareKind(native);
  const ctaLabel = shareCta(native);
  const icon = shareIcon(native);
  const subline = creditSub();

  if (input.gapToNext === 1 && input.rank != null && input.rank > 1) {
    return {
      kind,
      headline: t('growth.overtake'),
      subline,
      urgency: 'critical',
      icon,
      ctaLabel,
    };
  }

  if (input.rank === 1) {
    return {
      kind,
      headline: t('growth.defend'),
      subline,
      urgency: 'high',
      icon,
      ctaLabel,
    };
  }

  if (input.referrals === 0 && input.shareStreak === 0) {
    return {
      kind,
      headline: t('growth.in_send'),
      subline,
      urgency: 'high',
      icon,
      ctaLabel,
    };
  }

  if (input.dailyShares < DAILY_SHARE_QUEST_GOAL) {
    const left = DAILY_SHARE_QUEST_GOAL - input.dailyShares;
    return {
      kind,
      headline: t('growth.daily', { n: left, s: left === 1 ? '' : 's' }),
      subline,
      urgency: 'high',
      icon,
      ctaLabel,
    };
  }

  if (input.gapToNext != null && input.gapToNext > 1 && input.rank != null && input.rank > 1) {
    return {
      kind,
      headline: t('growth.gap', { n: input.gapToNext, rank: input.rank - 1 }),
      subline,
      urgency: 'high',
      icon,
      ctaLabel,
    };
  }

  return {
    kind,
    headline: t('growth.send'),
    subline,
    urgency: 'normal',
    icon,
    ctaLabel,
  };
}
