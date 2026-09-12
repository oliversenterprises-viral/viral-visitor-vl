/**
 * Live Site Drops referral identity.
 * Friend share path is /r/VIRAL-XXXXXXX. /a/VIRAL-XXXXXXX and ?ref= are the same code.
 */
import { isReferralCode, normalizeReferralCode } from './engine';

/** Trailing /r/CODE or /a/CODE (root or a subpath). */
const PATH_REF_RE = /\/(?:r|a)\/([A-Za-z0-9_-]+)\/?$/i;

export const MY_REF_CODE_KEY = 'vr_my_ref_code';

export function parseRefFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return normalizeReferralCode(params.get('ref'));
}

export function parseRefFromPathname(pathname: string): string | null {
  const match = pathname.match(PATH_REF_RE);
  return match?.[1] ? normalizeReferralCode(match[1]) : null;
}

/** Parse referrer code from ?ref=, /r/CODE, or /a/CODE. Query wins, matching live. */
export function parseRefFromLocation(loc: { search?: string; pathname?: string }): string | null {
  return parseRefFromSearch(loc.search || '') || parseRefFromPathname(loc.pathname || '');
}

/** Primary friend-rank share URL — exact live scheme. */
export function buildCleanReferralLink(code: string, origin: string): string {
  const normalized = normalizeReferralCode(code);
  const base = origin.replace(/\/$/, '');
  return normalized ? `${base}/r/${normalized}` : base;
}

/** Same VIRAL- identity on the /a/ path users remember from viralrefer.app. */
export function buildAffiliateStyleLink(code: string, origin: string): string {
  const normalized = normalizeReferralCode(code);
  const base = origin.replace(/\/$/, '');
  return normalized ? `${base}/a/${normalized}` : base;
}

export function buildRefQueryLink(code: string, origin: string): string {
  const normalized = normalizeReferralCode(code);
  const base = origin.replace(/\/$/, '');
  return normalized ? `${base}/?ref=${normalized}` : base;
}

export function isOwnedReferralCode(raw: unknown): boolean {
  return isReferralCode(raw);
}
