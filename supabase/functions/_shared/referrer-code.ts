/** Shared referrer code validation — used by record-referral edge + client tests. */

export const REFERRER_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{3,19}$/;

export function normalizeReferrerCode(raw: unknown): string {
  return String(raw || '').trim().toUpperCase();
}

export function isValidReferrerCode(code: string): boolean {
  return REFERRER_CODE_RE.test(code);
}