/**
 * Referral URL helpers — path-based links are less likely to be flagged as spam on X.
 * Supports: /r/VIRAL-CODE and legacy ?ref=VIRAL-CODE
 */

const REF_SESSION_KEY = 'vr_landing_ref';

const PATH_REF_RE = /^\/r\/([A-Za-z0-9_-]+)\/?$/;

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Parse referrer code from current URL (query or /r/ path). */
export function parseRefFromLocation(loc: Location = location): string | null {
  const params = new URLSearchParams(loc.search);
  const fromQuery = params.get('ref');
  if (fromQuery) return normalizeReferralCode(fromQuery);

  const fromPath = loc.pathname.match(PATH_REF_RE);
  if (fromPath?.[1]) return normalizeReferralCode(fromPath[1]);

  return null;
}

/** Persist landing ref for funnel events (session-scoped). */
export function captureReferralAttribution(loc: Location = location): string | null {
  const ref = parseRefFromLocation(loc);
  if (!ref) return getStoredLandingRef();
  try {
    sessionStorage.setItem(REF_SESSION_KEY, ref);
  } catch {
    // non-fatal
  }
  return ref;
}

export function getStoredLandingRef(): string | null {
  try {
    const raw = sessionStorage.getItem(REF_SESSION_KEY);
    return raw ? normalizeReferralCode(raw) : null;
  } catch {
    return null;
  }
}

/** Build a clean share URL (preferred for X / social). */
export function buildCleanReferralLink(code: string, baseUrl?: string): string {
  const base = (baseUrl || 'https://www.viralrefer.app').replace(/\/$/, '');
  return `${base}/r/${normalizeReferralCode(code)}`;
}