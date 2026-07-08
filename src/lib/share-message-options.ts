/**
 * Central resolver for buildShareMessage() options — A/B, rank, UTM, admin template.
 */

import { getShareMessageTemplate, getMyReferralCode } from '../public/globals';
import {
  getShareAbTemplate,
  resolveShareAbVariant,
  type ShareAbVariant,
} from './share-ab';
import {
  getShareGapToNextRank,
  getShareLeaderboardRank,
  getShareReferralCount,
} from './share-context';
import { extractReferralCodeFromLink, type SharePlatform } from './share-power';

export function resolveShareMessageBuildOptions(
  platform: SharePlatform,
  link: string,
  abOverride?: ShareAbVariant,
) {
  const code =
    extractReferralCodeFromLink(link) || getMyReferralCode() || '';
  const adminTemplate = getShareMessageTemplate()?.trim() || '';
  const variant = abOverride ?? (code ? resolveShareAbVariant(code) : 'a');

  return {
    template: adminTemplate || undefined,
    abTemplate: adminTemplate ? undefined : getShareAbTemplate(variant),
    platform,
    referralCount: getShareReferralCount(),
    leaderboardRank: getShareLeaderboardRank(),
    gapToNextRank: getShareGapToNextRank(),
    trackUtm: true as const,
  };
}