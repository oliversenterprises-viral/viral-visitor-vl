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
import { isOutboundSiteClickZone, resolveViralZoneFromTarget, type ViralZoneId } from './viral-zones';
import { getClientAutomationMetadata } from './test-referral';
import { shouldDropNoiseWrites } from './platform-guard';

const LOCAL_KEY = 'viralrefer_interaction_events';
/** Disk IO: fewer scroll writes (was 25/50/75/100). */
const SCROLL_MILESTONES = [50, 100] as const;
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
  if (shouldDropNoiseWrites()) return;
  const utm = getStoredUtmAttribution();
  const {
    metadata: metaFromPayload,
    event_type,
    zone_id,
    path,
    x,
    y,
    viewport_w,
    viewport_h,
    scroll_y,
    scroll_depth_pct,
    ...rest
  } = payload;
  const metadata =
    metaFromPayload && typeof metaFromPayload === 'object' && !Array.isArray(metaFromPayload)
      ? { ...getClientAutomationMetadata(), ...(metaFromPayload as Record<string, unknown>) }
      : { ...getClientAutomationMetadata() };
  // Preserve unknown extras inside metadata for admin inspection
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined && !(k in metadata)) metadata[k] = v;
  }

  supabase.functions
    .invoke('record-interaction', {
      body: {
        event_type,
        zone_id,
        path: path ?? location.pathname,
        x,
        y,
        viewport_w,
        viewport_h,
        scroll_y,
        scroll_depth_pct,
        metadata,
        visitor_id: getVisitorId(),
        session_id: getVisitorSessionId(),
        utm_source: utm?.source,
        ref_code: resolveRefCode(),
        ab_variant: resolveShareAbVariant(resolveReferralCodeForAb()),
        is_referred: isReferredLanding(),
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

export type BroadcastClickKind = 'body' | 'sponsor' | 'sponsor_img';

/** Fire-and-forget when a visitor clicks any link inside the owner broadcaster. */
export function trackBroadcastLinkClick(opts: {
  href: string;
  kind: BroadcastClickKind;
  broadcastId?: string;
  label?: string;
}): void {
  const href = String(opts.href || '').trim().slice(0, 2000);
  if (!href) return;
  const zone: ViralZoneId =
    opts.kind === 'sponsor'
      ? 'owner-broadcast-sponsor'
      : opts.kind === 'sponsor_img'
        ? 'owner-broadcast-sponsor-img'
        : 'owner-broadcast-link';
  recordInteraction('click', zone, {
    metadata: {
      href,
      kind: opts.kind,
      broadcast_id: String(opts.broadcastId || '').slice(0, 80) || null,
      label: String(opts.label || '').slice(0, 120) || null,
      source: 'owner_broadcast',
    },
  });
}

function outboundClickMeta(target: EventTarget | null): Record<string, unknown> {
  if (!target || !(target instanceof Element)) return {};
  const zoned = target.closest('[data-vr-zone]') as HTMLElement | null;
  if (!zoned) return {};
  const anchor = (zoned instanceof HTMLAnchorElement ? zoned : zoned.closest('a')) as
    | HTMLAnchorElement
    | null;
  const href = String(zoned.getAttribute('data-vr-href') || anchor?.href || '')
    .trim()
    .slice(0, 2000);
  const label = String(zoned.getAttribute('data-vr-label') || anchor?.textContent || '')
    .trim()
    .slice(0, 120);
  const meta: Record<string, unknown> = { source: 'outbound_site' };
  if (href) meta.href = href;
  if (label) meta.label = label;
  return meta;
}

function onDocumentClick(e: MouseEvent): void {
  const zone = resolveViralZoneFromTarget(e.target);
  if (!zone) return;
  const extra: Record<string, unknown> = {
    x: Math.round(e.clientX),
    y: Math.round(e.clientY),
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    scroll_y: Math.round(window.scrollY),
  };
  if (isOutboundSiteClickZone(zone)) {
    extra.metadata = outboundClickMeta(e.target);
  }
  recordInteraction('click', zone, extra);
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