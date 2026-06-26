/**
 * Referral URL helpers — path-based links are less likely to be flagged as spam on X.
 * Invariant: every link buildReferralLinkFromBase emits must roundtrip through parseRefFromLocation.
 * Supports: /r/CODE, /{subpath}/r/CODE, and legacy ?ref=CODE
 */

const REF_SESSION_KEY = 'vr_landing_ref';

/** Trailing /r/CODE segment (root /r/CODE or subpath e.g. /join/r/CODE). */
const PATH_REF_RE = /\/r\/([A-Za-z0-9_-]+)\/?$/;

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

/** Build a clean share URL (preferred for X / social) at site root. */
export function buildCleanReferralLink(code: string, baseUrl?: string): string {
  const base = (baseUrl || 'https://www.viralrefer.app').replace(/\/$/, '');
  return `${base}/r/${normalizeReferralCode(code)}`;
}

/**
 * Build referral link from admin-configured base URL.
 * Preserves subpaths (e.g. /join → /join/r/CODE) and merges ?ref= into existing query strings.
 */
export function buildReferralLinkFromBase(
  code: string,
  rawBase: string,
  fallbackOrigin = 'https://www.viralrefer.app',
): string {
  const normalized = normalizeReferralCode(code);
  let parsed: URL;
  try {
    parsed = new URL(rawBase);
  } catch {
    try {
      parsed = new URL(rawBase, fallbackOrigin);
    } catch {
      return buildCleanReferralLink(code, fallbackOrigin);
    }
  }

  const path = parsed.pathname.replace(/\/$/, '') || '';

  if (parsed.search) {
    const params = new URLSearchParams(parsed.search);
    params.set('ref', normalized);
    const qs = params.toString();
    return `${parsed.origin}${path || ''}?${qs}`;
  }

  if (path && path !== '/') {
    return `${parsed.origin}${path}/r/${normalized}`;
  }

  return `${parsed.origin}/r/${normalized}`;
}

/** Show the referral attribution banner immediately (no async init required). */
export function revealReferralAttributionBanner(loc: Location = location): void {
  const ref = parseRefFromLocation(loc);
  if (!ref) return;
  const banner = document.getElementById('referral-attribution');
  const disp = document.getElementById('referrer-code-display');
  if (banner && disp) {
    disp.textContent = ref;
    banner.classList.remove('hidden');
    const inline = document.getElementById('referrer-code-inline');
    if (inline) inline.textContent = ref;
  }
}