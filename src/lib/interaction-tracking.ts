/**
 * Viral zone interaction capture — clicks + scroll depth milestones.
 * Fire-and-forget to record-interaction edge (mirrors visitor-tracking).
 */

import { isAdminStatsReadOnlyRefresh } from './admin-stats-refresh-guard';
import { isReferredLanding } from './funnel-conversion';
import { resolveShareAbVariant } from './share-ab';
import { getStoredLandingRef, parseRefFromLocation } from './referral-url';
import { getStoredUtmAttribution } from './utm-attribution';
import { supabase } from './supabase';
import { getVisitorSessionId, getVisitorId } from './visitor-tracking';
import { resolveViralZoneFromTarget, type ViralZoneId } from './viral-zones';

const LOCAL_KEY = 'viralrefer_interaction_events';
const SCROLL_MILESTONES = [25, 50, 75, 100] as const;
const MAX_LOCAL = 80;

let bound = false;
const scrollHit = new Set<number>();

function isTrackingSuppressed(): boolean {
  if (isAdminStatsReadOnlyRefresh()) return true;
  const adminModal = document.getElementById('admin-modal');
  if (adminModal && !adminModal.classList.contains('hidden')) return true;
  return false;
}

function resolveRefCode(): string | undefined {
  const utm = getStoredUtmAttribution();
  return utm?.ref || getStoredLandingRef() || parseRefFromLocation() || undefined;
}

function resolveReferralCodeForAb(): string {
  return resolveRefCode() || 'ANON';
}

function pushLocal(entry: Record<string, unknown>): void {
  try {
    const prev = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as unknown[];
    const next = Array.isArray(prev) ? [...prev, entry].slice(-MAX_LOCAL) : [entry];
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {
    // non-fatal
  }
}

function logInteractionServer(payload: Record<string, unknown>): void {
  const utm = getStoredUtmAttribution();
  supabase.functions
    .invoke('record-interaction', {
      body: {
        ...payload,
        visitor_id: getVisitorId(),
        session_id: getVisitorSessionId(),
        utm_source: utm?.source,
        ref_code: resolveRefCode(),
        ab_variant: resolveShareAbVariant(resolveReferralCodeForAb()),
        is_referred: isReferredLanding(),
        path: location.pathname,
        timestamp: new Date().toISOString(),
      },
    })
    .catch(() => {});
}

function recordInteraction(
  eventType: 'click' | 'scroll_depth',
  zoneId: ViralZoneId | 'page',
  extra: Record<string, unknown> = {},
): void {
  if (isTrackingSuppressed()) return;
  const entry = {
    event_type: eventType,
    zone_id: zoneId,
    path: location.pathname,
    ...extra,
    created_at: new Date().toISOString(),
  };
  pushLocal(entry);
  logInteractionServer(entry);
}

function onDocumentClick(e: MouseEvent): void {
  const zone = resolveViralZoneFromTarget(e.target);
  if (!zone) return;
  recordInteraction('click', zone, {
    x: Math.round(e.clientX),
    y: Math.round(e.clientY),
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    scroll_y: Math.round(window.scrollY),
  });
}

function onScroll(): void {
  const doc = document.documentElement;
  const max = Math.max(1, doc.scrollHeight - window.innerHeight);
  const pct = Math.min(100, Math.round((window.scrollY / max) * 100));
  for (const milestone of SCROLL_MILESTONES) {
    if (pct < milestone || scrollHit.has(milestone)) continue;
    scrollHit.add(milestone);
    recordInteraction('scroll_depth', 'page', {
      scroll_depth_pct: milestone,
      scroll_y: Math.round(window.scrollY),
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
    });
  }
}

/** Idempotent — safe to call from bootstrap. */
export function initInteractionTracking(): void {
  if (bound || typeof document === 'undefined') return;
  bound = true;
  document.addEventListener('click', onDocumentClick, { capture: true, passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function getLocalInteractionEvents(): Array<Record<string, unknown>> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}