import type { Chart } from 'chart.js';
import { supabase } from '../lib/supabase';
import { showToast } from '../ui';
import { escapeHtml } from '../content';
import {
  type ShareEvent,
  type AnalyticsViewData,
  filterByDays,
  applyShareFilters,
  computeAnalyticsData,
  formatNumber,
  getUniquePlatforms,
  normalizeShareRow,
  countTestShares,
  listTestShareCodes,
} from './share-analytics-helpers';

let allSharesCache: ShareEvent[] = [];
let currentFilterDays = 0;
let currentSearch = '';
let currentPlatformFilter = 'all';
let sharesChannel: ReturnType<typeof supabase.channel> | null = null;
let shareBarChart: Chart | null = null;
let shareTrendChart: Chart | null = null;

function getShareAnalyticsTabRoot(from: HTMLElement): HTMLElement {
  return (from.closest('#admin-content') as HTMLElement) || from;
}

function destroyCharts() {
  shareBarChart?.destroy();
  shareTrendChart?.destroy();
  shareBarChart = null;
  shareTrendChart = null;
}

function parseAdminActionError(edgeErr: unknown, edgeData: unknown): string {
  if (edgeData && typeof edgeData === 'object' && edgeData !== null && 'error' in edgeData) {
    const msg = (edgeData as { error?: unknown }).error;
    if (msg) return String(msg);
  }
  if (edgeErr && typeof edgeErr === 'object' && edgeErr !== null && 'context' in edgeErr) {
    try {
      const ctx = (edgeErr as { context?: { body?: unknown } }).context;
      const raw = ctx?.body;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed?.error) return String(parsed.error);
    } catch {
      /* ignore parse errors */
    }
  }
  return edgeErr instanceof Error ? edgeErr.message : 'get_shares request failed';
}

async function fetchSharesData(): Promise<ShareEvent[]> {
  const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';
  if (!adminSecret) {
    throw new Error(
      'Admin stats secret not configured. Rebuild with VITE_ADMIN_ACTION_SECRET to load share analytics.',
    );
  }

  const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('admin-action', {
    body: { action: 'get_shares' },
    headers: { 'x-admin-secret': adminSecret },
  });

  if (edgeErr && !(edgeData && typeof edgeData === 'object' && (edgeData as { success?: boolean }).success)) {
    throw new Error(parseAdminActionError(edgeErr, edgeData));
  }
  if (!edgeData?.success) {
    throw new Error(String(edgeData?.error || parseAdminActionError(edgeErr, edgeData)));
  }
  if (!Array.isArray(edgeData.data)) {
    throw new Error('Invalid get_shares response');
  }

  return edgeData.data.map((row: Record<string, unknown>) => normalizeShareRow(row));
}

async function clearTestSharesFromServer(): Promise<{ deleted: number; codes: string[] }> {
  const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';
  if (!adminSecret) {
    throw new Error('Admin secret not configured');
  }

  const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('admin-action', {
    body: { action: 'clear_test_shares', payload: { dry_run: false } },
    headers: { 'x-admin-secret': adminSecret },
  });

  if (edgeErr && !(edgeData && typeof edgeData === 'object' && (edgeData as { success?: boolean }).success)) {
    throw new Error(parseAdminActionError(edgeErr, edgeData));
  }
  if (!edgeData?.success) {
    throw new Error(String(edgeData?.error || 'clear_test_shares rejected'));
  }

  const result = edgeData.data as { deleted?: number; codes?: string[] } | undefined;
  return {
    deleted: result?.deleted ?? 0,
    codes: Array.isArray(result?.codes) ? result.codes : [],
  };
}

function exportSharesCSV(shares: readonly ShareEvent[]) {
  if (!shares.length) return;

  const headers = ['created_at', 'referrer_code', 'platform'];
  const csvRows = [headers.join(',')];

  shares.forEach((s) => {
    csvRows.push(
      [
        s.created_at || '',
        `"${(s.referrer_code || '').replace(/"/g, '""')}"`,
        s.platform || '',
      ].join(','),
    );
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `viralrefer-shares-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildAnalyticsHTML(
  viewData: AnalyticsViewData,
  globalTotal: number,
  filteredCount: number,
  platforms: string[],
  activePlatform: string,
  testShareCount: number,
): string {
  const platformChip = (value: string, label: string) => {
    const active = activePlatform === value;
    return `<button data-platform="${escapeHtml(value)}" class="share-platform-filter px-3 py-1 text-xs rounded-full border transition-colors ${
      active ? 'bg-violet-600 border-violet-500 text-white' : 'border-white/20 text-zinc-400 hover:bg-white/10'
    }">${escapeHtml(label)}</button>`;
  };

  let html = `
    <div class="mb-6">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div class="admin-stat-card">
          <div class="text-sm text-zinc-400">TOTAL SHARES (ALL TIME)</div>
          <div id="share-stat-total" class="text-5xl md:text-6xl font-bold text-white">${formatNumber(globalTotal)}</div>
          <div id="share-stat-subtitle" class="text-xs text-zinc-500 mt-1">From ${formatNumber(viewData.uniqueSharers)} unique sharers in view • Avg ${viewData.avgPerDay}/day</div>
        </div>
        <div class="flex flex-col items-end gap-2">
          <div class="flex items-center gap-3 flex-wrap justify-end">
            <span id="shares-live-indicator" class="hidden text-[10px] text-emerald-400/80"><i class="fa-solid fa-circle text-[6px] mr-1"></i>live</span>
            <span id="analytics-last-updated" class="text-[10px] text-zinc-500"></span>
            <button id="shares-refresh-btn" class="px-4 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-2xl flex items-center gap-2">
              <i class="fa-solid fa-sync"></i> Refresh
            </button>
          </div>
          <div class="flex gap-2 flex-wrap justify-end">
            <button data-days="1" class="share-time-filter px-3 py-1.5 text-sm rounded-2xl border border-white/20 hover:bg-white/10">Today</button>
            <button data-days="7" class="share-time-filter px-3 py-1.5 text-sm rounded-2xl border border-white/20 hover:bg-white/10">7 days</button>
            <button data-days="30" class="share-time-filter px-3 py-1.5 text-sm rounded-2xl border border-white/20 hover:bg-white/10">30 days</button>
            <button data-days="0" class="share-time-filter px-3 py-1.5 text-sm rounded-2xl bg-violet-600 text-white">All time</button>
          </div>
          <div class="flex gap-2 flex-wrap justify-end">
            <button id="export-shares-btn" class="px-4 py-1.5 text-sm bg-emerald-600/90 hover:bg-emerald-600 rounded-2xl flex items-center gap-1.5">
              <i class="fa-solid fa-download text-xs"></i> Export CSV
            </button>
            ${
              testShareCount > 0
                ? `<button id="clear-test-shares-btn" type="button" title="Removes agent/smoke test rows only (PROBE, READY, SMOKETEST, unknown, etc.)"
                    class="px-4 py-1.5 text-sm bg-amber-600/80 hover:bg-amber-600 text-white rounded-2xl flex items-center gap-1.5">
                <i class="fa-solid fa-broom text-xs"></i> Clear test shares (${testShareCount})
              </button>`
                : ''
            }
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col md:flex-row gap-3 items-center mb-3">
      <div class="relative flex-1 w-full">
        <input id="share-search" type="search" placeholder="Search referrer code or platform..."
               class="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-2 pr-10 text-sm focus:border-violet-500" />
        <button type="button" id="share-search-clear" class="hidden absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs" aria-label="Clear search">✕</button>
      </div>
      <span id="shares-result-count" class="text-xs text-zinc-500 whitespace-nowrap"></span>
    </div>

    <div class="flex flex-wrap gap-2 mb-6">
      ${platformChip('all', 'All platforms')}
      ${platforms.map((p) => platformChip(p, p)).join('')}
    </div>
  `;

  if (viewData.total === 0) {
    html += `
      <div class="text-center py-12 text-zinc-400 border border-white/10 rounded-2xl">
        <i class="fa-solid fa-filter text-4xl mb-3 block opacity-60"></i>
        <div class="font-semibold text-zinc-300">No shares match current filters</div>
        <p class="text-sm mt-1">Try widening the time range or clearing search/platform filters.</p>
      </div>`;
    return html;
  }

  html += `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="glass admin-stat-card rounded-2xl p-4">
        <div class="text-xs text-zinc-400">IN VIEW</div>
        <div class="text-3xl font-bold text-white mt-1">${formatNumber(filteredCount)}</div>
      </div>
      <div class="glass admin-stat-card rounded-2xl p-4">
        <div class="text-xs text-zinc-400">UNIQUE SHARERS</div>
        <div class="text-3xl font-bold text-emerald-400 mt-1">${formatNumber(viewData.uniqueSharers)}</div>
      </div>
      <div class="glass admin-stat-card rounded-2xl p-4">
        <div class="text-xs text-zinc-400">PLATFORMS</div>
        <div class="text-3xl font-bold text-white mt-1">${formatNumber(viewData.sortedPlatforms.length)}</div>
      </div>
      <div class="glass admin-stat-card rounded-2xl p-4">
        <div class="text-xs text-zinc-400">PEAK DAY</div>
        <div class="text-lg font-bold text-amber-400 mt-1">${escapeHtml(viewData.peakDay.day)}</div>
        <div class="text-xs text-zinc-500">${viewData.peakDay.count} shares</div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
      <div>
        <h4 class="text-sm font-semibold text-zinc-300 mb-2">Shares by Platform</h4>
        <canvas id="share-chart" style="max-height: 260px;"></canvas>
      </div>
      <div>
        <h4 class="text-sm font-semibold text-zinc-300 mb-2">Shares Over Time (last 14 days)</h4>
        <canvas id="trend-chart" style="max-height: 260px;"></canvas>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="bg-zinc-900 border border-white/10 rounded-2xl p-4">
        <h4 class="text-sm font-semibold text-zinc-300 mb-3">Key Insights</h4>
        <ul class="space-y-2 text-sm text-zinc-300">
          ${viewData.insights.map((i) => `<li>• ${i}</li>`).join('')}
        </ul>
      </div>

      <div>
        <h4 class="text-sm font-semibold text-zinc-300 mb-3">Top Referrers by Shares</h4>
        <div class="space-y-1.5">
  `;

  viewData.topReferrers.forEach(([referrer, count], index) => {
    const percentage = Math.round((count / viewData.total) * 100);
    html += `
      <button type="button" data-search-code="${escapeHtml(referrer)}" class="share-referrer-chip w-full flex items-center justify-between table-row bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm hover:bg-zinc-800/80 transition-colors text-left">
        <div class="flex items-center gap-3">
          <div class="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold">${index + 1}</div>
          <div class="font-mono text-emerald-300">${escapeHtml(referrer)}</div>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-zinc-400">${count} shares</div>
          <div class="font-semibold text-emerald-400 w-11 text-right">${percentage}%</div>
        </div>
      </button>`;
  });

  html += `</div></div><div><h4 class="text-sm font-semibold text-zinc-300 mb-3">Platform Breakdown</h4><div class="space-y-2">`;

  viewData.sortedPlatforms.forEach(([platform, count]) => {
    const percentage = Math.round((count / viewData.total) * 100);
    html += `
      <button type="button" data-platform="${escapeHtml(platform)}" class="share-platform-row w-full flex items-center justify-between table-row bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm hover:bg-zinc-800/80 transition-colors text-left">
        <div class="font-medium">${escapeHtml(platform)}</div>
        <div class="flex items-center gap-4">
          <div class="text-zinc-400">${count} shares</div>
          <div class="font-semibold text-emerald-400 w-12 text-right">${percentage}%</div>
        </div>
      </button>`;
  });

  html += `</div></div></div>`;
  return html;
}

function renderAnalyticsCharts(data: AnalyticsViewData, ChartCtor: typeof Chart) {
  destroyCharts();

  const { sortedPlatforms, trendLabels, trendData } = data;

  const barCtx = (document.getElementById('share-chart') as HTMLCanvasElement)?.getContext('2d');
  if (barCtx && sortedPlatforms.length) {
    shareBarChart = new ChartCtor(barCtx, {
      type: 'bar',
      data: {
        labels: sortedPlatforms.map(([p]) => p),
        datasets: [{ label: 'Shares', data: sortedPlatforms.map(([, c]) => c), backgroundColor: '#864cff', borderRadius: 6 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw} shares` } } },
        scales: { y: { beginAtZero: true, ticks: { color: '#71717a' } }, x: { ticks: { color: '#71717a' } } },
      },
    });
  }

  const trendCtx = (document.getElementById('trend-chart') as HTMLCanvasElement)?.getContext('2d');
  if (trendCtx && trendLabels.length) {
    shareTrendChart = new ChartCtor(trendCtx, {
      type: 'line',
      data: {
        labels: trendLabels.map((d) => d.slice(5)),
        datasets: [{
          label: 'Daily Shares',
          data: trendData,
          borderColor: '#34d399',
          tension: 0.3,
          fill: true,
          backgroundColor: 'rgba(52,211,153,0.1)',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { color: '#71717a' } }, x: { ticks: { color: '#71717a' } } },
      },
    });
  }
}

/**
 * Admin Tab: Share Analytics
 *
 * Platform/referrer breakdowns, time-series charts (Chart.js lazy-loaded),
 * filters, insights, and CSV export.
 */
async function renderShareAnalyticsTab(content: HTMLElement) {
  content.innerHTML = `
    <div class="space-y-4 py-2">
      <div class="h-8 w-56 skeleton rounded-xl"></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="h-24 skeleton rounded-2xl"></div>
        <div class="h-24 skeleton rounded-2xl"></div>
        <div class="h-24 skeleton rounded-2xl"></div>
        <div class="h-24 skeleton rounded-2xl"></div>
      </div>
      <div class="h-64 skeleton rounded-2xl"></div>
    </div>`;

  let ChartCtor: typeof Chart;

  try {
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    ChartCtor = Chart;

    allSharesCache = await fetchSharesData();

    if (!allSharesCache.length) {
      destroyCharts();
      content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <i class="fa-solid fa-share-alt text-5xl text-zinc-600 mb-4 opacity-60"></i>
          <div class="text-xl font-semibold text-zinc-300">No shares yet</div>
          <p class="text-sm text-zinc-500 mt-2 max-w-md">
            When users share their referral links on social media, detailed analytics and insights will appear here automatically.
          </p>
          <button id="shares-empty-refresh" class="mt-4 px-5 py-2 bg-white/10 hover:bg-white/20 rounded-2xl text-sm">Refresh</button>
        </div>`;
      document.getElementById('shares-empty-refresh')?.addEventListener('click', () => {
        renderShareAnalyticsTab(getShareAnalyticsTabRoot(content));
      });
      setupSafeSharesRealtime(getShareAnalyticsTabRoot(content), () => {
        renderShareAnalyticsTab(getShareAnalyticsTabRoot(content)).catch(() => {});
      });
      return;
    }

    const tabRoot = getShareAnalyticsTabRoot(content);

    const renderView = () => {
      const filtered = applyShareFilters(allSharesCache, currentFilterDays, currentSearch, currentPlatformFilter);
      const viewData = computeAnalyticsData(filtered);
      const platforms = getUniquePlatforms(
        filterByDays(allSharesCache, currentFilterDays),
      );
      const testShareCount = countTestShares(allSharesCache);

      destroyCharts();
      content.innerHTML = buildAnalyticsHTML(
        viewData,
        allSharesCache.length,
        filtered.length,
        platforms,
        currentPlatformFilter,
        testShareCount,
      );

      if (viewData.total > 0) {
        renderAnalyticsCharts(viewData, ChartCtor);
      }

      const analyticsTs = document.getElementById('analytics-last-updated');
      if (analyticsTs) {
        const now = new Date();
        analyticsTs.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      const resultEl = document.getElementById('shares-result-count');
      if (resultEl) {
        resultEl.textContent =
          filtered.length === allSharesCache.length
            ? `Showing ${formatNumber(filtered.length)} shares`
            : `Showing ${formatNumber(filtered.length)} of ${formatNumber(allSharesCache.length)}`;
      }

      syncShareFilterButtons();
      attachShareAnalyticsListeners(content, tabRoot, ChartCtor, renderView);
    };

    renderView();
    setupSafeSharesRealtime(tabRoot, async () => {
      try {
        allSharesCache = await fetchSharesData();
        renderView();
      } catch {
        /* keep current view on background refresh failure */
      }
    });
  } catch (e) {
    destroyCharts();
    content.innerHTML = `
      <div class="p-6 text-amber-400 border border-amber-500/30 rounded-2xl">
        Unable to load share analytics. ${escapeHtml(String(e))}
        <button id="shares-retry-btn" class="mt-3 block px-4 py-2 text-sm bg-white/10 rounded-2xl">Retry</button>
      </div>`;
    document.getElementById('shares-retry-btn')?.addEventListener('click', () => {
      renderShareAnalyticsTab(getShareAnalyticsTabRoot(content));
    });
  }
}

function syncShareFilterButtons() {
  document.querySelectorAll('.share-time-filter').forEach((btn) => {
    const days = parseInt((btn as HTMLElement).dataset.days || '0', 10);
    const active = days === currentFilterDays;
    btn.classList.toggle('bg-violet-600', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('border-white/20', !active);
  });

  const clearBtn = document.getElementById('share-search-clear');
  if (clearBtn) clearBtn.classList.toggle('hidden', !currentSearch.trim());
}

function attachShareAnalyticsListeners(
  _content: HTMLElement,
  _tabRoot: HTMLElement,
  _ChartCtor: typeof Chart,
  renderView: () => void,
) {
  const searchInput = document.getElementById('share-search') as HTMLInputElement | null;
  const searchClear = document.getElementById('share-search-clear');
  const refreshBtn = document.getElementById('shares-refresh-btn') as HTMLButtonElement | null;
  const exportBtn = document.getElementById('export-shares-btn') as HTMLButtonElement | null;
  const clearTestBtn = document.getElementById('clear-test-shares-btn') as HTMLButtonElement | null;

  if (searchInput) searchInput.value = currentSearch;

  let searchTimeout: number;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      currentSearch = searchInput.value;
      syncShareFilterButtons();
      renderView();
    }, 200);
  });

  searchClear?.addEventListener('click', () => {
    currentSearch = '';
    if (searchInput) searchInput.value = '';
    syncShareFilterButtons();
    renderView();
    searchInput?.focus();
  });

  document.querySelectorAll('.share-time-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilterDays = parseInt((btn as HTMLElement).dataset.days || '0', 10);
      renderView();
    });
  });

  document.querySelectorAll('.share-platform-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPlatformFilter = (btn as HTMLElement).dataset.platform || 'all';
      renderView();
    });
  });

  document.querySelectorAll('.share-referrer-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const code = (chip as HTMLElement).dataset.searchCode || '';
      currentSearch = code;
      if (searchInput) searchInput.value = code;
      syncShareFilterButtons();
      renderView();
    });
  });

  document.querySelectorAll('.share-platform-row').forEach((row) => {
    row.addEventListener('click', () => {
      currentPlatformFilter = (row as HTMLElement).dataset.platform || 'all';
      renderView();
    });
  });

  refreshBtn?.addEventListener('click', async () => {
    const icon = refreshBtn.querySelector('i');
    if (icon) icon.classList.add('fa-spin');
    refreshBtn.disabled = true;
    try {
      allSharesCache = await fetchSharesData();
      showToast('Share analytics refreshed', 'success');
      renderView();
    } catch (err) {
      showToast(`Refresh failed: ${String(err)}`, 'info');
    } finally {
      refreshBtn.disabled = false;
      if (icon) icon.classList.remove('fa-spin');
    }
  });

  exportBtn?.addEventListener('click', () => {
    const filtered = applyShareFilters(allSharesCache, currentFilterDays, currentSearch, currentPlatformFilter);
    if (!filtered.length) {
      showToast('No shares match current filters', 'info');
      return;
    }
    exportSharesCSV(filtered);
    showToast('Shares exported successfully', 'success');
  });

  clearTestBtn?.addEventListener('click', () => {
    void (async () => {
      const codes = listTestShareCodes(allSharesCache);
      if (!codes.length) {
        showToast('No test shares to clear', 'info');
        return;
      }

      const msg =
        `Remove ${codes.length} test referrer code(s) from share analytics?\n\n` +
        `${codes.join(', ')}\n\n` +
        'Only agent/smoke patterns are deleted. Real user shares are never touched.';

      if (!window.confirm(msg)) return;

      clearTestBtn.disabled = true;
      try {
        const { deleted, codes: removed } = await clearTestSharesFromServer();
        allSharesCache = await fetchSharesData();
        showToast(
          deleted > 0
            ? `Cleared ${deleted} test share(s): ${removed.join(', ')}`
            : 'No test shares matched on server',
          deleted > 0 ? 'success' : 'info',
        );
        renderView();
      } catch (err) {
        showToast(`Clear failed: ${String(err)}`, 'info');
      } finally {
        clearTestBtn.disabled = false;
      }
    })();
  });
}

function setupSafeSharesRealtime(tabRoot: HTMLElement, onRefresh: () => void) {
  if (sharesChannel) {
    try {
      sharesChannel.unsubscribe();
    } catch {
      /* channel already closed */
    }
    sharesChannel = null;
  }

  sharesChannel = supabase
    .channel('shares-admin-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shares' }, () => {
      const adminModal = document.getElementById('admin-modal');
      if (document.body.contains(tabRoot) && adminModal && !adminModal.classList.contains('hidden')) {
        onRefresh();
      }
    })
    .subscribe((status) => {
      const liveEl = document.getElementById('shares-live-indicator');
      if (liveEl) liveEl.classList.toggle('hidden', status !== 'SUBSCRIBED');
    });
}

export { renderShareAnalyticsTab };