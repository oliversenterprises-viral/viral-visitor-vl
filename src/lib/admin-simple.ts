/**
 * First screen is the five-number desk. Extra owner tools stay behind More.
 */

const ATTR = 'data-vr-admin-simple';
const DESK_ATTR = 'data-vr-admin-desk';
const MORE_ATTR = 'data-vr-admin-more';
const STATS_MORE_ATTR = 'data-vr-admin-stats-more';
const MORE_BTN_ID = 'admin-more-tools-btn';
const STATS_MORE_BTN_ID = 'admin-stats-more-btn';

export const ADMIN_PRIMARY_TABS = [0] as const;
export const ADMIN_EXTRA_TABS = [1, 2, 3, 4, 5, 6] as const;

const DESK_COACH = 'Land -> get a link -> share -> lock.';

export function isAdminExtraTab(tab: number): boolean {
  return (ADMIN_EXTRA_TABS as readonly number[]).includes(tab);
}

export function isAdminMoreOpen(): boolean {
  return document.documentElement.hasAttribute(MORE_ATTR);
}

export function isAdminStatsMoreOpen(): boolean {
  return document.documentElement.hasAttribute(STATS_MORE_ATTR);
}

export function setAdminStatsMore(open: boolean): void {
  const root = document.documentElement;
  if (open) root.setAttribute(STATS_MORE_ATTR, '1');
  else root.removeAttribute(STATS_MORE_ATTR);
  const btn = document.getElementById(STATS_MORE_BTN_ID);
  if (btn) {
    btn.textContent = open ? 'Hide extra numbers' : 'More numbers';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

export function setAdminMore(open: boolean): void {
  const root = document.documentElement;
  if (open) root.setAttribute(MORE_ATTR, '1');
  else root.removeAttribute(MORE_ATTR);
  const btn = document.getElementById(MORE_BTN_ID);
  if (btn) {
    btn.removeAttribute('hidden');
    btn.textContent = open ? 'Back to desk' : 'More tools';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

export function syncAdminTabCoach(_tab?: number): void {
  const el = document.getElementById('admin-tab-coach');
  if (el) el.textContent = DESK_COACH;
}

function wireAdminMoreButton(): void {
  const btn = document.getElementById(MORE_BTN_ID);
  if (!btn || btn.dataset.vrAdminBound === '1') return;
  btn.dataset.vrAdminBound = '1';
  btn.addEventListener('click', () => {
    const next = !isAdminMoreOpen();
    setAdminMore(next);
    if (!next) {
      const switchFn = (window as unknown as { switchAdminTab?: (n: number) => void }).switchAdminTab;
      switchFn?.(0);
    }
  });
}

export function initAdminDesk(): void {
  const root = document.documentElement;
  root.setAttribute(ATTR, '1');
  root.setAttribute(DESK_ATTR, '1');
  root.removeAttribute(STATS_MORE_ATTR);
  wireAdminMoreButton();
  setAdminMore(isAdminMoreOpen());
  syncAdminTabCoach();
  const statsMore = document.getElementById(STATS_MORE_BTN_ID);
  if (statsMore) statsMore.setAttribute('hidden', 'true');
}

export function initAdminSimple(): void {
  initAdminDesk();
}
