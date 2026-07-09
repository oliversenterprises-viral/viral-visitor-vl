/**
 * Runtime share context — referral count for messages, mobile detection.
 */

let shareReferralCount = 0;
let shareLeaderboardRank: number | null = null;
let shareGapToNextRank: number | null = null;

export function setShareReferralCount(count: number): void {
  shareReferralCount = Number.isFinite(count) && count >= 0 ? count : 0;
}

export function getShareReferralCount(): number {
  return shareReferralCount;
}

export function setShareLeaderboardRank(rank: number | null): void {
  shareLeaderboardRank =
    rank != null && Number.isFinite(rank) && rank >= 1 ? Math.floor(rank) : null;
}

export function getShareLeaderboardRank(): number | null {
  return shareLeaderboardRank;
}

export function setShareGapToNextRank(gap: number | null): void {
  shareGapToNextRank =
    gap != null && Number.isFinite(gap) && gap >= 1 ? Math.floor(gap) : null;
}

export function getShareGapToNextRank(): number | null {
  return shareGapToNextRank;
}

/** True on phones / small touch devices (for Quick Boost + highlight). */
export function isMobileShareContext(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  let isNarrowViewport = false;
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      isNarrowViewport = window.matchMedia('(max-width: 640px)').matches;
    }
  } catch {
    // matchMedia unavailable
  }
  return mobileUa || isNarrowViewport;
}