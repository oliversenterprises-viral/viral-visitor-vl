/**
 * 5th-grade owner desk: three main jobs first.
 * Extra tabs stay in the DOM and show via "More tools".
 */

const ATTR = 'data-vr-admin-simple';
const MORE_ATTR = 'data-vr-admin-more';
const MORE_BTN_ID = 'admin-more-tools-btn';
const MORE_STORAGE_KEY = 'vr_admin_more';

export const ADMIN_PRIMARY_TABS = [0, 2, 3] as const;
export const ADMIN_EXTRA_TABS = [1, 4, 5] as const;

const TAB_COACH: Record<number, string> = {
  0: 'Friends who got credit when someone used their link.',
  1: 'How people send links (WhatsApp, copy, and more).',
  2: 'Change the words and pictures on the public site.',
  3: 'People asking to put their site on the homepage.',
  4: 'Make the site text easier to read.',
  5: 'Auto helper that tweaks the site to get more shares.',
};

export function isAdminExtraTab(tab: number): boolean {
  return (ADMIN_EXTRA_TABS as readonly number[]).includes(tab);
}

export function isAdminMoreOpen(): boolean {
  return document.documentElement.hasAttribute(MORE_ATTR);
}

export function setAdminMore(open: boolean): void {
  const root = document.documentElement;
  if (open) root.setAttribute(MORE_ATTR, '1');
  else root.removeAttribute(MORE_ATTR);
  try {
    sessionStorage.setItem(MORE_STORAGE_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
  syncAdminMoreButton();
}

export function syncAdminTabCoach(tab: number): void {
  const el = document.getElementById('admin-tab-coach');
  if (!el) return;
  el.textContent = TAB_COACH[tab] || TAB_COACH[0];
}

function syncAdminMoreButton(): void {
  const btn = document.getElementById(MORE_BTN_ID);
  if (!btn) return;
  const open = isAdminMoreOpen();
  btn.textContent = open ? 'Hide extra tools' : 'More tools';
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function wireAdminMoreButton(): void {
  const btn = document.getElementById(MORE_BTN_ID);
  if (!btn || btn.dataset.vrAdminBound === '1') return;
  btn.dataset.vrAdminBound = '1';
  btn.addEventListener('click', () => {
    const next = !isAdminMoreOpen();
    setAdminMore(next);
    if (!next) {
      const active = document.querySelector<HTMLElement>('.admin-tab[aria-selected="true"]');
      const tab = Number(active?.dataset.adminTab || '0');
      if (isAdminExtraTab(tab)) {
        const switchFn = (window as unknown as { switchAdminTab?: (n: number) => void }).switchAdminTab;
        switchFn?.(0);
      }
    }
  });
}

/** Turn on simple-first admin chrome. Call when the owner desk opens. */
export function initAdminSimple(): void {
  document.documentElement.setAttribute(ATTR, '1');
  try {
    if (sessionStorage.getItem(MORE_STORAGE_KEY) === '1') {
      document.documentElement.setAttribute(MORE_ATTR, '1');
    }
  } catch {
    /* ignore */
  }
  wireAdminMoreButton();
  syncAdminMoreButton();
  syncAdminTabCoach(0);
}
