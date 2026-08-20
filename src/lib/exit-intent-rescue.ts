/**
 * Exit-intent + dwell rescue — eligibility helpers stay for tests.
 * Last-night lock: the public homepage does not paint interstitial popups.
 */

import { isEmbedMode } from './embed-mode';
import { t } from './i18n';

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

/** Bootstrap is a no-op: no first-paint or dwell interstitial. */
export function initExitIntentRescue(win: Window = window): void {
  if (isEmbedMode(win.location) || win.document.documentElement.dataset.vrExitBound === '1') return;
  win.document.documentElement.dataset.vrExitBound = '1';
}
