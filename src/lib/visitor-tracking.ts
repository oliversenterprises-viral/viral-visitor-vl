/**
 * Site-wide visitor funnel tracking (all traffic, not just Reddit).
 * Mirrors reddit-tracking funnel steps for Admin → Edit → Site Visitor Funnel.
 */

import { getStoredLandingRef } from './referral-url';
import { getStoredUtmAttribution } from './reddit-tracking';
import { supabase } from './supabase';
import { eventName, groupBy, latestEvents } from './stats-helpers';

const VISITOR_EVENTS_KEY = 'viralrefer_visitor_events';
const VISITOR_ID_KEY = 'vr_visitor_id';
const VISITOR_SESSION_KEY = 'vr_visitor_session_id';

function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function getOrCreateSessionId(): string {
  try {
    let id = sessionStorage.getItem(VISITOR_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(VISITOR_SESSION_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Funnel steps shown in Admin → Edit → Site Visitor Funnel */
export type VisitorFunnelEvent =
  | 'SiteLanding'
  | 'GetReferralLink'
  | 'CopyReferralLink'
  | 'ShareReferral'
  | 'OpenPrizeClaim'
  | 'SubmitPrizeClaim';

function resolveRefCode(): string | undefined {
  const utm = getStoredUtmAttribution();
  return utm?.ref || getStoredLandingRef() || undefined;
}

function pushLocalVisitorEvent(eventName: string, metadata: Record<string, unknown> = {}): void {
  const utm = getStoredUtmAttribution();
  const entry = {
    event_name: eventName,
    visitor_id: getOrCreateVisitorId(),
    session_id: getOrCreateSessionId(),
    utm_source: utm?.source,
    utm_campaign: utm?.campaign,
    utm_content: utm?.content,
    utm_medium: utm?.medium,
    ref_code: resolveRefCode(),
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
        visitor_id: getOrCreateVisitorId(),
        session_id: getOrCreateSessionId(),
        utm_source: utm?.source,
        utm_campaign: utm?.campaign,
        utm_content: utm?.content,
        utm_medium: utm?.medium,
        ref_code: resolveRefCode(),
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

function eventVisitorId(e: Record<string, unknown>): string | null {
  const id = String(e.visitor_id || e.visitorId || '').trim();
  return id || null;
}

function uniqueVisitorsFor(events: Array<Record<string, unknown>>, eventName?: string): number {
  const ids = new Set<string>();
  for (const e of events) {
    if (eventName && String(e.event_name || e.eventName) !== eventName) continue;
    const id = eventVisitorId(e);
    if (id) ids.add(id);
  }
  return ids.size;
}

function uniqueByCountry(
  events: Array<Record<string, unknown>>,
  eventName = 'SiteLanding',
): Array<{ country: string; unique: number; events: number }> {
  const byCountry = new Map<string, { ids: Set<string>; events: number }>();
  for (const e of events) {
    if (String(e.event_name || e.eventName) !== eventName) continue;
    const country = String(e.country_code || e.countryCode || '').trim().toUpperCase() || '—';
    const bucket = byCountry.get(country) || { ids: new Set<string>(), events: 0 };
    bucket.events += 1;
    const id = eventVisitorId(e);
    if (id) bucket.ids.add(id);
    byCountry.set(country, bucket);
  }
  return [...byCountry.entries()]
    .map(([country, v]) => ({ country, unique: v.ids.size, events: v.events }))
    .sort((a, b) => b.unique - a.unique || b.events - a.events);
}

export function computeVisitorFunnelStats(events: Array<Record<string, any>>) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const name = eventName(e);
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
    unique: uniqueVisitorsFor(events, name),
  }));
  return {
    funnel,
    total: events.length,
    uniqueVisitorsLanding: uniqueVisitorsFor(events, 'SiteLanding'),
    uniqueVisitorsAny: uniqueVisitorsFor(events),
    lastEvents: latestEvents(events, 8),
    bySource: groupBy(
      events.filter((e) => eventName(e) === 'SiteLanding'),
      (e) => String(e.utm_source || e.utmSource || '(direct)'),
    ),
    byCountry: uniqueByCountry(events),
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
      visitor_id: row.visitor_id,
      session_id: row.session_id,
      country_code: row.country_code,
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