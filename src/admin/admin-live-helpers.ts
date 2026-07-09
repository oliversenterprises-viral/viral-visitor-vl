/**
 * Pure helpers for the admin live activity hub — event parsing, feed HTML, tab badges.
 */

import { isPassiveViralLoopStep, isViralLoopStep } from '../lib/visitor-tracking';

export type AdminLiveEventKind =
  | 'referral'
  | 'share'
  | 'claim'
  | 'visitor'
  | 'banner'
  | 'content';

export interface AdminLiveEvent {
  id: string;
  kind: AdminLiveEventKind;
  tab: number;
  icon: string;
  label: string;
  detail: string;
  at: string;
  /** visitor_events.event_name when kind is visitor */
  funnelStep?: string;
  /** Landing referral code when visitor arrived via ?ref= */
  refCode?: string;
}

export type AdminLiveFilterToggle = AdminLiveEventKind | 'showLandings';

/** Referred = landed with ref code or credited signup; direct = no landing ref. */
export type AdminLiveTrafficSegment = 'all' | 'referred' | 'direct';

export interface AdminLiveFeedFilters {
  referral: boolean;
  share: boolean;
  visitor: boolean;
  banner: boolean;
  claim: boolean;
  content: boolean;
  /** When false (default), SiteLanding funnel chips are hidden. */
  showLandings: boolean;
  /** Default all — filter funnel chips by referred vs direct traffic. */
  trafficSegment: AdminLiveTrafficSegment;
}

export const ADMIN_LIVE_FILTERS_STORAGE_KEY = 'vr_admin_live_filters';

export const DEFAULT_ADMIN_LIVE_FILTERS: AdminLiveFeedFilters = {
  referral: true,
  share: true,
  visitor: true,
  banner: true,
  claim: true,
  content: true,
  showLandings: false,
  trafficSegment: 'all',
};

const KIND_META: Record<
  AdminLiveEventKind,
  { tab: number; icon: string; color: string }
> = {
  referral: { tab: 0, icon: 'fa-user-plus', color: 'text-emerald-400' },
  share: { tab: 1, icon: 'fa-share-nodes', color: 'text-violet-400' },
  claim: { tab: 3, icon: 'fa-trophy', color: 'text-amber-400' },
  visitor: { tab: 2, icon: 'fa-chart-line', color: 'text-sky-400' },
  banner: { tab: 2, icon: 'fa-image', color: 'text-emerald-300' },
  content: { tab: 2, icon: 'fa-pen', color: 'text-rose-300' },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function str(value: unknown, max = 48): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function rowAt(row: Record<string, unknown>): string {
  return String(row.created_at || row.updated_at || new Date().toISOString());
}

/** Human-readable relative time for the live feed ticker. */
export function formatAdminLiveTime(iso: string, now = Date.now()): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 10) return 'now';
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Map a Supabase realtime payload into a feed event (null = skip / unknown). */
export function parseAdminLiveEvent(
  table: string,
  eventType: string,
  row: Record<string, unknown> | null | undefined,
): AdminLiveEvent | null {
  if (!row || typeof row !== 'object') return null;

  const id = str(row.id || `${table}-${Date.now()}`, 80) || `${table}-${Date.now()}`;
  const at = rowAt(row);

  if (table === 'referrals' && eventType === 'INSERT') {
    const code = str(row.referrer_code, 16);
    return {
      id,
      kind: 'referral',
      ...pickMeta('referral'),
      label: 'New referral',
      detail: code || 'anonymous',
      at,
    };
  }

  if (table === 'shares' && eventType === 'INSERT') {
    const platform = str(row.platform, 20) || 'share';
    const code = str(row.referrer_code, 16);
    return {
      id,
      kind: 'share',
      ...pickMeta('share'),
      label: `Share · ${platform}`,
      detail: code || 'link copied',
      at,
    };
  }

  if (table === 'prize_claims') {
    const status = str(row.status, 16) || 'updated';
    // Prod schema: referrer_code + cashtag/website (not prize_name/prize_id)
    const code = str(row.referrer_code, 16);
    const cashtag = str(row.cashtag, 20);
    const website = str(row.website, 28);
    const prizeLegacy = str(row.prize_name || row.prize_id, 24);
    const detail =
      [code, cashtag || website || prizeLegacy].filter(Boolean).join(' · ') || 'submitted';
    return {
      id,
      kind: 'claim',
      ...pickMeta('claim'),
      label: eventType === 'INSERT' ? 'Prize claim' : `Claim ${status}`,
      detail,
      at,
    };
  }

  if (table === 'visitor_events' && eventType === 'INSERT') {
    const step = str(row.event_name, 32) || 'event';
    const src = str(row.utm_source, 16);
    const refCode = str(row.ref_code, 16);
    const detailParts: string[] = [];
    if (refCode) detailParts.push(`ref:${refCode}`);
    else detailParts.push('direct');
    if (src) detailParts.push(src);
    const prefix = isViralLoopStep(step) ? 'Loop' : 'Funnel';
    return {
      id,
      kind: 'visitor',
      ...pickMeta('visitor'),
      label: `${prefix} · ${step}`,
      detail: detailParts.join(' · ') || 'visitor',
      funnelStep: step,
      refCode: refCode || undefined,
      at,
    };
  }

  if (table === 'banner_events' && eventType === 'INSERT') {
    const type = str(row.type || row.event_type, 12) || 'event';
    const label =
      str(row.label || row.banner_label, 20) || str(row.key || row.banner_key, 20) || 'banner';
    return {
      id,
      kind: 'banner',
      ...pickMeta('banner'),
      label: `Banner ${type}`,
      detail: label,
      at,
    };
  }

  if (table === 'site_content') {
    const key = str(row.key, 32) || 'content';
    const verb =
      eventType === 'DELETE' ? 'Removed' : eventType === 'INSERT' ? 'Added' : 'Updated';
    return {
      id,
      kind: 'content',
      ...pickMeta('content'),
      label: `${verb} content`,
      detail: key,
      at,
    };
  }

  return null;
}

function pickMeta(kind: AdminLiveEventKind): Pick<AdminLiveEvent, 'tab' | 'icon'> {
  const m = KIND_META[kind];
  return { tab: m.tab, icon: m.icon };
}

/** True for high-volume passive funnel/loop impressions hidden by default. */
export function isNoisyVisitorFunnelStep(step: string | undefined): boolean {
  const s = (step || '').trim();
  if (!s) return false;
  if (s.toLowerCase() === 'sitelanding' || s.toLowerCase() === 'landing') return true;
  return isPassiveViralLoopStep(s);
}

const TRAFFIC_SEGMENTS: AdminLiveTrafficSegment[] = ['all', 'referred', 'direct'];

export function normalizeAdminLiveFilters(
  raw: Partial<AdminLiveFeedFilters> | null | undefined,
): AdminLiveFeedFilters {
  const base = { ...DEFAULT_ADMIN_LIVE_FILTERS };
  if (!raw || typeof raw !== 'object') return base;
  for (const key of Object.keys(base) as (keyof AdminLiveFeedFilters)[]) {
    if (key === 'trafficSegment') continue;
    if (typeof raw[key] === 'boolean') base[key] = raw[key] as boolean;
  }
  const segment = raw.trafficSegment;
  if (typeof segment === 'string' && TRAFFIC_SEGMENTS.includes(segment as AdminLiveTrafficSegment)) {
    base.trafficSegment = segment as AdminLiveTrafficSegment;
  }
  return base;
}

/** True when event represents referred traffic (landing ref or credited signup). */
export function isAdminLiveReferredEvent(ev: AdminLiveEvent): boolean {
  if (ev.kind === 'referral') return true;
  return Boolean(ev.refCode?.trim());
}

/** Whether an event passes the referred / direct traffic segment filter. */
export function passesAdminLiveTrafficSegment(
  ev: AdminLiveEvent,
  segment: AdminLiveTrafficSegment,
): boolean {
  if (segment === 'all') return true;
  if (ev.kind === 'visitor') {
    const referred = isAdminLiveReferredEvent(ev);
    return segment === 'referred' ? referred : !referred;
  }
  if (ev.kind === 'referral') return segment === 'referred';
  return true;
}

/** Whether an event passes current admin live feed filters. */
export function shouldShowAdminLiveEvent(
  ev: AdminLiveEvent,
  filters: AdminLiveFeedFilters,
): boolean {
  if (!filters[ev.kind]) return false;
  if (!passesAdminLiveTrafficSegment(ev, filters.trafficSegment)) return false;
  if (
    ev.kind === 'visitor' &&
    !filters.showLandings &&
    isNoisyVisitorFunnelStep(ev.funnelStep)
  ) {
    return false;
  }
  return true;
}

export function filterAdminLiveFeed(
  events: readonly AdminLiveEvent[],
  filters: AdminLiveFeedFilters,
): AdminLiveEvent[] {
  return events.filter((ev) => shouldShowAdminLiveEvent(ev, filters));
}

export function toggleAdminLiveFilter(
  filters: AdminLiveFeedFilters,
  key: AdminLiveFilterToggle,
): AdminLiveFeedFilters {
  return { ...filters, [key]: !filters[key] };
}

export function setAdminLiveTrafficSegment(
  filters: AdminLiveFeedFilters,
  segment: AdminLiveTrafficSegment,
): AdminLiveFeedFilters {
  return { ...filters, trafficSegment: segment };
}

/** Build horizontal scrolling feed chips for the admin live hub strip. */
export function buildAdminLiveFeedHtml(
  events: readonly AdminLiveEvent[],
  now = Date.now(),
  emptyMessage = 'Waiting for live events…',
): string {
  if (!events.length) {
    return `<div class="admin-live-feed-empty text-[10px] text-zinc-500 py-1">${escapeHtml(emptyMessage)}</div>`;
  }

  return events
    .map((ev, i) => {
      const meta = KIND_META[ev.kind];
      const fresh = i === 0 ? ' admin-live-chip--fresh' : '';
      return `
        <div class="admin-live-chip flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900/80${fresh}" data-live-kind="${ev.kind}" title="${escapeHtml(ev.detail)}">
          <i class="fa-solid ${meta.icon} ${meta.color} text-[10px]" aria-hidden="true"></i>
          <span class="text-[10px] text-zinc-200 whitespace-nowrap">${escapeHtml(ev.label)}</span>
          <span class="text-[9px] text-zinc-500 font-mono whitespace-nowrap">${escapeHtml(ev.detail)}</span>
          <span class="text-[9px] text-zinc-600 tabular-nums">${formatAdminLiveTime(ev.at, now)}</span>
        </div>`;
    })
    .join('');
}

/** Whether a tab badge should pulse (unseen activity on inactive tab). */
export function shouldPulseTabBadge(tabIndex: number, activeTab: number, count: number): boolean {
  return count > 0 && tabIndex !== activeTab;
}

/** Content key updates that affect the Text Colors tab (tab 4). */
export function isTextColorsContentKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  if (!k) return false;
  return (
    k.includes('color') ||
    k.includes('theme') ||
    k === 'text_colors' ||
    k === 'text-colors' ||
    k.endsWith('_hex') ||
    k.endsWith('_colour')
  );
}

/** Tab index for a content key change (2 = Edit Content, 4 = Text Colors). */
export function contentChangeTabIndex(key: string): number {
  return isTextColorsContentKey(key) ? 4 : 2;
}

export function adminLiveScopeForTable(table: string): string | null {
  const map: Record<string, string> = {
    referrals: 'referral',
    shares: 'share',
    prize_claims: 'claim',
    visitor_events: 'visitor',
    banner_events: 'banner',
    site_content: 'content',
  };
  return map[table] ?? null;
}

/** Merge seed + live events, newest first, deduped by id, capped. */
export function mergeAdminLiveEvents(
  lists: readonly (readonly AdminLiveEvent[])[],
  max = 24,
): AdminLiveEvent[] {
  const seen = new Set<string>();
  const merged = lists
    .flat()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .filter((ev) => {
      if (seen.has(ev.id)) return false;
      seen.add(ev.id);
      return true;
    });
  return merged.slice(0, max);
}