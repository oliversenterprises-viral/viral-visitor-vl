/**
 * First screen is the five-number desk. Extra owner tools stay behind a visible More.
 * Chrome is relocated into #admin-more-tools-hold — not CSS-hidden in the first view.
 */

const ATTR = 'data-vr-admin-simple';
const MORE_ATTR = 'data-vr-admin-more';
const STATS_MORE_ATTR = 'data-vr-admin-stats-more';
const MORE_BTN_ID = 'admin-more-tools-btn';
const STATS_MORE_BTN_ID = 'admin-stats-more-btn';
const MORE_HOLD_ID = 'admin-more-tools-hold';
const MORE_HOST_ID = 'admin-more-tools-host';

export const ADMIN_PRIMARY_TABS = [] as const;
export const ADMIN_EXTRA_TABS = [0, 1, 2, 3, 4, 5, 6] as const;

const DESK_COACH = 'Land -> get a link -> share -> lock.';

const TAB_COACH: Record<number, string> = {
  0: 'Friends who got credit when someone used their link.',
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
  const rootEl = document.documentElement;
  if (open) rootEl.setAttribute(STATS_MORE_ATTR, '1');
  else rootEl.removeAttribute(STATS_MORE_ATTR);
  const btn = document.getElementById(STATS_MORE_BTN_ID);
  if (btn) {
    btn.textContent = open ? 'Hide extra numbers' : 'More numbers';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

function relocateMoreChrome(open: boolean): void {
  const hold = document.getElementById(MORE_HOLD_ID);
  const host = document.getElementById(MORE_HOST_ID);
  if (!hold || !host) return;
  if (open) {
    while (hold.firstChild) host.appendChild(hold.firstChild);
  } else {
    while (host.firstChild) hold.appendChild(host.firstChild);
  }
}

export function setAdminMore(open: boolean): void {
  const rootEl = document.documentElement;
  if (open) rootEl.setAttribute(MORE_ATTR, '1');
  else rootEl.removeAttribute(MORE_ATTR);
  relocateMoreChrome(open);
  const hub = document.getElementById('admin-live-hub');
  if (hub) {
    if (open) hub.classList.remove('hidden');
    else hub.classList.add('hidden');
  }
  const btn = document.getElementById(MORE_BTN_ID);
  if (btn) {
    btn.removeAttribute('hidden');
    btn.textContent = open ? 'Back to desk' : 'More';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

export function syncAdminTabCoach(tab?: number): void {
  const el = document.getElementById('admin-tab-coach');
  if (!el) return;
  if (typeof tab !== 'number' || !Number.isFinite(tab) || tab < 0) {
    el.textContent = DESK_COACH;
    return;
  }
  el.textContent = TAB_COACH[tab] || DESK_COACH;
}

function wireAdminMoreButton(): void {
  const btn = document.getElementById(MORE_BTN_ID);
  if (!btn || btn.dataset.vrAdminBound === '1') return;
  btn.dataset.vrAdminBound = '1';
  btn.addEventListener('click', () => {
    const next = !isAdminMoreOpen();
    setAdminMore(next);
    if (next) {
      void import('../admin/admin-live-hub').then((m) => m.startAdminLiveHub());
    } else {
      const showDesk = (window as unknown as { showOwnerFunnelDesk?: () => void }).showOwnerFunnelDesk;
      showDesk?.();
    }
  });
}

export function initAdminDesk(): void {
  const rootEl = document.documentElement;
  rootEl.setAttribute(ATTR, '1');
  rootEl.removeAttribute('data-vr-admin-desk');
  rootEl.removeAttribute(STATS_MORE_ATTR);
  rootEl.removeAttribute(MORE_ATTR);
  wireAdminMoreButton();
  setAdminMore(false);
  syncAdminTabCoach(-1);
  const more = document.getElementById(MORE_BTN_ID);
  if (more) more.removeAttribute('hidden');
  const statsMore = document.getElementById(STATS_MORE_BTN_ID);
  if (statsMore) statsMore.setAttribute('hidden', 'true');
}

export function initAdminSimple(): void {
  initAdminDesk();
}
