/**
 * Exit-intent + dwell rescue — win back direct visitors who have not tapped Get link.
 */

import { isEmbedMode } from './embed-mode';
import { isReferredLanding } from './funnel-conversion';
import { hasReferralLinkInUI } from './visitor-slim';
import { t } from './i18n';

const SESSION_KEY = 'vr_exit_rescue_done';
const MIN_DWELL_MS = 5000;
const MOBILE_DWELL_MS = 22000;
/** Paid / Reddit cold traffic — mobile bounce is much faster than organic. */
const PAID_MOBILE_DWELL_MS = 7000;
const PAID_DESKTOP_DWELL_MS = 4000;

export interface ExitRescueEligibility {
  isReferred: boolean;
  hasLink: boolean;
  alreadyShown: boolean;
  dwellMs: number;
  isCoarsePointer: boolean;
  /** Shorter thresholds for paid/Reddit landings. */
  isPaidTraffic?: boolean;
}

export function resolveExitDwellMs(opts: {
  isCoarsePointer: boolean;
  isPaidTraffic?: boolean;
}): number {
  if (opts.isPaidTraffic) {
    return opts.isCoarsePointer ? PAID_MOBILE_DWELL_MS : PAID_DESKTOP_DWELL_MS;
  }
  return opts.isCoarsePointer ? MOBILE_DWELL_MS : MIN_DWELL_MS;
}

export function shouldShowExitRescue(opts: ExitRescueEligibility): boolean {
  if (opts.isReferred || opts.hasLink || opts.alreadyShown) return false;
  const need = resolveExitDwellMs({
    isCoarsePointer: opts.isCoarsePointer,
    isPaidTraffic: opts.isPaidTraffic,
  });
  return opts.dwellMs >= need;
}

export function buildExitRescueMessage(): { title: string; body: string; cta: string } {
  return {
    title: t('exit.title'),
    body: t('exit.body'),
    cta: t('exit.cta'),
  };
}

function markShown(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // non-fatal
  }
}

function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function removePanel(): void {
  document.getElementById('vr-exit-rescue')?.remove();
  document.documentElement.removeAttribute('data-vr-exit-rescue');
}

function showRescuePanel(mode: 'exit' | 'dwell'): void {
  if (document.getElementById('vr-exit-rescue') || alreadyShown()) return;
  if (isReferredLanding() || hasReferralLinkInUI()) return;

  const copy = buildExitRescueMessage();
  const panel = document.createElement('div');
  panel.id = 'vr-exit-rescue';
  panel.className = 'vr-exit-rescue';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'vr-exit-rescue-title');
  panel.innerHTML = `
    <div class="vr-exit-rescue-card">
      <button type="button" class="vr-exit-rescue-close" aria-label="Dismiss">&times;</button>
      <p id="vr-exit-rescue-title" class="vr-exit-rescue-title">${copy.title}</p>
      <p class="vr-exit-rescue-body">${copy.body}</p>
      <div class="vr-exit-rescue-actions">
        <button type="button" class="vr-exit-rescue-cta">${copy.cta}</button>
        <button type="button" class="vr-exit-rescue-dismiss">Not now</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  document.documentElement.setAttribute('data-vr-exit-rescue', mode);
  markShown();

  const dismiss = () => removePanel();
  panel.querySelector('.vr-exit-rescue-close')?.addEventListener('click', dismiss);
  panel.querySelector('.vr-exit-rescue-dismiss')?.addEventListener('click', dismiss);
  panel.querySelector('.vr-exit-rescue-cta')?.addEventListener('click', () => {
    try {
      sessionStorage.setItem('vr_get_link_via', `exit_rescue_${mode}`);
    } catch {
      /* non-fatal */
    }
    const fn = (window as Window & { getMyReferralLinkInstant?: () => void }).getMyReferralLinkInstant;
    if (typeof fn === 'function') void fn();
    else document.getElementById('hero-get-link-btn')?.click();
    dismiss();
  });
}

/** Bootstrap exit/dwell rescue (idempotent, direct landings only). */
export function initExitIntentRescue(win: Window = window): void {
  if (isEmbedMode(win.location) || win.document.documentElement.dataset.vrExitBound === '1') return;
  win.document.documentElement.dataset.vrExitBound = '1';

  const started = Date.now();
  const coarse = win.matchMedia('(pointer: coarse)').matches;
  const isPaidTraffic = win.document.documentElement.getAttribute('data-vr-paid-landing') === '1';

  const tryShow = (mode: 'exit' | 'dwell') => {
    if (
      !shouldShowExitRescue({
        isReferred: isReferredLanding(),
        hasLink: hasReferralLinkInUI(),
        alreadyShown: alreadyShown(),
        dwellMs: Date.now() - started,
        isCoarsePointer: coarse,
        isPaidTraffic:
          isPaidTraffic || win.document.documentElement.getAttribute('data-vr-paid-landing') === '1',
      })
    ) {
      return;
    }
    showRescuePanel(mode);
  };

  if (!coarse) {
    win.document.addEventListener('mouseout', (e: MouseEvent) => {
      if (e.clientY > 12 || e.relatedTarget != null) return;
      tryShow('exit');
    });
  }
}