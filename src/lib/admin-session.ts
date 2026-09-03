const STORAGE_KEY = 'vr_admin_session_token';

/** Survives sessionStorage blocked/throwing so HQ Command can still fetch after login. */
let memoryToken = '';

export function getAdminSessionToken(): string {
  if (memoryToken) return memoryToken;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)?.trim() || '';
    if (stored) memoryToken = stored;
    return stored;
  } catch {
    return '';
  }
}

export function setAdminSessionToken(token: string): void {
  memoryToken = token ? token.trim() : '';
  try {
    if (memoryToken) sessionStorage.setItem(STORAGE_KEY, memoryToken);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / storage blocked — memory still holds the session */
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