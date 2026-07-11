/**
 * Site-wide visitor funnel tracking (all traffic, not just Reddit).
 * Funnel steps for Admin → Edit → Site Visitor Funnel.
 */

import { isAdminStatsReadOnlyRefresh } from './admin-stats-refresh-guard';
import { getStoredLandingRef } from './referral-url';
import { getStoredUtmAttribution } from './utm-attribution';
import { supabase } from './supabase';
import { eventName, groupBy, latestEvents } from './stats-helpers';

const VISITOR_EVENTS_KEY = 'viralrefer_visitor_events';
const VISITOR_ID_KEY = 'vr_visitor_id';
const VISITOR_SESSION_KEY = 'vr_visitor_session_id';

/** Stable anonymous visitor id (exported for interaction-tracking). */
export function getVisitorId(): string {
  return getOrCreateVisitorId();
}

/** Per-tab session id (exported for interaction-tracking). */
export function getVisitorSessionId(): string {
  return getOrCreateSessionId();
}

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

/** Viral loop engagement events (admin-tracked separately from core funnel). */
export type ViralLoopEvent =
  | 'ChallengeLanding'
  | 'ChallengeLinkReady'
  | 'DuelInviteShown'
  | 'ChallengeDuelShared'
  | 'ReceiptGenerated'
  | 'ReceiptShared'
  | 'AnxietyBarShown'
  | 'AnxietyBarAction'
  | 'AnxietyNotification'
  | 'SprintBoardView'
  | 'CommunityUnlockView'
  | 'CommunityUnlockCelebration';

export const VIRAL_LOOP_EVENT_ORDER: ViralLoopEvent[] = [
  'ChallengeLanding',
  'ChallengeLinkReady',
  'DuelInviteShown',
  'ChallengeDuelShared',
  'ReceiptGenerated',
  'ReceiptShared',
  'AnxietyBarShown',
  'AnxietyBarAction',
  'AnxietyNotification',
  'SprintBoardView',
  'CommunityUnlockView',
  'CommunityUnlockCelebration',
];

/** Passive impressions — excluded from Engaged + Recent events (pollutes funnel readability). */
export const PASSIVE_VIRAL_LOOP_EVENTS: ReadonlySet<ViralLoopEvent> = new Set([
  'SprintBoardView',
  'CommunityUnlockView',
  'DuelInviteShown',
  'AnxietyBarShown',
]);

const FUNNEL_EVENT_ORDER: VisitorFunnelEvent[] = [
  'SiteLanding',
  'GetReferralLink',
  'CopyReferralLink',
  'ShareReferral',
  'OpenPrizeClaim',
  'SubmitPrizeClaim',
];

function isViralLoopEventName(name: string): name is ViralLoopEvent {
  return (VIRAL_LOOP_EVENT_ORDER as readonly string[]).includes(name);
}

function isFunnelEventName(name: string): name is VisitorFunnelEvent {
  return (FUNNEL_EVENT_ORDER as readonly string[]).includes(name);
}

/** Events shown in admin Recent events (funnel steps + meaningful viral actions). */
export function isVisitorStatsRecentEvent(event: Record<string, unknown>): boolean {
  const name = eventName(event);
  if (isFunnelEventName(name)) return true;
  if (isViralLoopEventName(name)) return !PASSIVE_VIRAL_LOOP_EVENTS.has(name);
  return false;
}

export function isViralLoopStep(name: string): boolean {
  return isViralLoopEventName(name.trim());
}

export function isPassiveViralLoopStep(name: string): boolean {
  const step = name.trim() as ViralLoopEvent;
  return isViralLoopEventName(step) && PASSIVE_VIRAL_LOOP_EVENTS.has(step);
}

const FUNNEL_EVENT_LABELS: Record<VisitorFunnelEvent, string> = {
  SiteLanding: 'Landing',
  GetReferralLink: 'Get link',
  CopyReferralLink: 'Copy link',
  ShareReferral: 'Share',
  OpenPrizeClaim: 'Open claim',
  SubmitPrizeClaim: 'Submit claim',
};

/** Human-readable label for admin recent-events + live feed. */
export function formatVisitorEventDisplayName(name: string): string {
  const step = name.trim();
  if (isFunnelEventName(step)) return FUNNEL_EVENT_LABELS[step];
  if (isViralLoopStep(step)) return `Loop: ${step}`;
  return step;
}

/** Parse metadata from JSONB object or legacy JSON string rows. */
export function parseVisitorEventMetadata(event: Record<string, unknown>): Record<string, unknown> {
  const meta = event.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  if (typeof meta === 'string' && meta.trim()) {
    try {
      const parsed = JSON.parse(meta) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

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
  if (isAdminStatsReadOnlyRefresh()) return;
  pushLocalVisitorEvent(step, metadata);
  logVisitorEventServer(step, metadata);
}

/** Track viral loop engagement (same visitor_events table, distinct event names). */
export function trackViralLoopEvent(
  step: ViralLoopEvent,
  metadata: Record<string, unknown> = {},
): void {
  if (isAdminStatsReadOnlyRefresh()) return;
  pushLocalVisitorEvent(step, { ...metadata, loop: 'viral' });
  // Disk IO: passive impressions (sprint/community/duel/anxiety shown) stay local-only.
  // Server write only for meaningful actions (share, receipt, unlock celebrate, etc.).
  if (PASSIVE_VIRAL_LOOP_EVENTS.has(step)) return;
  logVisitorEventServer(step, { ...metadata, loop: 'viral' });
}

/** Call once at bootstrap after UTM capture — logs every landing. */
export function initVisitorTracking(): void {
  trackVisitorFunnel('SiteLanding', { path: location.pathname });
}

export function getLocalVisitorEvents(): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(VISITOR_EVENTS_KEY) || '[]');
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

function eventVisitorId(e: Record<string, unknown>): string | null {
  const id = String(e.visitor_id || e.visitorId || '').trim();
  return id || null;
}

function uniqueVisitorsFor(events: Array<Record<string, unknown>>, filterName?: string): number {
  const ids = new Set<string>();
  for (const e of events) {
    if (filterName && eventName(e) !== filterName) continue;
    const id = eventVisitorId(e);
    if (id) ids.add(id);
  }
  return ids.size;
}

/** Unique visitors who took action beyond landing (excludes passive viral impressions). */
function uniqueEngagedVisitors(events: Array<Record<string, unknown>>): number {
  const ids = new Set<string>();
  for (const e of events) {
    const name = eventName(e);
    if (name === 'SiteLanding') continue;
    if (isViralLoopEventName(name) && PASSIVE_VIRAL_LOOP_EVENTS.has(name)) continue;
    const id = eventVisitorId(e);
    if (id) ids.add(id);
  }
  return ids.size;
}

function countEventsMatching(
  events: Array<Record<string, unknown>>,
  predicate: (name: string) => boolean,
): number {
  return events.filter((e) => predicate(eventName(e))).length;
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
  const funnel = FUNNEL_EVENT_ORDER.map((name) => ({
    name,
    count: counts[name] || 0,
    unique: uniqueVisitorsFor(events, name),
  }));
  const viralLoops = VIRAL_LOOP_EVENT_ORDER.map((name) => ({
    name,
    count: counts[name] || 0,
    unique: uniqueVisitorsFor(events, name),
  }));
  const recentPool = events.filter(isVisitorStatsRecentEvent);

  return {
    funnel,
    viralLoops,
    total: events.length,
    funnelEventCount: countEventsMatching(events, isFunnelEventName),
    viralLoopEventCount: countEventsMatching(events, isViralLoopEventName),
    uniqueVisitorsLanding: uniqueVisitorsFor(events, 'SiteLanding'),
    uniqueVisitorsAny: uniqueEngagedVisitors(events),
    lastEvents: latestEvents(recentPool, 8),
    bySource: groupBy(
      events.filter((e) => eventName(e) === 'SiteLanding'),
      (e) => String(e.utm_source || e.utmSource || '(direct)'),
    ),
    byCountry: uniqueByCountry(events),
  };
}

// Admin funnel fetch lives in visitor-funnel-fetch.ts (import that module directly).
// Do NOT re-export via dynamic import here — Rolldown broke named-export interop
// and crashed Viral Optimizer. Do NOT static-import it here either — that creates
// a circular dependency with visitor-funnel-fetch → visitor-tracking.