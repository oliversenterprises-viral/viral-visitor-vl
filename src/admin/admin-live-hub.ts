/**
 * Unified admin live activity hub — cross-tab realtime feed, badges, and refresh dispatch.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { invokeAdminAction } from '../lib/admin-action-client';
import { showToast } from '../ui';
import { isTestReferralRecord } from '../lib/test-referral';
import { isTestVisitorFunnelEvent } from './visitor-funnel-stats-helpers';
import { isTestBannerEvent } from './banner-stats-test-helpers';
import {
  adminLiveScopeForTable,
  ADMIN_LIVE_FILTERS_STORAGE_KEY,
  buildAdminLiveFeedHtml,
  contentChangeTabIndex,
  DEFAULT_ADMIN_LIVE_FILTERS,
  filterAdminLiveFeed,
  mergeAdminLiveEvents,
  normalizeAdminLiveFilters,
  parseAdminLiveEvent,
  shouldShowAdminLiveEvent,
  setAdminLiveTrafficSegment,
  toggleAdminLiveFilter,
  type AdminLiveEvent,
  type AdminLiveFeedFilters,
  type AdminLiveFilterToggle,
  type AdminLiveTrafficSegment,
} from './admin-live-helpers';
import {
  maybePlayAdminLiveAlert,
  unlockAdminLiveSound,
  wireAdminLiveSoundControls,
} from './admin-live-sound';
import {
  fetchFunnelOffsiteNotifyStatus,
  funnelOffsiteNotifyStatusLabel,
} from './funnel-offsite-notify';

const MAX_FEED = 24;
const TOAST_COOLDOWN_MS = 2500;
/** Disk IO: admin live seed hits multiple tables — 45s is enough for live feel. */
const ADMIN_LIVE_POLL_MS = 45_000;

const feed: AdminLiveEvent[] = [];
const tabPulseCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const refreshListeners = new Map<string, Set<() => void>>();

let hubChannel: ReturnType<typeof supabase.channel> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let activeTab = 0;
let lastToastAt = 0;
let feedPaused = false;
let hubRunning = false;

let feedFilters: AdminLiveFeedFilters = { ...DEFAULT_ADMIN_LIVE_FILTERS };

function isAdminOpen(): boolean {
  const modal = document.getElementById('admin-modal');
  return Boolean(modal && !modal.classList.contains('hidden'));
}

function shouldSkipFeedEvent(table: string, row: Record<string, unknown>): boolean {
  if (table === 'referrals' && isTestReferralRecord(row)) return true;
  if (table === 'visitor_events' && isTestVisitorFunnelEvent(row)) return true;
  if (table === 'banner_events' && isTestBannerEvent(row)) return true;
  return false;
}

function loadFeedFilters(): AdminLiveFeedFilters {
  try {
    const raw = localStorage.getItem(ADMIN_LIVE_FILTERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ADMIN_LIVE_FILTERS };
    return normalizeAdminLiveFilters(JSON.parse(raw) as Partial<AdminLiveFeedFilters>);
  } catch {
    return { ...DEFAULT_ADMIN_LIVE_FILTERS };
  }
}

function saveFeedFilters(): void {
  try {
    localStorage.setItem(ADMIN_LIVE_FILTERS_STORAGE_KEY, JSON.stringify(feedFilters));
  } catch {
    /* storage unavailable */
  }
}

async function syncOffsiteNotifyStatus(): Promise<void> {
  const el = document.getElementById('admin-live-offsite-status');
  if (!el) return;
  const status = await fetchFunnelOffsiteNotifyStatus();
  el.textContent = funnelOffsiteNotifyStatusLabel(status);
  el.classList.toggle('admin-live-offsite-status--on', Boolean(status?.enabled));
}

function syncFilterChips(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-live-filter]').forEach((btn) => {
    const key = btn.dataset.liveFilter as AdminLiveFilterToggle | undefined;
    if (!key || !(key in feedFilters)) return;
    btn.classList.toggle('admin-live-filter-chip--on', feedFilters[key]);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-live-segment]').forEach((btn) => {
    const segment = btn.dataset.liveSegment as AdminLiveTrafficSegment | undefined;
    if (!segment) return;
    btn.classList.toggle('admin-live-filter-chip--on', feedFilters.trafficSegment === segment);
  });
}

function renderFeed(): void {
  const el = document.getElementById('admin-live-feed');
  if (!el) return;
  const visible = filterAdminLiveFeed(feed, feedFilters);
  const emptyMessage =
    feed.length > 0 && visible.length === 0
      ? 'No events match filters — try enabling a category'
      : 'Waiting for live events…';
  el.innerHTML = buildAdminLiveFeedHtml(visible, Date.now(), emptyMessage);
  const countEl = document.getElementById('admin-live-count');
  if (countEl) {
    if (!visible.length) {
      countEl.textContent = feed.length ? `${feed.length} hidden` : '';
    } else if (visible.length < feed.length) {
      countEl.textContent = `${visible.length} shown · ${feed.length} total`;
    } else {
      countEl.textContent = `${visible.length} recent`;
    }
  }
}

function liveTabBadgeId(tab: number): string {
  return tab === 3 ? 'tab-3-live-badge' : `tab-${tab}-badge`;
}

function updateTabBadge(tab: number): void {
  const badge = document.getElementById(liveTabBadgeId(tab));
  if (!badge) return;
  const count = tabPulseCounts[tab] || 0;
  if (count > 0 && tab !== activeTab) {
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.classList.remove('hidden');
    badge.classList.add('admin-tab-badge--pulse');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('admin-tab-badge--pulse');
  }
}

function bumpTabBadge(tab: number): void {
  if (tab === activeTab) return;
  tabPulseCounts[tab] = (tabPulseCounts[tab] || 0) + 1;
  updateTabBadge(tab);
}

export function clearAdminTabBadge(tab: number): void {
  tabPulseCounts[tab] = 0;
  updateTabBadge(tab);
}

export function setAdminLiveActiveTab(tab: number): void {
  activeTab = tab;
  clearAdminTabBadge(tab);
}

function dispatchRefresh(scope: string): void {
  const handlers = refreshListeners.get(scope);
  if (!handlers) return;
  for (const fn of handlers) {
    try {
      fn();
    } catch {
      /* listener failed — don't break hub */
    }
  }
}

function maybeToast(ev: AdminLiveEvent): void {
  if (!isAdminOpen() || feedPaused || !shouldShowAdminLiveEvent(ev, feedFilters)) return;
  const now = Date.now();
  if (now - lastToastAt < TOAST_COOLDOWN_MS) return;
  if (ev.tab === activeTab) return;
  lastToastAt = now;
  showToast(`${ev.label}: ${ev.detail}`, 'info');
}

function pushEvent(ev: AdminLiveEvent): void {
  if (feedPaused) return;
  feed.unshift(ev);
  if (feed.length > MAX_FEED) feed.length = MAX_FEED;
  renderFeed();
  bumpTabBadge(ev.tab);
  maybeToast(ev);
}

function handlePayload(table: string, eventType: string, row: Record<string, unknown> | null): void {
  if (!row || shouldSkipFeedEvent(table, row)) return;

  let ev = parseAdminLiveEvent(table, eventType, row);
  if (!ev) return;

  if (table === 'site_content') {
    const key = String(row.key || '').trim();
    ev = { ...ev, tab: contentChangeTabIndex(key) };
  }

  pushEvent(ev);
  maybePlayAdminLiveAlert(ev, feedFilters, eventType);

  const scope = adminLiveScopeForTable(table);
  if (scope) dispatchRefresh(scope);
  if (table === 'site_content' && String(row.key || '').trim() === 'optimizer_flags') {
    dispatchRefresh('optimizer');
  }
}

function setLiveStatus(
  subscribed: boolean,
  channelStatus?: string,
  channelError?: Error,
): void {
  const status = document.getElementById('admin-live-status');
  const hub = document.getElementById('admin-live-hub');
  const statusText = document.getElementById('admin-live-status-text');
  if (status) status.classList.toggle('hidden', !subscribed);
  if (hub) hub.classList.toggle('admin-live-hub--connected', subscribed);
  if (statusText) {
    if (subscribed) {
      statusText.textContent = '';
      statusText.classList.add('hidden');
    } else if (channelStatus === 'CHANNEL_ERROR' || channelError) {
      statusText.textContent = 'Live polling active';
      statusText.classList.remove('hidden');
    } else if (channelStatus === 'TIMED_OUT') {
      statusText.textContent = 'Connecting…';
      statusText.classList.remove('hidden');
    } else {
      statusText.textContent = 'Connecting…';
      statusText.classList.remove('hidden');
    }
  }
  refreshAdminLiveIndicators();
}

type AdminLiveSeed = {
  referrals?: Record<string, unknown>[];
  shares?: Record<string, unknown>[];
  prize_claims?: Record<string, unknown>[];
  visitor_events?: Record<string, unknown>[];
  banner_events?: Record<string, unknown>[];
  site_content?: Record<string, unknown>[];
};

function seedEventsFromRows(
  table: string,
  eventType: string,
  rows: readonly Record<string, unknown>[],
): AdminLiveEvent[] {
  const seeded: AdminLiveEvent[] = [];
  for (const row of rows) {
    if (shouldSkipFeedEvent(table, row)) continue;
    let ev = parseAdminLiveEvent(table, eventType, row);
    if (!ev) continue;
    if (table === 'site_content') {
      ev = { ...ev, tab: contentChangeTabIndex(String(row.key || '')) };
    }
    seeded.push(ev);
  }
  return seeded;
}

async function seedAdminLiveFeed(): Promise<void> {
  const result = await invokeAdminAction<AdminLiveSeed>('get_admin_live_seed');
  if (!result.success) {
    if (feed.length === 0) {
      const el = document.getElementById('admin-live-feed');
      if (el) {
        const msg = result.error?.includes('Admin session')
          ? 'Sign in to load live activity — polling every 45s'
          : `Live seed unavailable (${result.error || 'error'}) — retrying…`;
        el.innerHTML = buildAdminLiveFeedHtml([], Date.now(), msg);
      }
    }
    return;
  }

  const data = result.data || {};
  const seeded = [
    ...seedEventsFromRows('referrals', 'INSERT', data.referrals || []),
    ...seedEventsFromRows('shares', 'INSERT', data.shares || []),
    ...seedEventsFromRows('prize_claims', 'INSERT', data.prize_claims || []),
    ...seedEventsFromRows('visitor_events', 'INSERT', data.visitor_events || []),
    ...seedEventsFromRows('banner_events', 'INSERT', data.banner_events || []),
    ...seedEventsFromRows('site_content', 'UPDATE', data.site_content || []),
  ];

  if (!seeded.length) {
    if (feed.length === 0) {
      const el = document.getElementById('admin-live-feed');
      if (el) {
        el.innerHTML = buildAdminLiveFeedHtml(
          [],
          Date.now(),
          'No recent activity yet — waiting for live events…',
        );
      }
    }
    return;
  }
  feed.length = 0;
  feed.push(...mergeAdminLiveEvents([seeded], MAX_FEED));
  renderFeed();
}

/**
 * Poll refresh scopes — do NOT include `content`.
 * Full Edit Content re-render was wiping Site Visitor Funnel mid-fetch every 20s
 * ("Could not load visitor stats"). Content updates still arrive via realtime payload.
 */
function dispatchAdminLiveRefreshScopes(): void {
  for (const scope of ['referral', 'share', 'claim', 'visitor', 'banner', 'optimizer']) {
    dispatchRefresh(scope);
  }
}

async function pollAdminLiveFeed(): Promise<void> {
  if (!hubRunning || !isAdminOpen()) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  await seedAdminLiveFeed();
  dispatchAdminLiveRefreshScopes();
}

function startAdminLivePolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void pollAdminLiveFeed();
  }, ADMIN_LIVE_POLL_MS);
}

function stopAdminLivePolling(): void {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

/** Re-apply live dot visibility after tab panels re-render their HTML. */
export function refreshAdminLiveIndicators(): void {
  const show = hubRunning;
  for (const id of ['visitor-live-indicator', 'banner-live-indicator', 'content-live-indicator']) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !show);
  }
}

function wireHubControls(): void {
  const pauseBtn = document.getElementById('admin-live-pause-btn');
  if (!pauseBtn || pauseBtn.dataset.vrWired === '1') return;
  pauseBtn.dataset.vrWired = '1';
  pauseBtn.addEventListener('click', () => {
    feedPaused = !feedPaused;
    pauseBtn.textContent = feedPaused ? 'Resume feed' : 'Pause feed';
    if (!feedPaused) renderFeed();
  });

  const filtersEl = document.getElementById('admin-live-filters');
  if (filtersEl && filtersEl.dataset.vrWired !== '1') {
    filtersEl.dataset.vrWired = '1';
    filtersEl.addEventListener('click', (e) => {
      const segmentBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-live-segment]');
      if (segmentBtn?.dataset.liveSegment) {
        const segment = segmentBtn.dataset.liveSegment as AdminLiveTrafficSegment;
        if (segment === feedFilters.trafficSegment) return;
        feedFilters = setAdminLiveTrafficSegment(feedFilters, segment);
        saveFeedFilters();
        syncFilterChips();
        renderFeed();
        return;
      }
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-live-filter]');
      if (!btn?.dataset.liveFilter) return;
      const key = btn.dataset.liveFilter as AdminLiveFilterToggle;
      if (!(key in feedFilters)) return;
      feedFilters = toggleAdminLiveFilter(feedFilters, key);
      saveFeedFilters();
      syncFilterChips();
      renderFeed();
    });
  }
}

/** Register a silent refresh handler for a live scope (visitor, banner, content, etc.). */
export function registerAdminLiveRefresh(scope: string, handler: () => void): () => void {
  if (!refreshListeners.has(scope)) refreshListeners.set(scope, new Set());
  refreshListeners.get(scope)!.add(handler);
  return () => {
    refreshListeners.get(scope)?.delete(handler);
  };
}

export function startAdminLiveHub(): void {
  if (!isSupabaseConfigured || import.meta.env.MODE === 'test') return;
  if (hubRunning) return;

  hubRunning = true;
  feedPaused = false;
  feedFilters = loadFeedFilters();
  feed.length = 0;
  for (const k of Object.keys(tabPulseCounts)) tabPulseCounts[Number(k)] = 0;
  for (let t = 0; t <= 5; t++) updateTabBadge(t);

  const hub = document.getElementById('admin-live-hub');
  if (hub) hub.classList.remove('hidden');
  wireHubControls();
  wireAdminLiveSoundControls();
  void unlockAdminLiveSound();
  syncFilterChips();
  void syncOffsiteNotifyStatus();
  renderFeed();

  if (hubChannel) {
    try {
      hubChannel.unsubscribe();
    } catch {
      /* already closed */
    }
    hubChannel = null;
  }

  hubChannel = supabase.channel('admin-live-hub');

  const onChange = (table: string) => (payload: { eventType: string; new: unknown; old: unknown }) => {
    if (!isAdminOpen()) return;
    const row = (payload.new || payload.old) as Record<string, unknown> | null;
    handlePayload(table, payload.eventType, row);
  };

  hubChannel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'site_content' },
    onChange('site_content'),
  );

  hubChannel.subscribe((status, err) => {
    const realtime = status === 'SUBSCRIBED';
    setLiveStatus(realtime, status, err);
    if (realtime || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      void seedAdminLiveFeed();
    }
  });

  startAdminLivePolling();
}

export function stopAdminLiveHub(): void {
  hubRunning = false;
  feed.length = 0;
  stopAdminLivePolling();

  if (hubChannel) {
    try {
      hubChannel.unsubscribe();
    } catch {
      /* already closed */
    }
    hubChannel = null;
  }

  setLiveStatus(false);
  const hub = document.getElementById('admin-live-hub');
  if (hub) hub.classList.add('hidden');
}