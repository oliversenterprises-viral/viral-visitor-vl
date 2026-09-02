/**
 * First screen is the six-number desk. Prize, Website, Promoters, and Talk stay behind a visible More.
 * Chrome is relocated into #admin-more-tools-hold — not CSS-hidden in the first view.
 */

const ATTR = 'data-vr-admin-simple';
const MORE_ATTR = 'data-vr-admin-more';
const MORE_BTN_ID = 'admin-more-tools-btn';
const MORE_HOLD_ID = 'admin-more-tools-hold';
const MORE_HOST_ID = 'admin-more-tools-host';

export const ADMIN_PRIMARY_TABS = [] as const;
/** Website (2), Prize (3), Promoters (6), Talk (8) — the only extra screens. */
export const ADMIN_EXTRA_TABS = [2, 3, 6, 8] as const;

export function isAdminExtraTab(tab: number): boolean {
  return (ADMIN_EXTRA_TABS as readonly number[]).includes(tab);
}

export function isAdminMoreOpen(): boolean {
  return document.documentElement.hasAttribute(MORE_ATTR);
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
  const btn = document.getElementById(MORE_BTN_ID);
  if (btn) {
    btn.removeAttribute('hidden');
    btn.textContent = open ? 'Back to desk' : 'More';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

export function syncAdminTabCoach(_tab?: number): void {
  /* coach row was deleted with the extra-chrome strip */
}

function wireAdminMoreButton(): void {
  const btn = document.getElementById(MORE_BTN_ID);
  if (!btn || btn.dataset.vrAdminBound === '1') return;
  btn.dataset.vrAdminBound = '1';
  btn.addEventListener('click', () => {
    const next = !isAdminMoreOpen();
    setAdminMore(next);
    if (!next) {
      const showDesk = (window as unknown as { showOwnerFunnelDesk?: () => void }).showOwnerFunnelDesk;
      showDesk?.();
    }
  });
}

export function initAdminDesk(): void {
  const rootEl = document.documentElement;
  rootEl.setAttribute(ATTR, '1');
  rootEl.removeAttribute('data-vr-admin-desk');
  rootEl.removeAttribute('data-vr-admin-stats-more');
  rootEl.removeAttribute(MORE_ATTR);
  wireAdminMoreButton();
  setAdminMore(false);
  const more = document.getElementById(MORE_BTN_ID);
  if (more) more.removeAttribute('hidden');
}

export function initAdminSimple(): void {
  initAdminDesk();
}
