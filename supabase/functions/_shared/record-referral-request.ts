/** Request parsing for record-referral edge function (shared with unit tests). */

import { isValidReferrerCode, normalizeReferrerCode } from './referrer-code.ts';

export type ParsedRecordReferralRequest = {
  referrerCode: string;
  /** Optional — when absent, edge relies on rate limit + dedupe + self-referral checks. */
  turnstileToken: string | null;
  referredCode: string | null;
};

/** Parse and validate POST body — throws on invalid payload (same rules as index.ts). */
export function parseRecordReferralRequest(body: unknown): ParsedRecordReferralRequest {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  const referrerCode = normalizeReferrerCode(raw.referrerCode ?? raw.referrer_code);
  const turnstileRaw = String(raw.turnstileToken ?? raw.token ?? '').trim();
  const turnstileToken = turnstileRaw || null;
  const referredRaw = raw.referredCode ?? raw.referred_code ?? raw.visitorCode ?? null;
  const referredCode = referredRaw ? normalizeReferrerCode(referredRaw) : null;

  if (!isValidReferrerCode(referrerCode)) {
    throw new Error('Missing or invalid referrerCode');
  }

  return { referrerCode, turnstileToken, referredCode };
}

export function isSelfReferral(referrerCode: string, referredCode: string | null): boolean {
  return Boolean(referredCode && referredCode === referrerCode);
}