/**
 * Viral Coach visibility — per-visitor preference + site-wide optimizer gate (via DOM attr).
 */

export const FUNNEL_COACH_VISITOR_PREFS_KEY = 'vr_funnel_coach_enabled';

/** Site-wide coach enabled (set on <html> by optimizer-flags; default on). */
export function isFunnelCoachSiteEnabled(root: HTMLElement = document.documentElement): boolean {
  return !root.hasAttribute('data-vr-funnel-coach-site');
}

export function isFunnelCoachVisitorEnabled(): boolean {
  try {
    return localStorage.getItem(FUNNEL_COACH_VISITOR_PREFS_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setFunnelCoachVisitorEnabled(on: boolean): void {
  try {
    localStorage.setItem(FUNNEL_COACH_VISITOR_PREFS_KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

/** Coach may render when site flag and visitor preference both allow. */
export function isFunnelCoachActive(
  root: HTMLElement = document.documentElement,
): boolean {
  return isFunnelCoachSiteEnabled(root) && isFunnelCoachVisitorEnabled();
}