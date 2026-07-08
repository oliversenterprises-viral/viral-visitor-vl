/**
 * Semantic viral zones for closed-loop optimizer heatmaps.
 * Attach via data-vr-zone on public UI elements.
 */

export const VIRAL_ZONE_IDS = [
  'hero-get-link',
  'hero-leaderboard',
  'attribution-get-link',
  'funnel-expand',
  'trust-pack',
  'referral-section',
  'share-rank-cta',
  'growth-command',
  'share-copy',
  'share-panel',
  'share-x',
  'share-whatsapp',
  'challenge-duel',
  'catch-up-anxiety',
  'rank-receipt',
  'weekly-sprint',
  'community-unlock',
] as const;

export type ViralZoneId = (typeof VIRAL_ZONE_IDS)[number];

export const VIRAL_ZONE_LABELS: Record<ViralZoneId, string> = {
  'hero-get-link': 'Hero — Get my link',
  'hero-leaderboard': 'Hero — Leaderboard',
  'attribution-get-link': 'Attribution — Step 1 CTA',
  'funnel-expand': 'Funnel — Expand below fold',
  'trust-pack': 'Referred trust pack',
  'referral-section': 'Referral section',
  'share-rank-cta': 'Share rank CTA',
  'growth-command': 'Growth command center',
  'share-copy': 'Copy referral link',
  'share-panel': 'Share panel (any button)',
  'share-x': 'Share — X / Twitter',
  'share-whatsapp': 'Share — WhatsApp',
  'challenge-duel': 'Challenge duel banner',
  'catch-up-anxiety': 'Catch-up anxiety bar',
  'rank-receipt': 'Rank receipt card',
  'weekly-sprint': 'Weekly sprint board',
  'community-unlock': 'Community unlock meter',
};

/** Funnel step each zone most directly supports. */
export const VIRAL_ZONE_FUNNEL_STEP: Record<ViralZoneId, string> = {
  'hero-get-link': 'GetReferralLink',
  'hero-leaderboard': 'SiteLanding',
  'attribution-get-link': 'GetReferralLink',
  'funnel-expand': 'SiteLanding',
  'trust-pack': 'GetReferralLink',
  'referral-section': 'GetReferralLink',
  'share-rank-cta': 'ShareReferral',
  'growth-command': 'ShareReferral',
  'share-copy': 'CopyReferralLink',
  'share-panel': 'ShareReferral',
  'share-x': 'ShareReferral',
  'share-whatsapp': 'ShareReferral',
  'challenge-duel': 'ChallengeLanding',
  'catch-up-anxiety': 'AnxietyBarAction',
  'rank-receipt': 'ReceiptShared',
  'weekly-sprint': 'SprintBoardView',
  'community-unlock': 'CommunityUnlockView',
};

export function isViralZoneId(value: string): value is ViralZoneId {
  return (VIRAL_ZONE_IDS as readonly string[]).includes(value);
}

/** Resolve zone from click target — walks up DOM for data-vr-zone. */
export function resolveViralZoneFromTarget(target: EventTarget | null): ViralZoneId | null {
  if (!target || !(target instanceof Element)) return null;
  const el = target.closest('[data-vr-zone]');
  if (!el) return null;
  const zone = String(el.getAttribute('data-vr-zone') || '').trim();
  return isViralZoneId(zone) ? zone : null;
}