/**
 * Reddit Ads Pixel — PageVisit + conversion tracking for paid ads.
 *
 * On by default for public pages (not /embed):
 * - Pixel ID `a2_ir6sjdbsj2n4` (ViralRefer Ad Account ir6sjdbsj2n4)
 * - Official snippet also lives in index.html so PageVisit fires on first paint
 * - This module inits only if the HTML snippet did not already bootstrap `rdt`
 * - Later funnel steps (Lead / custom) still go through trackRedditFunnelStep
 *
 * Kill switch: `VITE_REDDIT_PIXEL_ENABLED=0` (JS path only; HTML snippet stays on)
 * Override: `VITE_REDDIT_PIXEL_ID=...`
 *
 * Never throws; never blocks the public funnel. No PII / advanced matching.
 */

import { isEmbedMode } from './embed-mode';

type RdtFn = ((...args: unknown[]) => void) & {
  sendEvent?: (...args: unknown[]) => void;
  callQueue?: unknown[];
};

declare global {
  interface Window {
    rdt?: RdtFn;
  }
}

/** Official Reddit Ads pixel for ViralRefer Ad Account (ir6sjdbsj2n4). */
export const OFFICIAL_REDDIT_PIXEL_ID = 'a2_ir6sjdbsj2n4';

const SCRIPT_SRC = 'https://www.redditstatic.com/ads/pixel.js';

function isBlankEnv(raw: string): boolean {
  return !raw || raw === '""' || raw === "''" || raw.toLowerCase() === 'undefined';
}

/** Exported for tests / admin diagnostics. */
export function getRedditPixelId(): string {
  const raw = String(import.meta.env.VITE_REDDIT_PIXEL_ID ?? '').trim();
  if (isBlankEnv(raw)) {
    return OFFICIAL_REDDIT_PIXEL_ID;
  }
  return raw;
}

function isRedditPixelFlagOff(): boolean {
  const raw = String(import.meta.env.VITE_REDDIT_PIXEL_ENABLED ?? '').trim().toLowerCase();
  return raw === '0' || raw === 'false' || raw === 'no' || raw === 'off';
}

export function isRedditPixelEnabled(): boolean {
  return !isRedditPixelFlagOff() && getRedditPixelId().length > 0;
}

function pixelScriptPresent(): boolean {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector(`script[src="${SCRIPT_SRC}"]`);
}

/** True when the official HTML snippet (or a prior init) already booted the pixel. */
function isPixelAlreadyBootstrapped(): boolean {
  return typeof window !== 'undefined' && typeof window.rdt === 'function' && pixelScriptPresent();
}

function ensureRdtStub(): RdtFn {
  if (typeof window === 'undefined') {
    const noop = ((..._args: unknown[]) => {}) as RdtFn;
    return noop;
  }
  if (window.rdt) return window.rdt;

  const rdtFn: RdtFn = ((...args: unknown[]) => {
    if (typeof rdtFn.sendEvent === 'function') {
      rdtFn.sendEvent(...args);
    } else {
      if (!rdtFn.callQueue) rdtFn.callQueue = [];
      rdtFn.callQueue.push(args);
    }
  }) as RdtFn;
  rdtFn.callQueue = [];
  window.rdt = rdtFn;
  return rdtFn;
}

function injectPixelScript(): void {
  if (typeof document === 'undefined') return;
  if (pixelScriptPresent()) return;
  const t = document.createElement('script');
  t.src = SCRIPT_SRC;
  t.async = true;
  t.dataset.vrRedditPixel = '1';
  const s = document.getElementsByTagName('script')[0];
  if (s?.parentNode) {
    s.parentNode.insertBefore(t, s);
  } else {
    document.head.appendChild(t);
  }
}

function rdtTrack(eventName: string, payload?: Record<string, unknown>): void {
  try {
    const rdt = window.rdt;
    if (!rdt) return;
    if (payload) rdt('track', eventName, payload);
    else rdt('track', eventName);
  } catch {
    // never break the app
  }
}

/**
 * Init base pixel + PageVisit on each public page load.
 * Call from public bootstrap (main.ts) after UTM capture.
 * No-ops when the official index.html snippet already ran.
 */
export function initRedditPixel(): void {
  try {
    if (!isRedditPixelEnabled()) return;
    if (typeof window === 'undefined') return;
    if (isEmbedMode()) return;
    if (isPixelAlreadyBootstrapped()) return;

    const pixelId = getRedditPixelId();
    const rdt = ensureRdtStub();
    injectPixelScript();
    rdt('init', pixelId);
    rdtTrack('PageVisit');
  } catch (err) {
    console.warn('[ViralRefer] Reddit pixel init skipped:', err);
  }
}

/**
 * Mirror first-party funnel steps → Reddit standard + custom events.
 * Safe no-op when pixel disabled.
 */
export function trackRedditFunnelStep(step: string): void {
  try {
    if (!isRedditPixelEnabled()) return;
    if (typeof window === 'undefined') return;
    if (isEmbedMode()) return;
    if (!window.rdt) return;

    switch (step) {
      case 'SiteLanding':
        // PageVisit already fired from the HTML snippet or initRedditPixel
        break;
      case 'GetReferralLink':
        // Best conversion signal for retargeting "got a link but didn't share"
        rdtTrack('Lead');
        rdtTrack('Custom', { customEventName: 'GetReferralLink' });
        break;
      case 'CopyReferralLink':
        rdtTrack('Custom', { customEventName: 'CopyReferralLink' });
        break;
      case 'ShareReferral':
        rdtTrack('Custom', { customEventName: 'ShareReferral' });
        break;
      case 'OpenPrizeClaim':
        rdtTrack('Custom', { customEventName: 'OpenPrizeClaim' });
        break;
      case 'SubmitPrizeClaim':
        // High-intent claim path (still not Purchase — product is free)
        rdtTrack('Custom', { customEventName: 'SubmitPrizeClaim' });
        break;
      default:
        break;
    }
  } catch {
    // ignore
  }
}
