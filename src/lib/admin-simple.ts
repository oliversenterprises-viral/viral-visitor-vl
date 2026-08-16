/**
 * One owner desk: run the funnel. Password gate stays. No extra nav.
 */

const ATTR = 'data-vr-admin-simple';
const DESK_ATTR = 'data-vr-admin-desk';
const MORE_ATTR = 'data-vr-admin-more';
const STATS_MORE_ATTR = 'data-vr-admin-stats-more';
const MORE_BTN_ID = 'admin-more-tools-btn';
const STATS_MORE_BTN_ID = 'admin-stats-more-btn';

export const ADMIN_PRIMARY_TABS = [0] as const;
export const ADMIN_EXTRA_TABS = [] as const;

const DESK_COACH = 'Land → get-link → share → lock. Server numbers only.';

export function isAdminExtraTab(_tab: number): boolean {
  return false;
}

export function isAdminMoreOpen(): boolean {
  return false;
}

export function isAdminStatsMoreOpen(): boolean {
  return false;
}

export function setAdminStatsMore(_open: boolean): void {
  document.documentElement.removeAttribute(STATS_MORE_ATTR);
}

export function setAdminMore(_open: boolean): void {
  document.documentElement.removeAttribute(MORE_ATTR);
}

export function syncAdminTabCoach(_tab?: number): void {
  const el = document.getElementById('admin-tab-coach');
  if (el) el.textContent = DESK_COACH;
}

export function initAdminDesk(): void {
  const root = document.documentElement;
  root.setAttribute(ATTR, '1');
  root.setAttribute(DESK_ATTR, '1');
  root.removeAttribute(MORE_ATTR);
  root.removeAttribute(STATS_MORE_ATTR);
  syncAdminTabCoach();
  const more = document.getElementById(MORE_BTN_ID);
  if (more) more.setAttribute('hidden', 'true');
  const statsMore = document.getElementById(STATS_MORE_BTN_ID);
  if (statsMore) statsMore.setAttribute('hidden', 'true');
}

/** Back-compat alias — desk is the only owner chrome now. */
export function initAdminSimple(): void {
  initAdminDesk();
}
