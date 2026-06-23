/** Premium banner quick-stats panel (admin audit). */
import {
  clearBannerEvents,
  computeBannerStats,
  escapeHtml,
  getBannerEventsForStats,
  getLocalBannerEvents,
} from '../content';
import { showToast } from '../ui';
import {
  type BannerStatRow,
  type BannerSortKey,
  computeBannerTotals,
  filterBannerRowsBySearch,
  findTopPerformer,
  formatBannerCtr,
  sortBannerRows,
} from './banner-stats-helpers';

let currentBannerSearch = '';
let currentBannerSort: BannerSortKey = 'impressions';

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
    const refreshBtn = target.closest('[data-banner-stats-refresh]');
    const clearBtn = target.closest('[data-banner-stats-clear]');
    const copyBtn = target.closest('[data-banner-stats-copy]');
    const csvBtn = target.closest('[data-banner-stats-csv]');
    const sortBtn = target.closest('[data-banner-sort]');
    const clearSearchBtn = target.closest('[data-banner-search-clear]');

    if (!container.contains(refreshBtn || clearBtn || copyBtn || csvBtn || sortBtn || clearSearchBtn)) {
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
      const csv = container.dataset.bannerStatsCsv;
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

async function refreshBannerStats(container: HTMLElement, btn?: HTMLButtonElement) {
  const refreshBtn =
    btn || (container.querySelector('[data-banner-stats-refresh]') as HTMLButtonElement | null);
  const originalLabel = refreshBtn?.textContent || '↻ Refresh';
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '↻ Refreshing…';
  }
  try {
    await renderBannerStats(container);
    showToast('Banner stats refreshed', 'success');
  } catch {
    showToast('Could not refresh banner stats', 'info');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = originalLabel;
    }
  }
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
  container.dataset.bannerStatsEvents = JSON.stringify(events);
  container.dataset.bannerStatsSource = source;
  if (fetchError) container.dataset.bannerStatsFetchError = fetchError;
  else delete container.dataset.bannerStatsFetchError;

  const stats = computeBannerStats(events);
  const rows = stats.perBanner as BannerStatRow[];
  const filtered = filterBannerRowsBySearch(rows, currentBannerSearch);
  const sorted = sortBannerRows(filtered, currentBannerSort);
  const totals = computeBannerTotals(sorted);
  const topPerformer = findTopPerformer(sorted, 3);

  const currentBanners = (window as unknown as { __currentBannersForStats?: Array<Record<string, unknown>> })
    .__currentBannersForStats || [];
  const currentKeys = new Set(
    currentBanners.map((b) => {
      const lab = String(b.label || '').trim();
      const u = String(b.redirectUrl || '').trim();
      return lab && u ? `${lab}|${u}` : u || lab || '';
    }),
  );

  const isServer = source === 'server';
  const sourceBadge = isServer
    ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[8px]">SERVER</span>'
    : '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[8px]">LOCAL</span>';
  const refreshedAt = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const copyPayload = JSON.stringify(
    { generated: new Date().toISOString(), source, totals, stats: sorted, rawEvents: stats.lastEvents },
    null,
    2,
  );
  container.dataset.bannerStatsCopy = copyPayload;
  container.dataset.bannerStatsCsv = buildCsv(sorted);

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
      <span class="text-[9px] text-zinc-500">Updated ${refreshedAt} · ${stats.total} events${isServer ? ' (latest 500)' : ''}</span>
    </div>
  `;

  if (fetchError && !isServer) {
    html += `<div class="text-[9px] text-amber-400/90 mb-2">Server unavailable (${escapeHtml(fetchError)}) — showing local data.</div>`;
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

    <div class="flex flex-wrap gap-2 mb-2">
      <button type="button" data-banner-stats-refresh class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded disabled:opacity-50">↻ Refresh</button>
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
      const ts = String(ev.timestamp || ev.created_at || '');
      const rel = ts ? getRelativeTime(ts) : '';
      const eventType = String(ev.type || ev.event_type || '').toLowerCase();
      const badge =
        eventType === 'click'
          ? '<span class="text-sky-400">click</span>'
          : '<span class="text-violet-300">imp</span>';
      html += `<div>${badge} <span class="text-zinc-500">${rel}</span> ${escapeHtml(String(ev.label || ev.redirectUrl || ''))}</div>`;
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
}

/**
 * Renders the Banner Performance stats UI into the given container.
 * Supports preloaded local events for immediate render (banner-stats-quick at tab top).
 */
export async function renderBannerStats(container: HTMLElement, preloadedEvents?: Array<Record<string, unknown>>) {
  bindBannerStatsActions(container);

  if (preloadedEvents) {
    renderBannerStatsView(container, preloadedEvents, 'local');
    return;
  }

  const res = await getBannerEventsForStats();
  renderBannerStatsView(container, res.events, res.source, res.fetchError);
}

/** Quick panel at Edit Content tab top: local first, then server upgrade. */
export async function wireBannerStatsQuick(root: HTMLElement) {
  const el = root.querySelector('#banner-stats-quick') as HTMLElement | null;
  if (!el) return;

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
    const res = await getBannerEventsForStats();
    renderBannerStatsView(el, res.events, res.source, res.fetchError);
  } catch {
    if (!local.length) {
      el.innerHTML = `<div class="text-[9px] text-amber-400">Could not load banner stats. Click Refresh to retry.</div>`;
    }
  }
}