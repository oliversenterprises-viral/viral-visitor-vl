/**
 * Site-wide visitor funnel tracking (all traffic, not just Reddit).
 * Mirrors reddit-tracking funnel steps for Admin → Edit → Site Visitor Funnel.
 */

import { getStoredUtmAttribution } from './reddit-tracking';
import { supabase } from './supabase';

const VISITOR_EVENTS_KEY = 'viralrefer_visitor_events';

/** Funnel steps shown in Admin → Edit → Site Visitor Funnel */
export type VisitorFunnelEvent =
  | 'SiteLanding'
  | 'GetReferralLink'
  | 'CopyReferralLink'
  | 'ShareReferral'
  | 'OpenPrizeClaim'
  | 'SubmitPrizeClaim';

function pushLocalVisitorEvent(eventName: string, metadata: Record<string, unknown> = {}): void {
  const utm = getStoredUtmAttribution();
  const entry = {
    event_name: eventName,
    utm_source: utm?.source,
    utm_campaign: utm?.campaign,
    utm_content: utm?.content,
    utm_medium: utm?.medium,
    ref_code: utm?.ref,
    metadata,
    created_at: new Date().toISOString(),
  };
  try {
    const prev = JSON.parse(localStorage.getItem(VISITOR_EVENTS_KEY) || '[]') as unknown[];
    const next = Array.isArray(prev) ? [...prev, entry].slice(-100) : [entry];
    localStorage.setItem(VISITOR_EVENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function logVisitorEventServer(eventName: string, metadata: Record<string, unknown> = {}): void {
  const utm = getStoredUtmAttribution();
  supabase.functions
    .invoke('record-visitor-event', {
      body: {
        eventName,
        utm_source: utm?.source,
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

/** Track a funnel step: local log + server log (when table/edge deployed). */
export function trackVisitorFunnel(
  step: VisitorFunnelEvent,
  metadata: Record<string, unknown> = {},
): void {
  pushLocalVisitorEvent(step, metadata);
  logVisitorEventServer(step, metadata);
}

/** Call once at bootstrap after UTM capture — logs every landing. */
export function initVisitorTracking(): void {
  trackVisitorFunnel('SiteLanding', { path: location.pathname });
}

export function getLocalVisitorEvents(): Array<Record<string, unknown>> {
  try {
    return JSON.parse(localStorage.getItem(VISITOR_EVENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of arr) {
    const k = keyFn(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

export function computeVisitorFunnelStats(events: Array<Record<string, any>>) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const name = String(e.event_name || e.eventName || 'unknown');
    counts[name] = (counts[name] || 0) + 1;
  }
  const funnelOrder: VisitorFunnelEvent[] = [
    'SiteLanding',
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
    lastEvents: [...events].slice(-8).reverse(),
    bySource: groupBy(events, (e) => String(e.utm_source || e.utmSource || '(direct)')),
  };
}

export async function getVisitorEventsForStats(): Promise<{
  events: Array<Record<string, any>>;
  source: 'server' | 'local';
  fetchError?: string;
}> {
  const local = getLocalVisitorEvents();
  const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';

  if (!adminSecret) {
    return { events: local, source: 'local', fetchError: 'Admin secret not configured in build' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('admin-action', {
      body: { action: 'get_visitor_stats' },
      headers: { 'x-admin-secret': adminSecret },
    });
    if (error) {
      return { events: local, source: 'local', fetchError: error.message || 'Server request failed' };
    }
    if (!data?.success) {
      return {
        events: local,
        source: 'local',
        fetchError: String(data?.error || 'get_visitor_stats rejected'),
      };
    }
    if (!Array.isArray(data.data)) {
      return { events: local, source: 'local', fetchError: 'Invalid server response' };
    }
    const serverEvents = data.data.map((row: Record<string, any>) => ({
      event_name: row.event_name,
      utm_source: row.utm_source,
      utm_campaign: row.utm_campaign,
      utm_content: row.utm_content,
      utm_medium: row.utm_medium,
      ref_code: row.ref_code,
      metadata: row.metadata,
      created_at: row.created_at,
    }));
    return { events: serverEvents, source: 'server' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { events: local, source: 'local', fetchError: msg };
  }
}