const STORAGE_KEY = 'vr_admin_session_token';

export function getAdminSessionToken(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setAdminSessionToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / storage blocked */
  }
}

export function clearAdminSessionToken(): void {
  setAdminSessionToken('');
}

export function hasAdminSession(): boolean {
  return Boolean(getAdminSessionToken());
}

/** True on ?owner=1 or #owner — HQ reveal, not a visitor session. */
export function isOwnerParam(loc: Location = location): boolean {
  try {
    if (new URLSearchParams(loc.search).get('owner') === '1') return true;
  } catch {
    /* ignore */
  }
  try {
    if (loc.hash === '#owner') return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Owner desk / ?owner=1 — visitor overlays must not cover HQ. */
export function isOwnerHqContext(loc: Location = location): boolean {
  return isOwnerParam(loc) || hasAdminSession();
}

/** CSS hook so leftover visitor overlays never paint over Desk / Prize / Website / Promoters. */
export function markOwnerHqSurface(doc: Document = document): void {
  doc.documentElement.setAttribute('data-vr-owner-hq', '1');
}