/**
 * Reddit Ads pixel + UTM attribution + funnel events for paid campaigns.
 * Pixel ID: VITE_REDDIT_PIXEL_ID in Vercel (fallback matches index.html head snippet).
 */

import { supabase } from './supabase';

export interface UtmAttribution {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  ref: string | null;
  landed_at: string;
}

const UTM_STORAGE_KEY = 'vr_utm_attribution';
const REDDIT_EVENTS_KEY = 'viralrefer_reddit_events';

/** Must match index.html fallback so track calls never silently no-op when env is inlined. */
const REDDIT_PIXEL_ID_FALLBACK = 'a2_jr6jdbg2r4';

const REDDIT_PIXEL_ID =
  (import.meta.env.VITE_REDDIT_PIXEL_ID as string | undefined)?.trim() || REDDIT_PIXEL_ID_FALLBACK;

type RedditStandardEvent = 'PageVisit' | 'Lead' | 'SignUp' | 'Custom';

/** Funnel steps you can see in Admin → Edit → Reddit Campaign Stats */
export type RedditFunnelEvent =
  | 'RedditLanding'
  | 'GetReferralLink'
  | 'CopyReferralLink'
  | 'ShareReferral'
  | 'OpenPrizeClaim'
  | 'SubmitPrizeClaim';

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

export function getRedditPixelId(): string {
  return REDDIT_PIXEL_ID;
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
    // Non-fatal
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

function pushLocalRedditEvent(eventName: string, metadata: Record<string, unknown> = {}): void {
  const utm = getStoredUtmAttribution();
  const entry = {
    event_name: eventName,
    utm_campaign: utm?.campaign,
    utm_content: utm?.content,
    utm_medium: utm?.medium,
    ref_code: utm?.ref,
    metadata,
    created_at: new Date().toISOString(),
  };
  try {
    const prev = JSON.parse(localStorage.getItem(REDDIT_EVENTS_KEY) || '[]') as unknown[];
    const next = Array.isArray(prev) ? [...prev, entry].slice(-100) : [entry];
    localStorage.setItem(REDDIT_EVENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function logRedditEventServer(eventName: string, metadata: Record<string, unknown> = {}): void {
  const utm = getStoredUtmAttribution();
  supabase.functions
    .invoke('record-reddit-event', {
      body: {
        eventName,
        utm_campaign: utm?.campaign,
        utm_content: utm?.content,
        utm_medium: utm?.medium,
        ref_code: utm?.ref,
        metadata,
        timestamp: new Date().toISOString(),
      },
    })
    .catch(() => {});
}

/** Map funnel steps to Reddit standard + custom pixel events for Events Manager. */
function pixelEventForFunnel(step: RedditFunnelEvent): { standard: RedditStandardEvent; customName?: string } {
  switch (step) {
    case 'RedditLanding':
      return { standard: 'Custom', customName: 'RedditLanding' };
    case 'GetReferralLink':
      return { standard: 'Lead' };
    case 'SubmitPrizeClaim':
      return { standard: 'SignUp' };
    default:
      return { standard: 'Custom', customName: step };
  }
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
  if (!window.rdt) {
    loadRedditPixelScript();
    callRdt('init', REDDIT_PIXEL_ID);
    callRdt('track', 'PageVisit');
  }

  console.log('[ViralRefer] Reddit pixel ready', REDDIT_PIXEL_ID);
}

export function trackRedditEvent(
  event: RedditStandardEvent,
  options?: { customEventName?: string },
): void {
  if (!window.rdt) return;

  if (event === 'Custom' && options?.customEventName) {
    callRdt('track', 'Custom', { customEventName: options.customEventName });
  } else {
    callRdt('track', event);
  }
}

/**
 * Track a funnel step: Reddit pixel + local log + server log (when table/edge deployed).
 * Only logs server-side for Reddit-attributed sessions to reduce noise.
 */
export function trackRedditFunnel(
  step: RedditFunnelEvent,
  metadata: Record<string, unknown> = {},
): void {
  const { standard, customName } = pixelEventForFunnel(step);
  if (standard === 'Custom' && customName) {
    trackRedditEvent('Custom', { customEventName: customName });
  } else {
    trackRedditEvent(standard);
  }

  if (!isRedditTraffic()) return;

  pushLocalRedditEvent(step, metadata);
  logRedditEventServer(step, metadata);
}

/** Call once at bootstrap: capture UTMs, init pixel, show Reddit banner. */
export function initRedditTracking(): void {
  const utm = captureUtmAttribution();
  initRedditPixel();
  showRedditWelcomeBanner();

  if (utm?.source === 'reddit' || isRedditTraffic()) {
    trackRedditFunnel('RedditLanding', { path: location.pathname });
  }
}

export function getLocalRedditEvents(): Array<Record<string, unknown>> {
  try {
    return JSON.parse(localStorage.getItem(REDDIT_EVENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function latestRedditEvents(events: Array<Record<string, unknown>>, limit: number) {
  return [...events]
    .sort((a, b) => {
      const ta = new Date(String(a.created_at || a.timestamp || 0)).getTime();
      const tb = new Date(String(b.created_at || b.timestamp || 0)).getTime();
      return tb - ta;
    })
    .slice(0, limit);
}

export function computeRedditFunnelStats(events: Array<Record<string, any>>) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const name = String(e.event_name || e.eventName || 'unknown');
    counts[name] = (counts[name] || 0) + 1;
  }
  const funnelOrder: RedditFunnelEvent[] = [
    'RedditLanding',
    'GetReferralLink',
    'CopyReferralLink',
    'ShareReferral',
    'OpenPrizeClaim',
    'SubmitPrizeClaim',
  ];
  const funnel = funnelOrder.map((name) => ({
    name,
    count: counts[name] || 0,
  }));
  return {
    funnel,
    total: events.length,
    lastEvents: latestRedditEvents(events, 8),
    byCampaign: groupBy(events, (e) => String(e.utm_campaign || e.utmCampaign || '(none)')),
  };
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of arr) {
    const k = keyFn(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

export async function getRedditEventsForStats(): Promise<{
  events: Array<Record<string, any>>;
  source: 'server' | 'local';
  fetchError?: string;
}> {
  const local = getLocalRedditEvents();
  const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';

  if (!adminSecret) {
    return { events: local, source: 'local', fetchError: 'Admin secret not configured in build' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('admin-action', {
      body: { action: 'get_reddit_stats' },
      headers: { 'x-admin-secret': adminSecret },
    });
    if (error) {
      return { events: local, source: 'local', fetchError: error.message || 'Server request failed' };
    }
    if (!data?.success) {
      return {
        events: local,
        source: 'local',
        fetchError: String(data?.error || 'get_reddit_stats rejected'),
      };
    }
    if (!Array.isArray(data.data)) {
      return { events: local, source: 'local', fetchError: 'Invalid server response' };
    }
    const serverEvents = data.data.map((row: Record<string, any>) => ({
      event_name: row.event_name,
      utm_campaign: row.utm_campaign,
      utm_content: row.utm_content,
      utm_medium: row.utm_medium,
      ref_code: row.ref_code,
      metadata: row.metadata,
      created_at: row.created_at,
    }));
    // Trust server even when empty — refresh should show 0s, not silently fall back to local
    return { events: serverEvents, source: 'server' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { events: local, source: 'local', fetchError: msg };
  }
}