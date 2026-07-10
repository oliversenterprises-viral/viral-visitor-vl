/**
 * Premium banner quick-stats panel (admin audit).
 * Production-safe: never throws out of the panel; server fetch is isolated from content.ts.
 */
import {
  clearBannerEvents,
  computeBannerStats,
  getLocalBannerEvents,
} from '../lib/banner-events';
import { fetchBannerStatsEvents } from '../lib/banner-stats-fetch';
import { escapeHtml } from '../lib/escape-html';
import {
  eventTimestamp,
  formatEventTimestampLabel,
  latestEventTimestamp,
} from '../lib/stats-helpers';
import { showToast } from '../ui';
import {
  buildAutorefreshSelectHtml,
  wireAdminStatsAutorefresh,
} from '../lib/admin-stats-autorefresh';
import { buildAutoClearTestSelectHtml } from '../lib/admin-stats-auto-clear-test';
import {
  resolveEditContentRoot,
  runClearTestAdminStatsForEditContent,
} from './edit-content-clear-test';
import { withAdminStatsReadOnlyRefresh } from '../lib/admin-stats-refresh-guard';
import {
  type BannerStatRow,
  type BannerSortKey,
  computeBannerTotals,
  filterBannerRowsBySearch,
  findTopPerformer,
  formatBannerCtr,
  sortBannerRows,
} from './banner-stats-helpers';
import { countTestBannerEvents, filterTestBannerEvents } from './banner-stats-test-helpers';
import {
  filterEventsByTrackingRange,
  getTrackingTimeRange,
  reportTrackingHubSummary,
} from './edit-content-tracking-helpers';

import { registerAdminLiveRefresh, refreshAdminLiveIndicators } from './admin-live-hub';

let unregisterBannerLive: (() => void) | null = null;

let currentBannerSearch = '';
let currentBannerSort: BannerSortKey = 'impressions';

const BANNER_AUTOREFRESH_KEY = 'vr_admin_autorefresh_banner_ms';

async function silentRefreshBannerStats(container: HTMLElement): Promise<void> {
  await withAdminStatsReadOnlyRefresh(async () => {
    await renderBannerStats(container);
  });
}

function wireBannerAutorefresh(container: HTMLElement): void {
  wireAdminStatsAutorefresh(
    container,
    BANNER_AUTOREFRESH_KEY,
    'data-banner-stats-autorefresh',
    () => silentRefreshBannerStats(container),
  );
}

const BANNER_STATS_SKELETON = `
  <div class="space-y-2 py-1">
    <div class="h-4 w-48 skeleton rounded"></div>
    <div class="h-3 w-full skeleton rounded"></div>
    <div class="h-16 skeleton rounded"></div>
  </div>
`;

function bindBannerStatsActions(container: HTMLElement) {
  if (container.dataset.bannerRefreshBound === '1') return;
  container.dataset.bannerRefreshBound = '1';

  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const refreshBtn = target.closest('button[data-banner-stats-refresh]');
    const clearBtn = target.closest('button[data-banner-stats-clear]');
    const clearTestBtn = target.closest('button[data-banner-stats-clear-test]');
    const copyBtn = target.closest('button[data-banner-stats-copy]');
    const csvBtn = target.closest('button[data-banner-stats-csv]');
    const sortBtn = target.closest('[data-banner-sort]');
    const clearSearchBtn = target.closest('[data-banner-search-clear]');

    if (!container.contains(refreshBtn || clearBtn || clearTestBtn || copyBtn || csvBtn || sortBtn || clearSearchBtn)) {
      return;
    }

    if (clearTestBtn) {
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        const button = clearTestBtn as HTMLButtonElement;
        const original = button.textContent || 'Clear test events';
        if (
          !window.confirm(
            'Remove owner/smoke test rows from visitor funnel AND banner stats in the database? Real visitor data is kept.',
          )
        ) {
          return;
        }
        button.disabled = true;
        button.textContent = 'Clearing…';
        try {
          const root = resolveEditContentRoot(container);
          if (!root) throw new Error('Edit content root not found');
          await runClearTestAdminStatsForEditContent(root, { toastWhenEmpty: true });
        } catch {
          showToast('Could not clear test admin stats', 'info');
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      })();
      return;
    }

    if (refreshBtn) {
      e.preventDefault();
      e.stopPropagation();
      void refreshBannerStats(container, refreshBtn as HTMLButtonElement);
      return;
    }
    if (clearBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('Clear all local banner events?')) return;
      clearBannerEvents();
      void renderBannerStats(container);
      showToast('Local banner stats cleared', 'info');
      return;
    }
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const payload = container.dataset.bannerStatsCopy;
      if (payload) {
        navigator.clipboard.writeText(payload).then(() => showToast('Copied banner stats JSON', 'success'));
      }
      return;
    }
    if (csvBtn) {
      e.preventDefault();
      e.stopPropagation();
      const csv = container.dataset.bannerCsvPayload;
      if (!csv) {
        showToast('No banner data to export', 'info');
        return;
      }
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `viralrefer-banner-stats-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Banner stats CSV downloaded', 'success');
      return;
    }
    if (sortBtn) {
      e.preventDefault();
      e.stopPropagation();
      currentBannerSort = ((sortBtn as HTMLElement).dataset.bannerSort || 'impressions') as BannerSortKey;
      void rerenderFromContainerState(container);
      return;
    }
    if (clearSearchBtn) {
      e.preventDefault();
      e.stopPropagation();
      currentBannerSearch = '';
      void rerenderFromContainerState(container);
    }
  });

  container.addEventListener('input', (e) => {
    const input = (e.target as HTMLElement).closest('#banner-stats-search');
    if (!input || !container.contains(input)) return;
    currentBannerSearch = (input as HTMLInputElement).value;
    clearTimeout((container as any)._bannerSearchTimer);
    (container as any)._bannerSearchTimer = window.setTimeout(() => {
      void rerenderFromContainerState(container);
    }, 200);
  });
}

async function rerenderFromContainerState(container: HTMLElement) {
  const eventsJson = container.dataset.bannerStatsEvents;
  const source = (container.dataset.bannerStatsSource || 'local') as 'server' | 'local';
  const fetchError = container.dataset.bannerStatsFetchError;
  if (!eventsJson) return;
  try {
    const events = JSON.parse(eventsJson);
    renderBannerStatsView(container, events, source, fetchError || undefined);
  } catch {
    await renderBannerStats(container);
  }
}

async function refreshBannerStats(
  container: HTMLElement,
  btn?: HTMLButtonElement,
  options: { silent?: boolean } = {},
) {
  // Re-query after render — innerHTML rebuilds buttons, so the clicked node may be detached.
  const labelBtn = () =>
    (container.querySelector('[data-banner-stats-refresh]') as HTMLButtonElement | null) || btn || null;
  let refreshBtn = labelBtn();
  const originalLabel = refreshBtn?.textContent || '↻ Refresh';
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '↻ Refreshing…';
  }
  try {
    await withAdminStatsReadOnlyRefresh(async () => {
      await renderBannerStats(container);
    });
    if (!options.silent) {
      showToast('Banner stats refreshed', 'success');
    }
  } catch (err) {
    console.error('[banner-stats] refresh failed', err);
    if (!options.silent) {
      showToast('Could not refresh banner stats', 'info');
    }
  } finally {
    refreshBtn = labelBtn();
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = originalLabel;
    }
  }
}

function buildCsv(rows: readonly BannerStatRow[]): string {
  const headers = ['label', 'redirect_url', 'impressions', 'clicks', 'ctr'];
  const lines = rows.map((r) =>
    [
      `"${r.label.replace(/"/g, '""')}"`,
      `"${r.redirectUrl.replace(/"/g, '""')}"`,
      r.impressions,
      r.clicks,
      formatBannerCtr(r.impressions, r.clicks),
    ].join(','),
  );
  return [headers.join(','), ...lines].join('\n');
}

function renderBannerStatsView(
  container: HTMLElement,
  events: Array<Record<string, unknown>>,
  source: 'server' | 'local',
  fetchError?: string,
) {
  container.classList.add('banner-stats-panel');
  const safeEvents = Array.isArray(events) ? events : [];

  let excludedCount = 0;
  let visibleEvents: Array<Record<string, unknown>> = safeEvents;
  let rangeFiltered: Array<Record<string, unknown>> = safeEvents;
  let stats = computeBannerStats([]);
  let rows: BannerStatRow[] = [];
  let filtered: BannerStatRow[] = [];
  let sorted: BannerStatRow[] = [];
  let totals = computeBannerTotals([]);
  let topPerformer: BannerStatRow | null = null;
  let effectiveSource = source;
  let effectiveError = fetchError;

  try {
    excludedCount = countTestBannerEvents(safeEvents);
    visibleEvents = filterTestBannerEvents(safeEvents);
    rangeFiltered = filterEventsByTrackingRange(visibleEvents, getTrackingTimeRange());
    stats = computeBannerStats(rangeFiltered);
    rows = stats.perBanner as BannerStatRow[];
    filtered = filterBannerRowsBySearch(rows, currentBannerSearch);
    sorted = sortBannerRows(filtered, currentBannerSort);
    totals = computeBannerTotals(sorted);
    topPerformer = findTopPerformer(sorted, 3);
  } catch (err) {
    console.error('[banner-stats] compute failed', err);
    effectiveError =
      effectiveError || (err instanceof Error ? err.message : 'Stats compute failed');
    effectiveSource = source === 'server' ? 'server' : 'local';
  }

  container.dataset.bannerStatsEvents = JSON.stringify(visibleEvents);
  container.dataset.bannerStatsSource = effectiveSource;
  if (effectiveError) container.dataset.bannerStatsFetchError = effectiveError;
  else delete container.dataset.bannerStatsFetchError;

  const currentBanners = (window as unknown as { __currentBannersForStats?: Array<Record<string, unknown>> })
    .__currentBannersForStats || [];
  const currentKeys = new Set(
    currentBanners.map((b) => {
      const lab = String(b.label || '').trim();
      const u = String(b.redirectUrl || '').trim();
      return lab && u ? `${lab}|${u}` : u || lab || '';
    }),
  );

  const isServer = effectiveSource === 'server';
  const sourceBadge = isServer
    ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[8px]">SERVER</span>'
    : '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[8px]">LOCAL</span>';
  const refreshedAt = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const latestTs = latestEventTimestamp(rangeFiltered);
  const latestLabel = latestTs ? formatEventTimestampLabel(latestTs) : '';
  const rangeNote =
    getTrackingTimeRange() === 'all'
      ? ''
      : ` · Range ${getTrackingTimeRange().toUpperCase()} (${rangeFiltered.length} events)`;

  try {
    reportTrackingHubSummary({
      bannerImpressions: totals.impressions,
      bannerClicks: totals.clicks,
      bannerCtr: totals.ctr,
      bannerSource: effectiveSource,
      bannerEvents: rangeFiltered.length,
    });
  } catch {
    /* KPI strip must never break this panel */
  }

  const copyPayload = JSON.stringify(
    {
      generated: new Date().toISOString(),
      source: effectiveSource,
      totals,
      stats: sorted,
      rawEvents: stats.lastEvents,
    },
    null,
    2,
  );
  container.dataset.bannerStatsCopy = copyPayload;
  container.dataset.bannerCsvPayload = buildCsv(sorted);

  const sortChip = (key: BannerSortKey, label: string) => {
    const active = currentBannerSort === key;
    return `<button type="button" data-banner-sort="${key}" class="px-2 py-0.5 text-[8px] rounded-full border ${
      active ? 'bg-violet-600 border-violet-500 text-white' : 'border-white/20 text-zinc-400 hover:bg-white/10'
    }">${label}</button>`;
  };

  let html = `
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <div class="text-[10px] font-semibold text-emerald-400">Banner Performance</div>
      ${sourceBadge}
      <span id="banner-live-indicator" class="hidden text-[9px] text-emerald-400/90"><i class="fa-solid fa-circle text-[5px] mr-0.5"></i>live</span>
      <span class="text-[9px] text-zinc-500">Updated ${refreshedAt}${latestLabel ? ` · Latest event ${escapeHtml(latestLabel)}` : ''}${rangeNote} · ${stats.total} events${isServer ? ' (latest 2k)' : ''}</span>
    </div>
  `;

  if (excludedCount > 0) {
    html += `<div class="text-[9px] text-zinc-500 mb-2">Filtered ${excludedCount} owner/smoke/test banner event${excludedCount === 1 ? '' : 's'} from this view.</div>`;
  }

  if (effectiveError && !isServer) {
    html += `<div class="text-[9px] text-amber-400/90 mb-2">Server unavailable (${escapeHtml(effectiveError)}) — showing local data.</div>`;
  }

  html += `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
        <div class="text-[8px] text-zinc-500 uppercase">Impressions</div>
        <div class="text-lg font-bold text-white tabular-nums">${totals.impressions}</div>
      </div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
        <div class="text-[8px] text-zinc-500 uppercase">Clicks</div>
        <div class="text-lg font-bold text-emerald-400 tabular-nums">${totals.clicks}</div>
      </div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
        <div class="text-[8px] text-zinc-500 uppercase">Overall CTR</div>
        <div class="text-lg font-bold text-violet-300 tabular-nums">${totals.ctr}</div>
      </div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
        <div class="text-[8px] text-zinc-500 uppercase">Banners tracked</div>
        <div class="text-lg font-bold text-white tabular-nums">${sorted.length}</div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 mb-2">
      <button type="button" data-banner-stats-refresh class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded disabled:opacity-50">↻ Refresh</button>
      ${buildAutorefreshSelectHtml('data-banner-stats-autorefresh', BANNER_AUTOREFRESH_KEY)}
      <button type="button" data-banner-stats-clear-test title="Deletes owner IP and smoke automation rows from visitor_events and banner_events"
        class="text-[9px] px-2 py-0.5 bg-amber-600/80 hover:bg-amber-600 text-white rounded disabled:opacity-50">Clear test events${excludedCount > 0 ? ` (${excludedCount})` : ''}</button>
      ${buildAutoClearTestSelectHtml()}
      <button type="button" data-banner-stats-clear class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">🗑 Clear Local</button>
      <button type="button" data-banner-stats-copy class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">⎘ Copy JSON</button>
      <button type="button" data-banner-stats-csv class="text-[9px] px-2 py-0.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded">⬇ CSV</button>
    </div>

    <div class="flex flex-wrap items-center gap-2 mb-2">
      <div class="relative flex-1 min-w-[140px]">
        <input id="banner-stats-search" type="search" value="${escapeHtml(currentBannerSearch)}" placeholder="Filter banners..."
               class="w-full bg-zinc-900/80 border border-white/10 rounded-lg px-2 py-1 text-[9px] focus:border-emerald-500/50" />
        ${currentBannerSearch ? '<button type="button" data-banner-search-clear class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-[8px]">✕</button>' : ''}
      </div>
      <div class="flex gap-1">${sortChip('impressions', 'By imps')}${sortChip('clicks', 'By clicks')}${sortChip('ctr', 'By CTR')}</div>
    </div>
  `;

  if (topPerformer) {
    html += `<div class="text-[9px] text-emerald-300/90 mb-2"><i class="fa-solid fa-trophy text-[8px] mr-1"></i>Top performer: <strong>${escapeHtml(topPerformer.label)}</strong> (${formatBannerCtr(topPerformer.impressions, topPerformer.clicks)} CTR)</div>`;
  }

  html += `<div class="text-[9px] text-zinc-400 mb-1">Last ${Math.min(5, stats.lastEvents.length)} events:</div>`;
  if (stats.lastEvents.length) {
    html += `<div class="font-mono text-[8px] text-zinc-300 bg-black/40 border border-white/10 p-1.5 rounded mb-2 space-y-0.5">`;
    stats.lastEvents.forEach((ev: Record<string, unknown>) => {
      const ts = eventTimestamp(ev);
      const when = ts ? formatEventTimestampLabel(ts) : '';
      const eventType = String(ev.type || ev.event_type || '').toLowerCase();
      const badge =
        eventType === 'click'
          ? '<span class="text-sky-400">click</span>'
          : '<span class="text-violet-300">imp</span>';
      const timeLabel = when ? `<span class="text-zinc-500">${escapeHtml(when)}</span> · ` : '';
      html += `<div>${badge} ${timeLabel}${escapeHtml(String(ev.label || ev.redirectUrl || ''))}</div>`;
    });
    html += `</div>`;
  } else {
    html += `
      <div class="text-[9px] text-zinc-500 mb-2 p-2 border border-dashed border-white/10 rounded-lg">
        <div class="font-medium text-zinc-400 mb-1">No events yet</div>
        <ol class="list-decimal list-inside space-y-0.5 text-zinc-500">
          <li>Save your <code class="text-emerald-400">banners</code> key in the rich editor</li>
          <li>Hard-refresh the public site (Ctrl+Shift+R)</li>
          <li>Click <strong>Refresh</strong> above after banners rotate on the prize card</li>
        </ol>
      </div>`;
  }

  html += `
    <table class="banner-stats-table w-full text-[9px] text-zinc-200 border border-white/10">
      <thead><tr class="text-emerald-300 bg-white/5">
        <th class="text-left p-1.5">Banner</th><th class="p-1.5 text-center">Imps</th><th class="p-1.5 text-center">Clicks</th><th class="p-1.5 text-center">CTR</th>
      </tr></thead><tbody>
  `;

  sorted.forEach((b) => {
    const isCurrent = currentKeys.has(b.key);
    const isTop = topPerformer?.key === b.key;
    const ctr = formatBannerCtr(b.impressions, b.clicks);
    html += `
      <tr class="border-t border-white/5 ${isCurrent ? 'bg-emerald-900/20' : ''} ${isTop ? 'ring-1 ring-emerald-500/30' : ''}">
        <td class="p-1.5 truncate max-w-[160px] text-zinc-100">
          ${escapeHtml(b.label)}${isCurrent ? ' <span class="text-emerald-400">(live)</span>' : ''}${isTop ? ' <span class="text-amber-300">★</span>' : ''}
        </td>
        <td class="p-1.5 text-center tabular-nums text-zinc-300">${b.impressions}</td>
        <td class="p-1.5 text-center tabular-nums text-zinc-300">${b.clicks}</td>
        <td class="p-1.5 text-center tabular-nums text-emerald-300/90">${ctr}</td>
      </tr>`;
  });

  if (!sorted.length) {
    html += `<tr><td colspan="4" class="p-2 text-zinc-500 text-center">${rows.length ? 'No banners match filter' : 'No banner data — populate events first'}</td></tr>`;
  } else {
    html += `
      <tr class="border-t border-white/20 bg-white/5 font-semibold">
        <td class="p-1.5 text-zinc-300">Total (in view)</td>
        <td class="p-1.5 text-center tabular-nums">${totals.impressions}</td>
        <td class="p-1.5 text-center tabular-nums">${totals.clicks}</td>
        <td class="p-1.5 text-center tabular-nums text-emerald-300">${totals.ctr}</td>
      </tr>`;
  }

  html += `</tbody></table>`;
  container.innerHTML = html;
  wireBannerAutorefresh(container);
  refreshAdminLiveIndicators();
}

/**
 * Renders the Banner Performance stats UI into the given container.
 * Supports preloaded local events for immediate render (banner-stats-quick at tab top).
 * Never throws — failures fall back to local/empty shell.
 */
export async function renderBannerStats(container: HTMLElement, preloadedEvents?: Array<Record<string, unknown>>) {
  try {
    bindBannerStatsActions(container);

    if (preloadedEvents) {
      renderBannerStatsView(container, preloadedEvents, 'local');
      return;
    }

    const res = await fetchBannerStatsEvents();
    renderBannerStatsView(container, res.events, res.source, res.fetchError);
  } catch (err) {
    console.error('[banner-stats] render failed', err);
    const local = getLocalBannerEvents();
    try {
      renderBannerStatsView(
        container,
        local,
        'local',
        err instanceof Error ? err.message : 'Could not load banner stats',
      );
    } catch {
      container.innerHTML = `<div class="text-[9px] text-amber-400">Could not load banner stats. Click Refresh to retry.</div>
        <button type="button" data-banner-stats-refresh class="text-[9px] px-2 py-0.5 mt-1 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">↻ Refresh</button>`;
      bindBannerStatsActions(container);
    }
  }
}

/** Quick panel at Edit Content tab top: local first, then server upgrade. */
export async function wireBannerStatsQuick(root: HTMLElement) {
  const el = root.querySelector('#banner-stats-quick') as HTMLElement | null;
  if (!el) return;

  if (unregisterBannerLive) unregisterBannerLive();
  unregisterBannerLive = registerAdminLiveRefresh('banner', () => {
    const panel = root.querySelector('#banner-stats-quick') as HTMLElement | null;
    if (panel && document.body.contains(panel)) {
      void silentRefreshBannerStats(panel);
    }
  });

  bindBannerStatsActions(el);
  const local = getLocalBannerEvents();

  try {
    if (local.length) {
      renderBannerStatsView(el, local, 'local');
    } else {
      el.innerHTML = BANNER_STATS_SKELETON;
    }
  } catch {
    el.innerHTML = BANNER_STATS_SKELETON;
  }

  try {
    const res = await fetchBannerStatsEvents();
    renderBannerStatsView(el, res.events, res.source, res.fetchError);
  } catch (err) {
    console.error('[banner-stats] quick wire server upgrade failed', err);
    if (!local.length) {
      el.innerHTML = `<div class="text-[9px] text-amber-400">Could not load banner stats. Click Refresh to retry.</div>
        <button type="button" data-banner-stats-refresh class="text-[9px] px-2 py-0.5 mt-1 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">↻ Refresh</button>`;
      bindBannerStatsActions(el);
    }
  }
}