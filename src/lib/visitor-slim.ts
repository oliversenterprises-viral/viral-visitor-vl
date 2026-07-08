/**
 * Visitor slim layout — segment-aware UI reduction (referred vs direct).
 * Default ON; disable via optimizer_flags.visitor_slim = false.
 */

import { isReferredLanding } from './funnel-conversion';
import { getOptimizerFlags } from './optimizer-flags';

export type VisitorSlimSegment = 'direct' | 'referred';

const MORE_SHARE_BTN_ID = 'share-more-options-btn';

export function isVisitorSlimEnabled(): boolean {
  const flags = getOptimizerFlags();
  return flags.visitor_slim !== false;
}

export function getVisitorSlimSegment(loc: Location = location): VisitorSlimSegment {
  return isReferredLanding(loc) ? 'referred' : 'direct';
}

export function hasReferralLinkInUI(): boolean {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return !!input?.value?.trim();
}

/** Sync html attrs used by visitor-slim CSS. */
export function refreshVisitorSlimState(): void {
  const root = document.documentElement;
  if (!root.hasAttribute('data-vr-visitor-slim')) return;

  root.setAttribute('data-vr-slim-segment', getVisitorSlimSegment());

  if (hasReferralLinkInUI()) root.setAttribute('data-vr-has-link', '1');
  else root.removeAttribute('data-vr-has-link');

  updateMoreShareButtonLabel();
}

function updateMoreShareButtonLabel(): void {
  const btn = document.getElementById(MORE_SHARE_BTN_ID);
  if (!btn) return;
  const expanded = document.documentElement.hasAttribute('data-vr-slim-share-expanded');
  const hiddenExtras = document.querySelectorAll('[data-vr-slim-share-extra]').length;
  btn.textContent = expanded
    ? 'Fewer share options'
    : `More share options (${hiddenExtras} platforms + tools)`;
  btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function wireMoreShareOptions(): void {
  const btn = document.getElementById(MORE_SHARE_BTN_ID);
  if (!btn || btn.dataset.vrSlimBound === '1') return;
  btn.dataset.vrSlimBound = '1';
  btn.addEventListener('click', () => {
    const root = document.documentElement;
    if (root.hasAttribute('data-vr-slim-share-expanded')) {
      root.removeAttribute('data-vr-slim-share-expanded');
    } else {
      root.setAttribute('data-vr-slim-share-expanded', '1');
    }
    updateMoreShareButtonLabel();
  });
}

/** Bootstrap slim layout (idempotent). */
export function initVisitorSlim(loc: Location = location): void {
  if (!isVisitorSlimEnabled()) {
    document.documentElement.removeAttribute('data-vr-visitor-slim');
    return;
  }

  document.documentElement.setAttribute('data-vr-visitor-slim', '1');
  document.documentElement.setAttribute('data-vr-slim-segment', getVisitorSlimSegment(loc));
  wireMoreShareOptions();
  refreshVisitorSlimState();

  const btn = document.getElementById(MORE_SHARE_BTN_ID);
  if (btn) btn.classList.remove('hidden');
}

/** Call when optimizer flags reload in admin (no-op on public if unchanged). */
export function applyVisitorSlimFromFlags(): void {
  if (isVisitorSlimEnabled()) initVisitorSlim();
  else document.documentElement.removeAttribute('data-vr-visitor-slim');
}