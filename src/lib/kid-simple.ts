/**
 * 5th-grade public flow: one job at a time.
 * Does not delete features — extras stay in the DOM and show via "More tools"
 * or after the first friend locks the link.
 */

import { isEmbedMode } from './embed-mode';
import { hasReferralLinkInUI } from './visitor-slim';

const ATTR = 'data-vr-kid-simple';
const MORE_ATTR = 'data-vr-kid-more';
const MORE_BTN_ID = 'kid-more-tools-btn';

export function isKidSimpleActive(): boolean {
  return document.documentElement.getAttribute(ATTR) === '1';
}

export function isKidMoreOpen(): boolean {
  return document.documentElement.hasAttribute(MORE_ATTR);
}

export function setKidMore(open: boolean): void {
  const root = document.documentElement;
  if (open) root.setAttribute(MORE_ATTR, '1');
  else root.removeAttribute(MORE_ATTR);
  syncKidMoreButton();
}

function syncKidMoreButton(): void {
  const btn = document.getElementById(MORE_BTN_ID);
  if (!btn) return;
  const open = isKidMoreOpen();
  btn.textContent = open ? 'Hide extra tools' : 'Show extra tools';
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function wireKidMoreButton(): void {
  const btn = document.getElementById(MORE_BTN_ID);
  if (!btn || btn.dataset.vrKidBound === '1') return;
  btn.dataset.vrKidBound = '1';
  btn.addEventListener('click', () => setKidMore(!isKidMoreOpen()));
}

export function syncKidSimpleFromLock(): void {
  if (document.documentElement.hasAttribute('data-vr-post-link-one')) return;
  if (document.documentElement.hasAttribute('data-vr-share-locked')) setKidMore(true);
}

function watchLockForExtras(): void {
  syncKidSimpleFromLock();
  const mo = new MutationObserver(() => syncKidSimpleFromLock());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-vr-share-locked'] });
}

/** Turn on kid-simple for the public site (not embeds).
 * First paint is bootstrapped in index.html <head> with the same embed skip. */
export function initKidSimple(loc: Location = location): void {
  if (isEmbedMode(loc)) {
    document.documentElement.removeAttribute(ATTR);
    return;
  }
  document.documentElement.setAttribute(ATTR, '1');
  if (hasReferralLinkInUI()) {
    document.documentElement.setAttribute('data-vr-has-link', '1');
  }
  wireKidMoreButton();
  syncKidMoreButton();
  watchLockForExtras();
}
