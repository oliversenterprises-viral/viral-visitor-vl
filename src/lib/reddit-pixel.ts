/**
 * Reddit Ads Pixel — optional retargeting + conversion tracking.
 *
 * Safe-by-default:
 * - Loads ONLY when `VITE_REDDIT_PIXEL_ID` is a non-empty pixel id
 * - Never throws; never blocks the public funnel
 * - Skipped on /embed (traffic exchanges)
 * - No PII / advanced matching
 *
 * Events (best retargeting ladder for ViralRefer):
 * - PageVisit     → all homepage landings (build retargeting pool)
 * - Lead          → GetReferralLink (high-intent converters)
 * - Custom        → CopyReferralLink / ShareReferral (super-intent)
 *
 * Reddit Events Manager → create audiences from these events.
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

const PAGE_VISIT_SESSION_KEY = 'vr_rdt_pagevisit';
const SCRIPT_SRC = 'https://www.redditstatic.com/ads/pixel.js';

/** Exported for tests / admin diagnostics. */
export function getRedditPixelId(): string {
  const raw = String(import.meta.env.VITE_REDDIT_PIXEL_ID ?? '').trim();
  // Guard empty quotes left in env files
  if (!raw || raw === '""' || raw === "''" || raw.toLowerCase() === 'undefined') {
    return '';
  }
  return raw;
}

export function isRedditPixelEnabled(): boolean {
  return getRedditPixelId().length > 0;
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
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
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
 * Init base pixel + PageVisit once per tab session.
 * Call from public bootstrap (main.ts) after UTM capture.
 */
export function initRedditPixel(): void {
  try {
    if (!isRedditPixelEnabled()) return;
    if (typeof window === 'undefined') return;
    if (isEmbedMode()) return;

    const pixelId = getRedditPixelId();
    const rdt = ensureRdtStub();
    injectPixelScript();
    rdt('init', pixelId);

    // One PageVisit per tab session (retargeting pool)
    let already = false;
    try {
      already = sessionStorage.getItem(PAGE_VISIT_SESSION_KEY) === '1';
    } catch {
      already = false;
    }
    if (!already) {
      rdtTrack('PageVisit');
      try {
        sessionStorage.setItem(PAGE_VISIT_SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
    }
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
        // PageVisit already fired in initRedditPixel (deduped)
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
