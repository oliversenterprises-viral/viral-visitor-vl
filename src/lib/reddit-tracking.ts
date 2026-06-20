/**
 * Reddit Ads pixel + UTM attribution for paid campaigns.
 * Pixel ID: set VITE_REDDIT_PIXEL_ID in Vercel (from Reddit Events Manager).
 */

export interface UtmAttribution {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  ref: string | null;
  landed_at: string;
}

const UTM_STORAGE_KEY = 'vr_utm_attribution';

const REDDIT_PIXEL_ID = (import.meta.env.VITE_REDDIT_PIXEL_ID as string | undefined)?.trim() || '';

type RedditEvent = 'PageVisit' | 'Lead' | 'SignUp' | 'Custom';

type RedditPixelFn = {
  (...args: unknown[]): void;
  sendEvent?: (...args: unknown[]) => void;
  callQueue?: unknown[][];
};

declare global {
  interface Window {
    rdt?: RedditPixelFn;
  }
}

function callRdt(...args: unknown[]): void {
  const rdt = window.rdt as RedditPixelFn | undefined;
  rdt?.(...args);
}

function loadRedditPixelScript(): void {
  if (window.rdt || document.querySelector('script[data-vr-reddit-pixel]')) return;

  const queue = function (...args: unknown[]) {
    const r = window.rdt!;
    if (r.sendEvent) r.sendEvent(...args);
    else (r.callQueue = r.callQueue || []).push(args);
  } as RedditPixelFn;
  window.rdt = queue;

  const script = document.createElement('script');
  script.src = 'https://www.redditstatic.com/ads/pixel.js';
  script.async = true;
  script.dataset.vrRedditPixel = '1';
  document.head.appendChild(script);
}

/** Persist UTM params from the landing URL (first touch per session). */
export function captureUtmAttribution(): UtmAttribution | null {
  const params = new URLSearchParams(location.search);
  const source = params.get('utm_source');
  if (!source) return null;

  const attribution: UtmAttribution = {
    source,
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    ref: params.get('ref'),
    landed_at: new Date().toISOString(),
  };

  try {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Non-fatal — tracking still works for this page load
  }

  console.log('[ViralRefer] UTM attribution captured:', attribution);
  return attribution;
}

export function getStoredUtmAttribution(): UtmAttribution | null {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UtmAttribution) : null;
  } catch {
    return null;
  }
}

export function isRedditTraffic(): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get('utm_source') === 'reddit') return true;
  const stored = getStoredUtmAttribution();
  return stored?.source === 'reddit';
}

/** Show a welcome strip for Reddit ad clicks. */
export function showRedditWelcomeBanner(): void {
  if (!isRedditTraffic()) return;

  let banner = document.getElementById('reddit-welcome-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'reddit-welcome-banner';
    banner.className =
      'bg-gradient-to-r from-orange-600/25 to-orange-500/10 border-b border-orange-500/30 px-4 py-2.5 text-center text-sm text-orange-100';
    banner.innerHTML =
      '👋 Welcome from Reddit — grab your referral link in 30 seconds and climb the live leaderboard.';
    document.body.prepend(banner);
  } else {
    banner.classList.remove('hidden');
  }
}

export function initRedditPixel(): void {
  if (!REDDIT_PIXEL_ID) {
    if (isRedditTraffic()) {
      console.warn('[ViralRefer] Reddit traffic detected but VITE_REDDIT_PIXEL_ID is not set');
    }
    return;
  }

  // index.html may have already initialized the pixel in <head>
  if (!window.rdt) {
    loadRedditPixelScript();
    callRdt('init', REDDIT_PIXEL_ID);
    callRdt('track', 'PageVisit');
  }

  console.log('[ViralRefer] Reddit pixel ready');
}

export function trackRedditEvent(
  event: RedditEvent,
  options?: { customEventName?: string },
): void {
  if (!REDDIT_PIXEL_ID || !window.rdt) return;

  if (event === 'Custom' && options?.customEventName) {
    callRdt('track', 'Custom', { customEventName: options.customEventName });
  } else {
    callRdt('track', event);
  }
}

/** Call once at bootstrap: capture UTMs, init pixel, show Reddit banner. */
export function initRedditTracking(): void {
  captureUtmAttribution();
  initRedditPixel();
  showRedditWelcomeBanner();
}