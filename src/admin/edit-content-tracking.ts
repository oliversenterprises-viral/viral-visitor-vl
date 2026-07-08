/**
 * Unified Edit Content tracking hub — wraps visitor funnel + banner performance panels.
 */

import { escapeHtml } from '../content';
import { showToast } from '../ui';
import { refreshEditContentStatsPanels } from './edit-content-clear-test';
import { withAdminStatsReadOnlyRefresh } from '../lib/admin-stats-refresh-guard';
import {
  buildTrackingRangeSelectHtml,
  getTrackingHubSummary,
  loadTrackingTimeRange,
  onTrackingHubSummaryChange,
  parseTrackingTimeRange,
  setTrackingTimeRange,
  type TrackingHubSummary,
} from './edit-content-tracking-helpers';

export {
  getTrackingTimeRange,
  loadTrackingTimeRange,
  reportTrackingHubSummary,
} from './edit-content-tracking-helpers';

const COLLAPSE_KEYS = {
  visitor: 'vr_admin_tracking_collapsed_visitor',
  banner: 'vr_admin_tracking_collapsed_banner',
} as const;

function isSectionCollapsed(section: 'visitor' | 'banner'): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEYS[section]) === '1';
  } catch {
    return false;
  }
}

function setSectionCollapsed(section: 'visitor' | 'banner', collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEYS[section], collapsed ? '1' : '0');
  } catch {
    /* non-fatal */
  }
}

function sourceBadge(source: 'server' | 'local'): string {
  return source === 'server'
    ? '<span class="px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[7px]">SERVER</span>'
    : '<span class="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[7px]">LOCAL</span>';
}

function buildHubHeaderHtml(summary: TrackingHubSummary | null = getTrackingHubSummary()): string {
  const rangeLabel =
    summary?.range === 'all'
      ? 'All time'
      : (summary?.range.toUpperCase() ?? loadTrackingTimeRange().toUpperCase());

  const kpi = summary
    ? `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
        <div class="rounded-lg bg-violet-950/40 border border-violet-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Landings</div>
          <div class="text-sm font-bold text-white tabular-nums">${summary.landings}</div>
        </div>
        <div class="rounded-lg bg-violet-950/40 border border-violet-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Sessions</div>
          <div class="text-sm font-bold text-violet-200 tabular-nums">${summary.sessions}</div>
        </div>
        <div class="rounded-lg bg-violet-950/40 border border-violet-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Claim conv.</div>
          <div class="text-sm font-bold text-emerald-300 tabular-nums">${summary.claimConversion}</div>
        </div>
        <div class="rounded-lg bg-emerald-950/40 border border-emerald-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Banner imps</div>
          <div class="text-sm font-bold text-white tabular-nums">${summary.bannerImpressions}</div>
        </div>
        <div class="rounded-lg bg-emerald-950/40 border border-emerald-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Banner CTR</div>
          <div class="text-sm font-bold text-emerald-300 tabular-nums">${summary.bannerCtr}</div>
        </div>
      </div>
      <div class="text-[8px] text-zinc-500 mt-1.5">
        Funnel ${sourceBadge(summary.visitorSource)} ${summary.visitorEvents} events ·
        Banner ${sourceBadge(summary.bannerSource)} ${summary.bannerEvents} events · ${escapeHtml(rangeLabel)}
      </div>`
    : `<div class="text-[9px] text-zinc-500 mt-2">Loading tracking summary…</div>`;

  return `
    <div id="tracking-hub-header" class="mb-3 pb-3 border-b border-white/10">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="text-xs font-semibold text-zinc-100">Site Analytics</div>
          <div class="text-[9px] text-zinc-500">Visitor funnel + banner performance (live server data when admin secret is set)</div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${buildTrackingRangeSelectHtml(loadTrackingTimeRange())}
          <button type="button" data-tracking-refresh-all
            class="text-[9px] px-2 py-0.5 bg-violet-600/80 hover:bg-violet-600 text-white rounded disabled:opacity-50">
            ↻ Refresh all
          </button>
        </div>
      </div>
      ${kpi}
    </div>`;
}

function applySectionCollapse(hub: HTMLElement): void {
  for (const section of ['visitor', 'banner'] as const) {
    const panel = hub.querySelector(`[data-tracking-section="${section}"]`) as HTMLElement | null;
    const toggle = hub.querySelector(`[data-tracking-collapse="${section}"]`) as HTMLButtonElement | null;
    if (!panel || !toggle) continue;
    const collapsed = isSectionCollapsed(section);
    panel.classList.toggle('hidden', collapsed);
    toggle.textContent = collapsed ? 'Show' : 'Hide';
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }
}

function renderHubChrome(hub: HTMLElement): void {
  const headerSlot = hub.querySelector('#tracking-hub-header-slot');
  if (headerSlot) {
    headerSlot.innerHTML = buildHubHeaderHtml();
  }
  applySectionCollapse(hub);
}

function bindHubControls(hub: HTMLElement): void {
  if (hub.dataset.trackingHubBound === '1') return;
  hub.dataset.trackingHubBound = '1';

  hub.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const refreshAll = target.closest('[data-tracking-refresh-all]');
    const collapseBtn = target.closest('[data-tracking-collapse]');

    if (refreshAll && hub.contains(refreshAll)) {
      e.preventDefault();
      const btn = refreshAll as HTMLButtonElement;
      const original = btn.textContent || '↻ Refresh all';
      btn.disabled = true;
      btn.textContent = '↻ Refreshing…';
      void (async () => {
        try {
          await withAdminStatsReadOnlyRefresh(async () => {
            await refreshEditContentStatsPanels(hub);
          });
          showToast('All tracking stats refreshed', 'success');
        } catch {
          showToast('Could not refresh tracking stats', 'info');
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
      })();
      return;
    }

    if (collapseBtn && hub.contains(collapseBtn)) {
      e.preventDefault();
      const section = (collapseBtn as HTMLElement).dataset.trackingCollapse as 'visitor' | 'banner' | undefined;
      if (!section) return;
      const next = !isSectionCollapsed(section);
      setSectionCollapsed(section, next);
      applySectionCollapse(hub);
    }
  });

  hub.addEventListener('change', (e) => {
    const select = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-tracking-time-range]');
    if (!select || !hub.contains(select)) return;
    const range = parseTrackingTimeRange(select.value);
    setTrackingTimeRange(range);
    void withAdminStatsReadOnlyRefresh(async () => {
      await refreshEditContentStatsPanels(hub);
    });
  });
}

/** Mount hub chrome and wire unified controls on the Edit Content root. */
export function wireEditContentTrackingHub(root: HTMLElement): void {
  const hub = root.querySelector('[data-vr-tracking-hub]') as HTMLElement | null;
  if (!hub) return;
  loadTrackingTimeRange();
  bindHubControls(hub);
  onTrackingHubSummaryChange(() => renderHubChrome(hub));
  renderHubChrome(hub);
}

export function buildTrackingHubShellHtml(): string {
  const visitorCollapsed = isSectionCollapsed('visitor');
  const bannerCollapsed = isSectionCollapsed('banner');
  return `
    <div data-vr-tracking-hub="1" class="mb-4 p-3 border border-zinc-600/40 bg-zinc-950/60 rounded-2xl">
      <div id="tracking-hub-header-slot"></div>
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="text-[10px] font-semibold text-violet-300">Site Visitor Funnel</div>
        <button type="button" data-tracking-collapse="visitor" aria-expanded="${visitorCollapsed ? 'false' : 'true'}"
          class="text-[8px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-300 rounded">${visitorCollapsed ? 'Show' : 'Hide'}</button>
      </div>
      <div id="visitor-stats-quick" data-tracking-section="visitor"
        class="${visitorCollapsed ? 'hidden ' : ''}mb-3 p-3 border border-violet-500/30 bg-zinc-900/50 rounded-2xl"></div>
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="text-[10px] font-semibold text-emerald-400">Banner Performance</div>
        <button type="button" data-tracking-collapse="banner" aria-expanded="${bannerCollapsed ? 'false' : 'true'}"
          class="text-[8px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-300 rounded">${bannerCollapsed ? 'Show' : 'Hide'}</button>
      </div>
      <div id="banner-stats-quick" data-tracking-section="banner"
        class="${bannerCollapsed ? 'hidden ' : ''}p-3 border border-emerald-500/30 bg-zinc-900/50 rounded-2xl"></div>
    </div>`;
}