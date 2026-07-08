import { invokeAdminAction } from '../lib/admin-action-client';
import { registerAdminLiveRefresh } from './admin-live-hub';
import { showToast } from '../ui';
import { escapeHtml } from '../content';
import { adminReferralsCache, replaceReferralsCache, type AdminReferralRow } from './state';
import { isTestReferralRecord } from '../lib/test-referral';
import {
  computeReferralTrackingSummary,
  getStoredAdminTabDaysFilter,
  parseAdminTabDaysFilter,
  REFERRALS_DAYS_STORAGE_KEY,
  storeAdminTabDaysFilter,
  type AdminTabDaysFilter,
} from './admin-tab-tracking-helpers';
import {
  buildReferralsTrackingShellOpenHtml,
  REFERRALS_TRACKING_SHELL_CLOSE,
  reportReferralsTrackingSummary,
  wireReferralsTrackingHub,
} from './referrals-tracking';

type RiskFilter = 'all' | 'high-risk';

let currentRiskFilter: RiskFilter = 'all';
let unregisterReferralsLive: (() => void) | null = null;

function getReferralsTabRoot(from: HTMLElement): HTMLElement {
  return (from.closest('#admin-content') as HTMLElement) || from;
}

/** Production DB uses referred_ip; legacy rows may still have ip_address. */
export function getReferralIp(row: AdminReferralRow): string {
  const ip = row.referred_ip ?? row.ip_address;
  return typeof ip === 'string' ? ip.trim() : '';
}

/** Exported for testability (pure function). */
export function computeHighRiskIPs(rows: readonly AdminReferralRow[]): Set<string> {
  const ipCounts: Record<string, number> = {};
  rows.forEach((r) => {
    const ip = getReferralIp(r);
    if (ip) ipCounts[ip] = (ipCounts[ip] || 0) + 1;
  });
  return new Set(Object.entries(ipCounts).filter(([, c]) => c >= 3).map(([ip]) => ip));
}

/** Exported for testability (pure function). */
export function filterReferralsByDays(rows: readonly AdminReferralRow[], days: number): readonly AdminReferralRow[] {
  if (days === 0) return rows;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return rows.filter((r) => new Date(r.created_at) >= cutoff);
}

/** Exported for testability (pure function). */
export function filterReferralsBySearch(rows: readonly AdminReferralRow[], query: string): AdminReferralRow[] {
  const q = query.toLowerCase().trim();
  if (!q) return [...rows];
  return rows.filter(
    (r) =>
      (r.referrer_code || '').toLowerCase().includes(q) ||
      getReferralIp(r).toLowerCase().includes(q) ||
      (r.user_agent || '').toLowerCase().includes(q),
  );
}

/** Exported for testability (pure function). */
export function filterReferralsByRisk(
  rows: readonly AdminReferralRow[],
  riskIPs: Set<string>,
  filter: RiskFilter,
): AdminReferralRow[] {
  if (filter === 'all') return [...rows];
  return rows.filter((r) => {
    const ip = getReferralIp(r);
    return ip && riskIPs.has(ip);
  });
}

/** Exported for testability (pure function). */
export function computeTopReferrers(
  rows: readonly AdminReferralRow[],
  limit = 5,
): Array<{ code: string; count: number }> {
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    const code = r.referrer_code || 'unknown';
    counts[code] = (counts[code] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code, count]) => ({ code, count }));
}

/** Drops owner/smoke/automation rows from admin views. */
export function filterTestReferralsFromAdmin(rows: readonly AdminReferralRow[]): AdminReferralRow[] {
  return rows.filter((row) => !isTestReferralRecord(row as Record<string, unknown>));
}

/** Applies day, search, and risk filters in one pass. */
export function applyReferralFilters(
  rows: readonly AdminReferralRow[],
  days: number,
  search: string,
  riskFilter: RiskFilter,
): { filtered: AdminReferralRow[]; riskIPs: Set<string> } {
  const realRows = filterTestReferralsFromAdmin(rows);
  const riskIPs = computeHighRiskIPs(realRows);
  let filtered = [...filterReferralsByDays(realRows, days)];
  filtered = filterReferralsBySearch(filtered, search);
  filtered = filterReferralsByRisk(filtered, riskIPs, riskFilter);
  return { filtered, riskIPs };
}

/**
 * Admin Tab: Referrals
 *
 * Displays all referral events with live search, time/risk filters,
 * top-referrer insights, high-risk IP detection, detail modals, and CSV export.
 */
async function renderReferralsTab(content: HTMLElement) {
  content.dataset.vrReferralsTrackingRoot = '1';
  content.innerHTML = `
    ${buildReferralsTrackingShellOpenHtml()}
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="text-2xl font-bold">Referrals</div>
        <div class="text-sm text-zinc-400">Monitor all referral activity • Abuse detection built-in</div>
      </div>
      <div class="flex items-center gap-3">
        <span id="referrals-live-indicator" class="hidden text-[10px] text-emerald-400/80"><i class="fa-solid fa-circle text-[6px] mr-1"></i>live</span>
        <span id="referrals-last-updated" class="text-[10px] text-zinc-500"></span>
        <button id="referrals-refresh-btn" class="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-2xl flex items-center gap-2">
          <i class="fa-solid fa-sync"></i> Refresh
        </button>
      </div>
    </div>

    <div id="referrals-stats" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="glass admin-stat-card rounded-2xl p-4">
        <div class="text-xs text-zinc-400">TOTAL REFERRALS</div>
        <div id="stat-total" class="text-4xl font-bold text-white mt-1">—</div>
      </div>
      <div class="glass admin-stat-card rounded-2xl p-4">
        <div class="text-xs text-zinc-400">UNIQUE REFERRERS</div>
        <div id="stat-unique" class="text-4xl font-bold text-emerald-400 mt-1">—</div>
      </div>
      <div class="glass admin-stat-card rounded-2xl p-4">
        <div class="text-xs text-zinc-400">TODAY</div>
        <div id="stat-today" class="text-4xl font-bold text-white mt-1">—</div>
      </div>
      <button type="button" id="stat-risk-card" class="glass admin-stat-card rounded-2xl p-4 border border-red-500/30 text-left hover:border-red-500/50 transition-colors" title="Click to filter high-risk IPs only">
        <div class="text-xs text-red-400 flex items-center gap-1">
          HIGH-RISK IPs
          <i class="fa-solid fa-info-circle text-[10px] opacity-60"></i>
        </div>
        <div id="stat-risk" class="text-4xl font-bold text-red-400 mt-1">—</div>
      </button>
    </div>

    <div id="referrals-top-panel" class="hidden mb-6 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
      <div class="text-xs uppercase tracking-widest text-zinc-500 mb-3">Top referrers in current view</div>
      <div id="referrals-top-list" class="flex flex-wrap gap-2"></div>
    </div>

    <div class="flex flex-col md:flex-row gap-3 items-center mb-3">
      <div class="relative flex-1 w-full">
        <input id="referral-search" type="search" placeholder="Search code, IP, or user agent..."
               class="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-2 pr-10 text-sm focus:border-violet-500" />
        <button type="button" id="referral-search-clear" class="hidden absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs" aria-label="Clear search">✕</button>
      </div>

      <div class="flex gap-2 flex-wrap">
        <button data-days="1" class="time-filter px-3 py-1.5 text-sm rounded-2xl border border-white/20 hover:bg-white/10">Today</button>
        <button data-days="7" class="time-filter px-3 py-1.5 text-sm rounded-2xl border border-white/20 hover:bg-white/10">7 days</button>
        <button data-days="30" class="time-filter px-3 py-1.5 text-sm rounded-2xl border border-white/20 hover:bg-white/10">30 days</button>
        <button data-days="0" class="time-filter px-3 py-1.5 text-sm rounded-2xl bg-violet-600 text-white">All time</button>
      </div>

      <button id="export-referrals-btn"
              class="md:ml-auto px-5 py-2 text-sm bg-emerald-600/90 hover:bg-emerald-600 rounded-2xl flex items-center gap-2 font-medium">
        <i class="fa-solid fa-download"></i> Export CSV
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2 mb-4">
      <button data-risk="all" class="referral-risk-filter px-3 py-1 text-xs rounded-full border border-violet-500 bg-violet-600 text-white">All referrals</button>
      <button data-risk="high-risk" class="referral-risk-filter px-3 py-1 text-xs rounded-full border border-white/20 text-zinc-400 hover:bg-white/10">High-risk IPs only</button>
      <span id="referrals-result-count" class="text-xs text-zinc-500 ml-auto"></span>
    </div>

    <div id="referrals-table-container" class="overflow-x-auto">
      <div class="space-y-2 py-2">
        <div class="h-12 skeleton"></div>
        <div class="h-12 skeleton"></div>
        <div class="h-12 skeleton"></div>
      </div>
    </div>
    ${REFERRALS_TRACKING_SHELL_CLOSE}
  `;

  const searchInput = document.getElementById('referral-search') as HTMLInputElement;
  const searchClearBtn = document.getElementById('referral-search-clear') as HTMLButtonElement;
  const tableContainer = document.getElementById('referrals-table-container')!;
  const exportBtn = document.getElementById('export-referrals-btn') as HTMLButtonElement;
  const refreshBtn = document.getElementById('referrals-refresh-btn') as HTMLButtonElement;
  const riskStatCard = document.getElementById('stat-risk-card');

  let currentFilterDays = getStoredAdminTabDaysFilter(REFERRALS_DAYS_STORAGE_KEY);
  let currentSearch = '';

  function syncTimeFilterButtons() {
    document.querySelectorAll('.time-filter').forEach((btn) => {
      const days = parseInt((btn as HTMLElement).dataset.days || '0', 10);
      const active = days === currentFilterDays;
      btn.classList.toggle('bg-violet-600', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('border-white/20', !active);
    });
    const hub = content.querySelector('[data-vr-referrals-tracking-hub]') as HTMLElement | null;
    const rangeSelect = hub?.querySelector<HTMLSelectElement>('[data-referrals-tracking-range]');
    if (rangeSelect) rangeSelect.value = String(currentFilterDays);
  }

  function reportTrackingFromCache() {
    const realRows = filterTestReferralsFromAdmin(adminReferralsCache);
    const { filtered } = applyReferralFilters(
      adminReferralsCache,
      currentFilterDays,
      currentSearch,
      currentRiskFilter,
    );
    const riskIPs = computeHighRiskIPs(realRows);
    reportReferralsTrackingSummary(
      computeReferralTrackingSummary(
        realRows.length,
        riskIPs.size,
        filtered,
        currentFilterDays as AdminTabDaysFilter,
      ),
    );
  }

  function buildReferralsCopyPayload(): string {
    const { filtered } = applyReferralFilters(
      adminReferralsCache,
      currentFilterDays,
      currentSearch,
      currentRiskFilter,
    );
    const realRows = filterTestReferralsFromAdmin(adminReferralsCache);
    const summary = computeReferralTrackingSummary(
      realRows.length,
      computeHighRiskIPs(realRows).size,
      filtered,
      currentFilterDays as AdminTabDaysFilter,
    );
    return JSON.stringify(
      {
        generated: new Date().toISOString(),
        filterDays: currentFilterDays,
        riskFilter: currentRiskFilter,
        search: currentSearch,
        summary,
        referrals: filtered,
      },
      null,
      2,
    );
  }

  function updateGlobalStats(rows: readonly AdminReferralRow[]) {
    const total = rows.length;
    const unique = new Set(rows.map((r) => r.referrer_code)).size;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = rows.filter((r) => new Date(r.created_at) >= today).length;
    const riskIPs = computeHighRiskIPs(rows);

    const statTotal = document.getElementById('stat-total');
    const statUnique = document.getElementById('stat-unique');
    const statToday = document.getElementById('stat-today');
    const statRisk = document.getElementById('stat-risk');

    if (statTotal) statTotal.textContent = formatNumber(total);
    if (statUnique) statUnique.textContent = formatNumber(unique);
    if (statToday) statToday.textContent = formatNumber(todayCount);
    if (statRisk) statRisk.textContent = formatNumber(riskIPs.size);

    return riskIPs;
  }

  function updateTopReferrersPanel(filtered: readonly AdminReferralRow[]) {
    const panel = document.getElementById('referrals-top-panel');
    const list = document.getElementById('referrals-top-list');
    if (!panel || !list) return;

    const top = computeTopReferrers(filtered, 5);
    if (!top.length) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    list.innerHTML = top
      .map(
        (t, i) => `
      <button type="button" data-search-code="${escapeHtml(t.code)}" class="referral-top-chip flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm">
        <span class="w-5 h-5 rounded-full bg-violet-600/80 flex items-center justify-center text-[10px] font-bold">${i + 1}</span>
        <span class="font-mono text-emerald-400">${escapeHtml(t.code)}</span>
        <span class="text-zinc-400 text-xs">${t.count} refs</span>
      </button>`,
      )
      .join('');

    list.querySelectorAll('.referral-top-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const code = (chip as HTMLElement).dataset.searchCode || '';
        if (searchInput) {
          searchInput.value = code;
          currentSearch = code;
          syncSearchClearBtn();
          applyFilters();
        }
      });
    });
  }

  function updateResultCount(shown: number, total: number) {
    const el = document.getElementById('referrals-result-count');
    if (!el) return;
    el.textContent =
      shown === total ? `Showing ${formatNumber(shown)} referrals` : `Showing ${formatNumber(shown)} of ${formatNumber(total)}`;
  }

  function syncSearchClearBtn() {
    if (!searchClearBtn) return;
    searchClearBtn.classList.toggle('hidden', !currentSearch.trim());
  }

  function syncRiskFilterChips() {
    document.querySelectorAll('.referral-risk-filter').forEach((btn) => {
      const active = (btn as HTMLElement).dataset.risk === currentRiskFilter;
      btn.classList.toggle('bg-violet-600', active);
      btn.classList.toggle('border-violet-500', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('border-white/20', !active);
      btn.classList.toggle('text-zinc-400', !active);
    });
  }

  function renderFilteredReferrals(filtered: readonly AdminReferralRow[], riskIPs: Set<string>) {
    tableContainer.innerHTML = buildReferralsTableHTML(filtered, riskIPs);
    attachReferralTableListeners(tableContainer, filtered, riskIPs);
    updateTopReferrersPanel(filtered);
    updateResultCount(filtered.length, filterTestReferralsFromAdmin(adminReferralsCache).length);
    reportTrackingFromCache();
  }

  function applyFilters() {
    const { filtered, riskIPs } = applyReferralFilters(
      adminReferralsCache,
      currentFilterDays,
      currentSearch,
      currentRiskFilter,
    );
    renderFilteredReferrals(filtered, riskIPs);
    syncRiskFilterChips();
  }

  async function loadReferralsData() {
    const result = await invokeAdminAction<AdminReferralRow[]>('get_referrals', { limit: 2000 });
    if (!result.success) throw new Error(result.error);
    replaceReferralsCache(result.data || []);
    updateGlobalStats(filterTestReferralsFromAdmin(adminReferralsCache));

    const tsEl = document.getElementById('referrals-last-updated');
    if (tsEl) {
      const now = new Date();
      tsEl.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    applyFilters();
  }

  const trackingHub = content.querySelector('[data-vr-referrals-tracking-hub]') as HTMLElement | null;
  if (trackingHub) {
    wireReferralsTrackingHub(trackingHub, {
      onRefresh: async () => {
        const icon = refreshBtn?.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        if (refreshBtn) refreshBtn.disabled = true;
        try {
          await loadReferralsData();
          showToast('Referrals refreshed', 'success');
        } catch (e) {
          showToast(`Refresh failed: ${String(e)}`, 'info');
        } finally {
          if (refreshBtn) refreshBtn.disabled = false;
          if (icon) icon.classList.remove('fa-spin');
        }
      },
      onRangeChange: (days) => {
        currentFilterDays = parseAdminTabDaysFilter(String(days)) as AdminTabDaysFilter;
        storeAdminTabDaysFilter(REFERRALS_DAYS_STORAGE_KEY, currentFilterDays);
        syncTimeFilterButtons();
        applyFilters();
      },
      getCopyPayload: buildReferralsCopyPayload,
    });
  }

  try {
    syncTimeFilterButtons();
    await loadReferralsData();
    if (unregisterReferralsLive) unregisterReferralsLive();
    unregisterReferralsLive = registerAdminLiveRefresh('referral', () => {
      void loadReferralsData().catch(() => {});
    });
    const liveEl = document.getElementById('referrals-live-indicator');
    if (liveEl) liveEl.classList.remove('hidden');

    let searchTimeout: number;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = window.setTimeout(() => {
        currentSearch = searchInput.value;
        syncSearchClearBtn();
        applyFilters();
      }, 200);
    });

    searchClearBtn?.addEventListener('click', () => {
      currentSearch = '';
      if (searchInput) searchInput.value = '';
      syncSearchClearBtn();
      applyFilters();
      searchInput?.focus();
    });

    document.querySelectorAll('.time-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilterDays = parseAdminTabDaysFilter((btn as HTMLElement).dataset.days || '0');
        storeAdminTabDaysFilter(REFERRALS_DAYS_STORAGE_KEY, currentFilterDays);
        syncTimeFilterButtons();
        applyFilters();
      });
    });

    document.querySelectorAll('.referral-risk-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentRiskFilter = ((btn as HTMLElement).dataset.risk || 'all') as RiskFilter;
        applyFilters();
      });
    });

    riskStatCard?.addEventListener('click', () => {
      currentRiskFilter = currentRiskFilter === 'high-risk' ? 'all' : 'high-risk';
      applyFilters();
      if (currentRiskFilter === 'high-risk') {
        showToast('Showing high-risk IPs only', 'info');
      }
    });

    refreshBtn?.addEventListener('click', async () => {
      const icon = refreshBtn.querySelector('i');
      if (icon) icon.classList.add('fa-spin');
      refreshBtn.disabled = true;
      try {
        await loadReferralsData();
        showToast('Referrals refreshed', 'success');
      } catch (e) {
        showToast(`Refresh failed: ${String(e)}`, 'info');
      } finally {
        refreshBtn.disabled = false;
        if (icon) icon.classList.remove('fa-spin');
      }
    });

    exportBtn?.addEventListener('click', () => {
      if (!adminReferralsCache.length) return;
      const { filtered } = applyReferralFilters(
        adminReferralsCache,
        currentFilterDays,
        currentSearch,
        currentRiskFilter,
      );
      if (!filtered.length) {
        showToast('No referrals match current filters', 'info');
        return;
      }
      exportReferralsCSV(filtered);
      showToast('Referrals exported successfully', 'success');
    });
  } catch (e) {
    const errContainer = document.getElementById('referrals-table-container');
    if (errContainer) {
      errContainer.innerHTML = `
        <div class="p-6 text-amber-400 border border-amber-500/30 rounded-2xl">
          Unable to load referrals. ${escapeHtml(String(e))}
          <button id="referrals-retry-btn" class="mt-3 block px-4 py-2 text-sm bg-white/10 rounded-2xl">Retry</button>
        </div>`;
      document.getElementById('referrals-retry-btn')?.addEventListener('click', () => {
        renderReferralsTab(getReferralsTabRoot(content));
      });
    } else {
      content.innerHTML = `
        <div class="p-6 text-amber-400">Unable to load referrals. ${escapeHtml(String(e))}</div>
        <button onclick="window.switchAdminTab(0)" class="mt-3 px-4 py-2 text-sm bg-white/10 rounded-2xl">Retry</button>
      `;
    }
  }
}

function getRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function exportReferralsCSV(rows: readonly AdminReferralRow[]) {
  if (!rows.length) return;

  const headers = ['created_at', 'referrer_code', 'referred_ip', 'user_agent', 'referrer_user_id'];
  const csvRows = [headers.join(',')];

  rows.forEach((r) => {
    const line = [
      r.created_at || '',
      `"${(r.referrer_code || '').replace(/"/g, '""')}"`,
      getReferralIp(r),
      `"${(r.user_agent || '').replace(/"/g, '""')}"`,
      r.referrer_user_id || '',
    ];
    csvRows.push(line.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `viralrefer-referrals-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showReferralDetails(row: AdminReferralRow, isHighRisk: boolean = false) {
  const modal = document.getElementById('referral-details-modal');
  const contentBox = document.getElementById('referral-details-content');
  if (!modal || !contentBox) return;

  const pretty = JSON.stringify(row, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const created = row.created_at ? new Date(row.created_at).toLocaleString() : '—';
  const safeCode = escapeHtml(row.referrer_code || '—');
  const rowIp = getReferralIp(row);
  const safeIp = escapeHtml(rowIp || '—');
  const safeUa = escapeHtml(row.user_agent || '—');

  contentBox.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div><span class="text-zinc-400">Referral ID</span><div class="font-mono text-xs break-all">${escapeHtml(row.id || '—')}</div></div>
      <div>
        <span class="text-zinc-400">Referrer Code</span>
        <div class="flex items-center gap-2">
          <div class="font-mono text-emerald-400 text-lg">${safeCode}</div>
          ${row.referrer_code ? `
            <button class="copy-modal-code-btn text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-white/5 text-xs" data-code="${safeCode}">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
          ` : ''}
        </div>
      </div>

      <div>
        <span class="text-zinc-400">IP Address</span>
        <div class="flex items-center gap-2">
          <div class="font-mono text-xs">${safeIp}</div>
          ${rowIp ? `
            <button class="copy-modal-ip-btn text-sky-400 hover:text-sky-300 px-2 py-0.5 rounded bg-white/5 text-xs" data-ip="${safeIp}">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
          ` : ''}
        </div>
      </div>
      <div><span class="text-zinc-400">Risk Level</span><div>${isHighRisk ? '<span class="px-3 py-0.5 text-xs rounded bg-red-600 text-white font-medium">HIGH — Multiple referrals from this IP</span>' : '<span class="text-emerald-400">Normal</span>'}</div></div>

      <div class="md:col-span-2"><span class="text-zinc-400">User Agent</span><div class="text-xs break-all text-zinc-300">${safeUa}</div></div>

      <div><span class="text-zinc-400">Referrer User ID</span><div class="font-mono text-xs">${escapeHtml(String(row.referrer_user_id || '—'))}</div></div>
      <div><span class="text-zinc-400">Referred User ID</span><div class="font-mono text-xs">${escapeHtml(String(row.referred_user_id || '—'))}</div></div>
    </div>

    <div class="mt-4 pt-4 border-t border-white/10 text-xs text-zinc-400">
      Created: ${created}
    </div>

    <div class="mt-4">
      <div class="text-xs text-zinc-400 mb-1">Raw Record</div>
      <pre class="p-3 bg-black/40 rounded-xl text-[10px] overflow-auto max-h-48">${pretty}</pre>
    </div>
  `;

  modal.classList.remove('hidden');

  const copyBtn = contentBox.querySelector('.copy-modal-code-btn') as HTMLButtonElement | null;
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = copyBtn.dataset.code || '';
      navigator.clipboard.writeText(code).then(() => {
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
        showToast('Code copied to clipboard', 'success');
        setTimeout(() => {
          copyBtn.innerHTML = original;
        }, 1300);
      });
    });
  }

  const copyIpBtn = contentBox.querySelector('.copy-modal-ip-btn') as HTMLButtonElement | null;
  if (copyIpBtn) {
    copyIpBtn.addEventListener('click', () => {
      const ip = copyIpBtn.dataset.ip || '';
      navigator.clipboard.writeText(ip).then(() => {
        const original = copyIpBtn.innerHTML;
        copyIpBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
        showToast('IP copied to clipboard', 'success');
        setTimeout(() => {
          copyIpBtn.innerHTML = original;
        }, 1300);
      });
    });
  }
}

function buildReferralsTableHTML(filtered: readonly AdminReferralRow[], riskIPs: Set<string>): string {
  if (!filtered.length) {
    return `
      <div class="text-center py-12 text-zinc-400 border border-white/10 rounded-2xl">
        <i class="fa-solid fa-users text-4xl mb-3 block opacity-60"></i>
        <div class="font-semibold text-zinc-300">No referrals found</div>
        <p class="text-sm mt-1 max-w-xs mx-auto">Try adjusting your search, time range, or risk filter.</p>
      </div>`;
  }

  let html = `
    <table class="w-full text-sm referrals-admin-table">
      <thead class="sticky top-0 bg-zinc-950/95 backdrop-blur-sm z-10">
        <tr class="border-b border-white/10 text-left text-zinc-400">
          <th class="py-3 pr-4">Date</th>
          <th class="py-3 pr-4">Referrer Code</th>
          <th class="py-3 pr-4">IP Address</th>
          <th class="py-3 pr-4">User Agent</th>
          <th class="py-3 pr-4">Time Ago</th>
          <th class="py-3 pr-4">Risk</th>
          <th class="py-3">Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtered.forEach((row) => {
    const rowId = row.id || `${row.referrer_code}-${row.created_at}`;
    const dateStr = new Date(row.created_at).toLocaleDateString();
    const code = escapeHtml(row.referrer_code || '—');
    const rowIp = getReferralIp(row);
    const ip = escapeHtml(rowIp || '—');
    const uaRaw = row.user_agent || '';
    const ua = uaRaw ? escapeHtml(uaRaw.substring(0, 38) + (uaRaw.length > 38 ? '…' : '')) : '—';
    const timeAgo = getRelativeTime(row.created_at);
    const isRisk = !!(rowIp && riskIPs.has(rowIp));

    html += `
      <tr data-referral-id="${escapeHtml(rowId)}" class="referral-row table-row border-b border-white/10 hover:bg-zinc-900/60 cursor-pointer ${isRisk ? 'bg-red-950/20' : ''}">
        <td class="py-3 pr-4 text-xs text-zinc-400 whitespace-nowrap">${dateStr}</td>
        <td class="py-3 pr-4 font-mono text-emerald-400">
          <span class="inline-flex items-center gap-1.5">
            ${code}
            <button data-code="${code}" class="copy-code-btn text-emerald-400 hover:text-emerald-300 p-1 -mr-1" title="Copy code">
              <i class="fa-solid fa-copy text-xs"></i>
            </button>
          </span>
        </td>
        <td class="py-3 pr-4 font-mono text-xs text-zinc-300">
          <span class="inline-flex items-center gap-1">
            ${ip}
            ${rowIp ? `
              <button data-ip="${ip}" class="copy-ip-btn text-sky-400 hover:text-sky-300 p-1" title="Copy IP">
                <i class="fa-solid fa-copy text-[10px]"></i>
              </button>
            ` : ''}
          </span>
        </td>
        <td class="py-3 pr-4 text-xs text-zinc-400 max-w-[220px] truncate" title="${escapeHtml(uaRaw)}">${ua}</td>
        <td class="py-3 pr-4 text-xs text-zinc-400">${timeAgo}</td>
        <td class="py-3 pr-4">
          ${isRisk ? '<span class="px-2 py-0.5 text-xs rounded bg-red-600/80 text-white font-medium">High</span>' : ''}
        </td>
        <td class="py-3">
          <button data-referral-id="${escapeHtml(rowId)}" class="view-referral-btn text-xs px-4 py-1 rounded-xl bg-white/10 hover:bg-white/20">View</button>
        </td>
      </tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

function findReferralInList(rows: readonly AdminReferralRow[], id: string): AdminReferralRow | undefined {
  return rows.find((r) => (r.id || `${r.referrer_code}-${r.created_at}`) === id);
}

function attachReferralTableListeners(
  tableContainer: HTMLElement,
  filtered: readonly AdminReferralRow[],
  riskIPs: Set<string>,
) {
  const openRow = (id: string) => {
    const row = findReferralInList(filtered, id);
    if (row) showReferralDetails(row, riskIPs.has(getReferralIp(row)));
  };

  tableContainer.querySelectorAll('.referral-row').forEach((rowEl) => {
    rowEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const id = (rowEl as HTMLElement).dataset.referralId || '';
      openRow(id);
    });
  });

  tableContainer.querySelectorAll('.copy-code-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      const code = (btn as HTMLElement).dataset.code || '';
      if (!code || code === '—') return;

      navigator.clipboard.writeText(code).then(() => {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i>`;
        (btn as HTMLElement).title = 'Copied!';
        showToast('Code copied to clipboard', 'success');
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          (btn as HTMLElement).title = 'Copy code';
        }, 1200);
      });
    });
  });

  tableContainer.querySelectorAll('.copy-ip-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      const ip = (btn as HTMLElement).dataset.ip || '';
      if (!ip || ip === '—') return;

      navigator.clipboard.writeText(ip).then(() => {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check text-sky-400"></i>`;
        showToast('IP copied to clipboard', 'success');
        setTimeout(() => {
          btn.innerHTML = originalHTML;
        }, 1200);
      });
    });
  });

  tableContainer.querySelectorAll('.view-referral-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      const id = (btn as HTMLElement).dataset.referralId || '';
      openRow(id);
    });
  });
}

export { renderReferralsTab };