/**
 * Pure claim-leader ranking — matches public leaderboard filters + tie-break.
 * Keep filters aligned with test-referral.ts and SQL is_test_referral_row().
 */

import { isTestReferralRecord, isTestReferrerCode } from './test-referral.ts';

export type ReferralRowForClaim = {
  referrer_code: string;
  referred_ip?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string | null;
};

export type ClaimLeaderResult = {
  topReferrerCode: string;
  topCount: number;
  counts: Record<string, number>;
};

/**
 * Aggregate non-test referrals: highest count wins; earliest first-seen breaks ties.
 */
export function computeClaimLeader(rows: ReferralRowForClaim[]): ClaimLeaderResult | null {
  const counts: Record<string, number> = {};
  const firstSeen: Record<string, string> = {};

  for (const r of rows) {
    const code = String(r.referrer_code || '').trim();
    if (!code) continue;
    if (isTestReferrerCode(code)) continue;
    if (isTestReferralRecord(r as Record<string, unknown>)) continue;

    counts[code] = (counts[code] || 0) + 1;
    const created = r.created_at ? String(r.created_at) : '';
    if (created && (!firstSeen[code] || created < firstSeen[code])) {
      firstSeen[code] = created;
    }
  }

  let topReferrerCode = '';
  let topCount = 0;
  let topFirst = '';

  for (const [code, cnt] of Object.entries(counts)) {
    const first = firstSeen[code] || '';
    if (
      cnt > topCount ||
      (cnt === topCount && cnt > 0 && first && (!topFirst || first < topFirst))
    ) {
      topCount = cnt;
      topReferrerCode = code;
      topFirst = first;
    }
  }

  if (!topReferrerCode || topCount <= 0) return null;
  return { topReferrerCode, topCount, counts };
}

/** Allow only http(s) redirect targets for prize banners / claim websites. */
export function isSafeHttpUrl(raw: unknown): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Basic Cash App cashtag: $Handle or Handle (letters/numbers/underscore). */
export function isValidCashtag(raw: unknown): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  return /^\$?[A-Za-z][A-Za-z0-9_]{1,20}$/.test(s);
}
