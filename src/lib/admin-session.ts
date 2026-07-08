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