/**
 * First screen is the five-number desk. Extra owner tools stay behind a visible More.
 */

const ATTR = 'data-vr-admin-simple';
const MORE_ATTR = 'data-vr-admin-more';
const STATS_MORE_ATTR = 'data-vr-admin-stats-more';
const MORE_BTN_ID = 'admin-more-tools-btn';
const STATS_MORE_BTN_ID = 'admin-stats-more-btn';

export const ADMIN_PRIMARY_TABS = [0, 2, 3] as const;
export const ADMIN_EXTRA_TABS = [1, 4, 5, 6] as const;

const TAB_COACH: Record<number, string> = {
  0: 'Land -> get a link -> share -> lock.',
  1: 'How people send links (WhatsApp, copy, and more).',
  2: 'Change the words and pictures on the public site.',
  3: 'People asking to put their site on the homepage.',
  4: 'Make the site text easier to read.',
  5: 'Auto helper that tweaks the site to get more shares.',
  6: 'People you pay when a visitor they send taps Get my link.',
};

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

export function syncAdminTabCoach(tab?: number): void {
  const el = document.getElementById('admin-tab-coach');
  if (!el) return;
  const key = typeof tab === 'number' && Number.isFinite(tab) ? tab : 0;
  el.textContent = TAB_COACH[key] || TAB_COACH[0];
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
  root.removeAttribute('data-vr-admin-desk');
  root.removeAttribute(STATS_MORE_ATTR);
  wireAdminMoreButton();
  setAdminMore(isAdminMoreOpen());
  syncAdminTabCoach(0);
  const more = document.getElementById(MORE_BTN_ID);
  if (more) more.removeAttribute('hidden');
  const statsMore = document.getElementById(STATS_MORE_BTN_ID);
  if (statsMore) statsMore.setAttribute('hidden', 'true');
}

export function initAdminSimple(): void {
  initAdminDesk();
}
