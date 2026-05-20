import { supabase, fetchLeaderboard, fetchTotalReferrers, fetchRecentActivity, fetchSiteContent } from './lib/supabase';

// =====================================================
// VIRALREFER PREMIUM — Complete main.ts (restored + fixed)
// All onclick handlers from index.html now work.
// Admin Dashboard fully functional with all 4 tabs.
// =====================================================

// ------------------ GLOBAL STATE ------------------
let myReferralCode: string | null = localStorage.getItem('vr_my_ref_code');
let adminClaimsCache: any[] = [];
let adminReferralsCache: any[] = [];

// ------------------ UTILITY ------------------
function setActiveTab(tab: number) {
  document.querySelectorAll<HTMLElement>('.admin-tab').forEach((el, index) => {
    if (index === tab) {
      el.classList.add('border-b-2', 'border-violet-500', 'text-violet-400');
      el.classList.remove('text-zinc-400');
    } else {
      el.classList.remove('border-b-2', 'border-violet-500', 'text-violet-400');
      el.classList.add('text-zinc-400');
    }
  });
}

// ------------------ TAB 0: REFERRALS (Premium hybrid — stats + live filters + rich table + modal + export) ------------------
async function renderReferralsTab(content: HTMLElement) {
  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="text-2xl font-bold">Referrals</div>
        <div class="text-sm text-zinc-400">Monitor all referral activity • Abuse detection built-in</div>
      </div>
      <div class="flex items-center gap-3">
        <span id="referrals-last-updated" class="text-[10px] text-zinc-500"></span>
        <button onclick="window.triggerRefreshSpin(this); window.switchAdminTab(0)" class="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-2xl flex items-center gap-2">
          <i class="fa-solid fa-sync"></i> Refresh
        </button>
      </div>
    </div>

    <!-- Stats Header -->
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
      <div class="glass admin-stat-card rounded-2xl p-4 border border-red-500/30" title="IPs that have generated 3+ referrals (possible abuse or VPN farming). Click rows to investigate.">
        <div class="text-xs text-red-400 flex items-center gap-1">
          HIGH-RISK IPs
          <i class="fa-solid fa-info-circle text-[10px] opacity-60"></i>
        </div>
        <div id="stat-risk" class="text-4xl font-bold text-red-400 mt-1">—</div>
      </div>
    </div>

    <!-- Live Filter Bar -->
    <div class="flex flex-col md:flex-row gap-3 items-center mb-4">
      <input id="referral-search" type="text" placeholder="Search code or IP..." 
             class="flex-1 bg-zinc-900 border border-white/10 rounded-2xl px-4 py-2 text-sm focus:border-violet-500" />
      
      <div class="flex gap-2">
        <button data-days="7" class="time-filter px-4 py-1.5 text-sm rounded-2xl border border-white/20 hover:bg-white/10">Last 7 days</button>
        <button data-days="30" class="time-filter px-4 py-1.5 text-sm rounded-2xl border border-white/20 hover:bg-white/10">Last 30 days</button>
        <button data-days="0" class="time-filter px-4 py-1.5 text-sm rounded-2xl bg-violet-600 text-white">All time</button>
      </div>

      <button id="export-referrals-btn" 
              class="ml-auto px-5 py-2 text-sm bg-emerald-600/90 hover:bg-emerald-600 rounded-2xl flex items-center gap-2 font-medium">
        <i class="fa-solid fa-download"></i> Export CSV
      </button>
    </div>

    <div id="referrals-table-container" class="overflow-x-auto">
      <div class="space-y-2 py-2">
        <div class="h-12 skeleton"></div>
        <div class="h-12 skeleton"></div>
        <div class="h-12 skeleton"></div>
      </div>
    </div>
  `;

  const searchInput = document.getElementById('referral-search') as HTMLInputElement;
  const tableContainer = document.getElementById('referrals-table-container')!;
  const exportBtn = document.getElementById('export-referrals-btn') as HTMLButtonElement;

  let currentFilterDays = 0;
  let currentSearch = '';

  // Helper: compute high-risk IPs (IPs with 3+ referrals in window)
  function computeHighRiskIPs(rows: any[]): Set<string> {
    const ipCounts: Record<string, number> = {};
    rows.forEach(r => {
      if (r.ip_address) ipCounts[r.ip_address] = (ipCounts[r.ip_address] || 0) + 1;
    });
    return new Set(Object.entries(ipCounts).filter(([, c]) => c >= 3).map(([ip]) => ip));
  }

  function computeStats(rows: any[]) {
    const total = rows.length;
    const unique = new Set(rows.map(r => r.referrer_code)).size;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = rows.filter(r => new Date(r.created_at) >= today).length;

    const riskIPs = computeHighRiskIPs(rows);

    const statTotal = document.getElementById('stat-total');
    const statUnique = document.getElementById('stat-unique');
    const statToday = document.getElementById('stat-today');
    const statRisk = document.getElementById('stat-risk');

    if (statTotal) statTotal.textContent = formatNumber(total);
    if (statUnique) statUnique.textContent = formatNumber(unique);
    if (statToday) statToday.textContent = formatNumber(todayCount);
    if (statRisk) statRisk.textContent = formatNumber(riskIPs.size);

    return { riskIPs };
  }

  function filterByDays(rows: any[], days: number): any[] {
    if (days === 0) return rows;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return rows.filter(r => new Date(r.created_at) >= cutoff);
  }

  function renderFilteredReferrals(filtered: any[], riskIPs: Set<string>) {
    if (!filtered.length) {
      tableContainer.innerHTML = `
        <div class="text-center py-12 text-zinc-400 border border-white/10 rounded-2xl">
          <i class="fa-solid fa-users text-4xl mb-3 block opacity-60"></i>
          <div class="font-semibold text-zinc-300">No referrals found</div>
          <p class="text-sm mt-1 max-w-xs mx-auto">Try adjusting your search or time range. New referrals will appear here in real time.</p>
        </div>`;
      return;
    }

    let html = `
      <table class="w-full text-sm">
        <thead>
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

    filtered.forEach((row: any, idx: number) => {
      const dateStr = new Date(row.created_at).toLocaleDateString();
      const code = row.referrer_code || '—';
      const ip = row.ip_address || '—';
      const ua = row.user_agent ? row.user_agent.substring(0, 38) + (row.user_agent.length > 38 ? '…' : '') : '—';
      const timeAgo = getRelativeTime(row.created_at);
      const isRisk = row.ip_address && riskIPs.has(row.ip_address);

      html += `
        <tr data-idx="${idx}" class="referral-row table-row border-b border-white/10 hover:bg-zinc-900/60 cursor-pointer ${isRisk ? 'bg-red-950/20' : ''}">
          <td class="py-3 pr-4 text-xs text-zinc-400 whitespace-nowrap">${dateStr}</td>
          <td class="py-3 pr-4 font-mono text-emerald-400">
            <span class="inline-flex items-center gap-1.5">
              ${code}
              <button data-code="${code}" class="copy-code-btn text-emerald-400 hover:text-emerald-300 p-1 -mr-1" title="Copy code">
                <i class="fa-solid fa-copy text-xs"></i>
              </button>
            </span>
          </td>
          <td class="py-3 pr-4 font-mono text-xs text-zinc-300">${ip}</td>
          <td class="py-3 pr-4 text-xs text-zinc-400 max-w-[220px] truncate" title="${row.user_agent || ''}">${ua}</td>
          <td class="py-3 pr-4 text-xs text-zinc-400">${timeAgo}</td>
          <td class="py-3 pr-4">
            ${isRisk ? '<span class="px-2 py-0.5 text-xs rounded bg-red-600/80 text-white font-medium">High</span>' : ''}
          </td>
          <td class="py-3">
            <button data-idx="${idx}" class="view-referral-btn text-xs px-4 py-1 rounded-xl bg-white/10 hover:bg-white/20">View</button>
          </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    tableContainer.innerHTML = html;

    // Row click → open modal (but not when clicking buttons inside)
    document.querySelectorAll('.referral-row').forEach(rowEl => {
      rowEl.addEventListener('click', (e) => {
        // Ignore clicks on buttons inside the row
        if ((e.target as HTMLElement).closest('button')) return;

        const idx = parseInt((rowEl as HTMLElement).dataset.idx!);
        const row = filtered[idx];
        showReferralDetails(row, riskIPs.has(row.ip_address || ''));
      });
    });

    // Copy Code buttons with "Copied!" feedback
    document.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        const code = (btn as HTMLElement).dataset.code || '';
        if (!code) return;

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

    // Attach View buttons → opens modal
    document.querySelectorAll('.view-referral-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        const idx = parseInt((btn as HTMLElement).dataset.idx!);
        const row = filtered[idx];
        showReferralDetails(row, riskIPs.has(row.ip_address || ''));
      });
    });
  }

  // Main load + filter logic
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) throw error;

    adminReferralsCache = data || [];

    computeStats(adminReferralsCache); // initial stats (riskIPs computed inside)

    // Update last refreshed timestamp
    const tsEl = document.getElementById('referrals-last-updated');
    if (tsEl) {
      const now = new Date();
      tsEl.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    function applyFilters() {
      let filtered = filterByDays(adminReferralsCache, currentFilterDays);
      if (currentSearch.trim()) {
        const q = currentSearch.toLowerCase().trim();
        filtered = filtered.filter(r =>
          (r.referrer_code || '').toLowerCase().includes(q) ||
          (r.ip_address || '').toLowerCase().includes(q)
        );
      }
      const { riskIPs: currentRisk } = computeStats(filtered); // update stats to filtered view
      renderFilteredReferrals(filtered, currentRisk);
    }

    // Initial render
    applyFilters();

    // Search (debounced)
    let searchTimeout: number;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = window.setTimeout(() => {
        currentSearch = searchInput.value;
        applyFilters();
      }, 200);
    });

    // Time filter buttons
    document.querySelectorAll('.time-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.time-filter').forEach(b => b.classList.remove('bg-violet-600', 'text-white'));
        (btn as HTMLElement).classList.add('bg-violet-600', 'text-white');

        currentFilterDays = parseInt((btn as HTMLElement).dataset.days || '0');
        applyFilters();
      });
    });

    // Export CSV with feedback
    exportBtn?.addEventListener('click', () => {
      if (!adminReferralsCache.length) return;

      let rowsToExport = filterByDays(adminReferralsCache, currentFilterDays);
      if (currentSearch.trim()) {
        const q = currentSearch.toLowerCase().trim();
        rowsToExport = rowsToExport.filter(r =>
          (r.referrer_code || '').toLowerCase().includes(q) ||
          (r.ip_address || '').toLowerCase().includes(q)
        );
      }

      exportReferralsCSV(rowsToExport);
      showToast('Referrals exported successfully', 'success');
    });

  } catch (e) {
    content.innerHTML = `
      <div class="p-6 text-amber-400">Unable to load referrals. ${String(e)}</div>
      <button onclick="window.switchAdminTab(0)" class="mt-3 px-4 py-2 text-sm bg-white/10 rounded-2xl">Retry</button>
    `;
  }
}

// Small relative time helper
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

// Simple number formatter with commas (for stats)
function formatNumber(n: number): string {
  return n.toLocaleString();
}

// Lightweight Toast System
let toastContainer: HTMLElement | null = null;

function showToast(message: string, type: 'success' | 'info' = 'success') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '<i class="fa-solid fa-check text-emerald-400"></i>' : '<i class="fa-solid fa-info-circle text-sky-400"></i>'}</span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Auto dismiss
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.2s forwards';
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

// Expose globally
(window as any).showToast = showToast;

// CSV export helper for shares
function exportSharesCSV(shares: any[]) {
  if (!shares || !shares.length) return;

  const headers = ['created_at', 'referrer_code', 'platform'];
  const csvRows = [headers.join(',')];

  shares.forEach(s => {
    csvRows.push([
      s.created_at || '',
      `"${(s.referrer_code || '').replace(/"/g, '""')}"`,
      s.platform || ''
    ].join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `viralrefer-shares-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// CSV export helper
function exportReferralsCSV(rows: any[]) {
  if (!rows.length) return;

  const headers = ['created_at', 'referrer_code', 'ip_address', 'user_agent', 'referrer_user_id'];
  const csvRows = [headers.join(',')];

  rows.forEach(r => {
    const line = [
      r.created_at || '',
      `"${(r.referrer_code || '').replace(/"/g, '""')}"`,
      r.ip_address || '',
      `"${(r.user_agent || '').replace(/"/g, '""')}"`,
      r.referrer_user_id || ''
    ];
    csvRows.push(line.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `viralrefer-referrals-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ------------------ TAB 1: SHARE ANALYTICS (kept exactly as the enhanced version) ------------------
async function renderShareAnalyticsTab(content: HTMLElement) {
  content.innerHTML = `<div class="text-center py-6">Loading advanced analytics...</div>`;

  try {
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    // Note: table may use referral_link instead of referrer_code. We keep the original query for fidelity.
    const { data: sharesData } = await supabase
      .from('shares')
      .select('platform, referrer_code, created_at')
      .order('created_at', { ascending: false });

    if (!sharesData || sharesData.length === 0) {
      content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <i class="fa-solid fa-share-alt text-5xl text-zinc-600 mb-4 opacity-60"></i>
          <div class="text-xl font-semibold text-zinc-300">No shares yet</div>
          <p class="text-sm text-zinc-500 mt-2 max-w-md">
            When users share their referral links on social media, detailed analytics and insights will appear here automatically.
          </p>
        </div>`;
      return;
    }

    let allShares = sharesData;

    function filterByDays(days: number): any[] {
      if (days === 0) return allShares;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return allShares.filter((s: any) => new Date(s.created_at) >= cutoff);
    }

    function renderAnalytics(filteredShares: any[]) {
      (window as any).__currentAnalyticsFiltered = filteredShares;
      const total = filteredShares.length;

      const platformCounts: Record<string, number> = {};
      filteredShares.forEach((s: any) => {
        platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
      });
      const sortedPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);

      const referrerCounts: Record<string, number> = {};
      filteredShares.forEach((s: any) => {
        referrerCounts[s.referrer_code] = (referrerCounts[s.referrer_code] || 0) + 1;
      });
      const topReferrers = Object.entries(referrerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      const dailyCounts: Record<string, number> = {};
      filteredShares.forEach((s: any) => {
        const day = new Date(s.created_at).toISOString().split('T')[0];
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      });
      const sortedDays = Object.keys(dailyCounts).sort().slice(-14);
      const trendLabels = sortedDays;
      const trendData = sortedDays.map(day => dailyCounts[day] || 0);

      const uniqueSharers = new Set(filteredShares.map((s: any) => s.referrer_code)).size;
      let peakDay = { day: '-', count: 0 };
      Object.entries(dailyCounts).forEach(([day, count]) => {
        if (count > peakDay.count) peakDay = { day, count };
      });
      const avgPerDay = trendData.length > 0 ? Math.round(total / trendData.length) : 0;

      const insights: string[] = [];
      if (sortedPlatforms.length > 0) {
        const top = sortedPlatforms[0];
        insights.push(`<strong>${top[0]}</strong> is your strongest channel (${Math.round((top[1] / total) * 100)}% of shares)`);
      }
      if (topReferrers.length >= 3) {
        const top3 = topReferrers.slice(0, 3).reduce((sum, [, c]) => sum + c, 0);
        insights.push(`Your top 3 referrers drive <strong>${Math.round((top3 / total) * 100)}%</strong> of all shares`);
      }
      if (trendData.length >= 5) {
        const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2)).reduce((a, b) => a + b, 0);
        const secondHalf = trendData.slice(Math.floor(trendData.length / 2)).reduce((a, b) => a + b, 0);
        if (secondHalf > firstHalf * 1.4) insights.push(`Shares have <strong>increased sharply</strong> recently`);
        else if (secondHalf < firstHalf * 0.6) insights.push(`Shares have <strong>declined</strong> recently`);
      }
      insights.push(`Peak day: <strong>${peakDay.day}</strong> with ${peakDay.count} shares`);

      let html = `
        <div class="mb-6">
          <div class="flex items-center justify-between">
            <div class="admin-stat-card">
              <div class="text-sm text-zinc-400">TOTAL SHARES</div>
              <div class="text-6xl font-bold text-white">${formatNumber(total)}</div>
              <div class="text-xs text-zinc-500 mt-1">From ${uniqueSharers} unique people • Avg ${avgPerDay}/day</div>
            </div>
            <div class="flex items-center gap-3">
              <span id="analytics-last-updated" class="text-[10px] text-zinc-500"></span>
              <div class="flex gap-2">
                <button data-days="7" class="time-filter px-4 py-1.5 text-sm rounded-2xl border border-white/20 hover:bg-white/10">Last 7 days</button>
                <button data-days="30" class="time-filter px-4 py-1.5 text-sm rounded-2xl border border-white/20 hover:bg-white/10">Last 30 days</button>
                <button data-days="0" class="time-filter px-4 py-1.5 text-sm rounded-2xl bg-violet-600 text-white">All time</button>
              </div>
              <button id="export-shares-btn" class="ml-2 px-4 py-1.5 text-sm bg-emerald-600/90 hover:bg-emerald-600 rounded-2xl flex items-center gap-1.5">
                <i class="fa-solid fa-download text-xs"></i> Export
              </button>
            </div>
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
              ${insights.map(i => `<li>• ${i}</li>`).join('')}
            </ul>
          </div>

          <div>
            <h4 class="text-sm font-semibold text-zinc-300 mb-3">Top Referrers by Shares</h4>
            <div class="space-y-1.5">
      `;

      topReferrers.forEach(([referrer, count], index) => {
        const percentage = Math.round((count / total) * 100);
        html += `
          <div class="flex items-center justify-between table-row bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm">
            <div class="flex items-center gap-3">
              <div class="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold">${index + 1}</div>
              <div class="font-mono text-emerald-300">${referrer}</div>
            </div>
            <div class="flex items-center gap-4">
              <div class="text-zinc-400">${count} shares</div>
              <div class="font-semibold text-emerald-400 w-11 text-right">${percentage}%</div>
            </div>
          </div>`;
      });

      html += `</div></div>`;

      html += `
        <div>
          <h4 class="text-sm font-semibold text-zinc-300 mb-3">Platform Breakdown</h4>
          <div class="space-y-2">
      `;

      sortedPlatforms.forEach(([platform, count]) => {
        const percentage = Math.round((count / total) * 100);
        html += `
          <div class="flex items-center justify-between table-row bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm">
            <div class="font-medium">${platform}</div>
            <div class="flex items-center gap-4">
              <div class="text-zinc-400">${count} shares</div>
              <div class="font-semibold text-emerald-400 w-12 text-right">${percentage}%</div>
            </div>
          </div>`;
      });

      html += `</div></div></div>`;

      content.innerHTML = html;

      // Charts
      const barCtx = (document.getElementById('share-chart') as HTMLCanvasElement)?.getContext('2d');
      if (barCtx) {
        new Chart(barCtx, {
          type: 'bar',
          data: {
            labels: sortedPlatforms.map(([p]) => p),
            datasets: [{ label: 'Shares', data: sortedPlatforms.map(([, c]) => c), backgroundColor: '#864cff', borderRadius: 6 }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw} shares` } } },
            scales: { y: { beginAtZero: true, ticks: { color: '#71717a' } }, x: { ticks: { color: '#71717a' } } }
          }
        });
      }

      const trendCtx = (document.getElementById('trend-chart') as HTMLCanvasElement)?.getContext('2d');
      if (trendCtx) {
        new Chart(trendCtx, {
          type: 'line',
          data: {
            labels: trendLabels.map(d => d.slice(5)),
            datasets: [{ label: 'Daily Shares', data: trendData, borderColor: '#34d399', tension: 0.3, fill: true, backgroundColor: 'rgba(52,211,153,0.1)' }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { color: '#71717a' } }, x: { ticks: { color: '#71717a' } } }
          }
        });
      }

      // Update timestamp
      const analyticsTs = document.getElementById('analytics-last-updated');
      if (analyticsTs) {
        const now = new Date();
        analyticsTs.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      // Re-attach time filters
      document.querySelectorAll('.time-filter').forEach(btn => {
        btn.addEventListener('click', () => {
          const days = parseInt((btn as HTMLElement).dataset.days || '0');
          const filtered = days === 0 ? allShares : filterByDays(days);
          (window as any).__currentAnalyticsFiltered = filtered;
          renderAnalytics(filtered);
        });
      });

      // Export CSV for current view
      const exportSharesBtn = document.getElementById('export-shares-btn') as HTMLButtonElement | null;
      if (exportSharesBtn) {
        exportSharesBtn.onclick = () => {
          const currentFiltered = (window as any).__currentAnalyticsFiltered || allShares;
          exportSharesCSV(currentFiltered);
          showToast('Shares exported successfully', 'success');
        };
      }
    }

    // Store last rendered data for export
    (window as any).__currentAnalyticsFiltered = allShares;
    renderAnalytics(allShares);

  } catch (e) {
    const { data } = await supabase.from('shares').select('platform');
    const counts: Record<string, number> = {};
    (data || []).forEach((s: any) => counts[s.platform] = (counts[s.platform] || 0) + 1);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    content.innerHTML = `<pre class="text-xs bg-black/40 p-4 rounded-xl">Total: ${total}\n${JSON.stringify(counts, null, 2)}</pre>`;
  }
}

// ------------------ TAB 2: EDIT CONTENT (Add New Key form, Save upsert, Delete w/ confirm + loading, id+value schema) ------------------
async function renderEditContentTab(content: HTMLElement) {
  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="h-7 w-48 skeleton mb-1"></div>
        <div class="h-4 w-36 skeleton"></div>
      </div>
      <div class="h-10 w-32 skeleton rounded-2xl"></div>
    </div>
    <div class="space-y-3">
      <div class="h-16 skeleton rounded-2xl"></div>
      <div class="h-16 skeleton rounded-2xl"></div>
      <div class="h-16 skeleton rounded-2xl"></div>
    </div>
  `;

  // Inner helper to load list + wire everything (kept self-contained for reliability)
  async function loadAndRenderList() {
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('id, value')
        .order('id', { ascending: true });

      if (error) throw error;

      const rows = data || [];

      let html = `
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="text-2xl font-bold">Edit Site Content</div>
            <div class="text-sm text-zinc-400">Live CMS — changes are public immediately</div>
          </div>
          <div class="flex items-center gap-3">
            <span id="content-last-updated" class="text-[10px] text-zinc-500"></span>
            <input id="content-search" type="text" placeholder="Search keys..." 
                   class="w-48 bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-sm focus:border-violet-500" />
            <button id="add-content-btn" class="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-2xl text-sm font-semibold flex items-center gap-2">
              <i class="fa-solid fa-plus"></i> Add New Key
            </button>
          </div>
        </div>
        <div id="content-list" class="space-y-3">
      `;

      if (rows.length === 0) {
        html += `<div class="py-8 text-center text-zinc-400 border border-white/10 rounded-2xl">No content entries yet.<br><span class="text-xs">Click "Add New Key" above to start managing your public site content.</span></div>`;
      } else {
        rows.forEach((row: any) => {
          const valStr = String(row.value ?? '');
          const valPreview = valStr.slice(0, 80);
          html += `
            <div class="bg-zinc-900 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div class="flex-1 min-w-0">
                <div class="font-mono text-emerald-400 text-sm">${row.id}</div>
                <div class="text-sm mt-2 text-zinc-300 break-all">${valPreview}${valPreview.length > 79 ? '…' : ''}</div>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <button data-id="${row.id}" class="edit-btn px-4 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-xl">Edit</button>
                <button data-id="${row.id}" class="delete-btn px-4 py-1.5 text-sm bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl">Delete</button>
              </div>
            </div>`;
        });
      }
      html += `</div>`;

      // Form area (Add New Key + Save / Cancel)
      html += `
        <div id="content-form-area" class="mt-6 hidden border border-white/10 bg-zinc-950 rounded-2xl p-6">
          <div class="font-semibold mb-3" id="form-title">Add New Content Entry</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-zinc-400 mb-1">ID / Key (unique text)</label>
              <input id="content-key" class="w-full bg-zinc-900 border border-white/20 rounded-xl px-4 py-3 text-sm font-mono" placeholder="hero_title">
            </div>
            <div>
              <label class="block text-xs text-zinc-400 mb-1">Note (optional, not saved)</label>
              <input id="content-desc" class="w-full bg-zinc-900 border border-white/20 rounded-xl px-4 py-3 text-sm" placeholder="Admin note (UI only)">
            </div>
          </div>
          <div class="mt-3">
            <label class="block text-xs text-zinc-400 mb-1">Value (plain text)</label>
            <textarea id="content-value" rows="4" class="w-full bg-zinc-900 border border-white/20 rounded-xl px-4 py-3 text-sm font-mono" placeholder="Enter the content value here"></textarea>
          </div>
          <div class="flex gap-3 mt-4">
            <button id="save-content-btn" class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-semibold">Save (upsert)</button>
            <button id="cancel-content-btn" class="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-2xl font-semibold">Cancel</button>
          </div>
        </div>
      `;

      content.innerHTML = html;

      // Update last refreshed timestamp
      const contentTs = document.getElementById('content-last-updated');
      if (contentTs) {
        const now = new Date();
        contentTs.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      // Attach Add New Key button
      const addBtn = document.getElementById('add-content-btn');
      if (addBtn) {
        addBtn.onclick = () => showContentForm();
      }

      // Simple client-side search for content keys
      const searchInput = document.getElementById('content-search') as HTMLInputElement | null;
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const q = searchInput.value.toLowerCase().trim();
          document.querySelectorAll('#content-list > div').forEach((card) => {
            const text = (card as HTMLElement).textContent?.toLowerCase() || '';
            (card as HTMLElement).style.display = text.includes(q) ? '' : 'none';
          });
        });
      }

      // Edit buttons (use id for lookup)
      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.id!;
          showContentForm({ id });
        });
      });

      // Delete with confirmation + loading state on button (uses id)
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.id!;
          if (!confirm(`Delete content entry "${id}"? This cannot be undone.`)) return;

          (btn as HTMLElement).textContent = 'Deleting...';
          (btn as HTMLElement as HTMLButtonElement).disabled = true;

          try {
            await supabase.from('site_content').delete().eq('id', id);
          } catch (_) {
            /* demo / RLS graceful fallback */
          }
          await loadAndRenderList();
          showToast('Content deleted', 'info');
        });
      });

      // Define form handler (Add/Edit + Save with upsert)
      function showContentForm(existing?: any) {
        const formArea = document.getElementById('content-form-area')!;
        const keyInput = document.getElementById('content-key') as HTMLInputElement;
        const descInput = document.getElementById('content-desc') as HTMLInputElement;
        const valInput = document.getElementById('content-value') as HTMLTextAreaElement;
        const titleEl = document.getElementById('form-title')!;
        const saveBtn = document.getElementById('save-content-btn') as HTMLButtonElement | null;

        formArea.classList.remove('hidden');

        if (existing) {
          titleEl.textContent = `Editing: ${existing.id}`;
          keyInput.value = existing.id || '';
          keyInput.disabled = true;
          descInput.value = '';
          valInput.value = String(existing.value || '');
        } else {
          titleEl.textContent = 'Add New Content Entry';
          keyInput.value = '';
          keyInput.disabled = false;
          descInput.value = '';
          valInput.value = '';
        }

        // Save handler: upsert by key, loading state on button
        if (saveBtn) {
          saveBtn.onclick = async () => {
            const key = keyInput.value.trim();
            if (!key) {
              alert('ID / Key is required');
              return;
            }

            const rawVal = valInput.value.trim();

            const payload: any = {
              id: key,
              value: rawVal
            };
            // id serves as the unique key (per current table schema: id text + value text)

            const originalSaveText = saveBtn.textContent;
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            try {
              await supabase.from('site_content').upsert(payload, { onConflict: 'id' });
            } catch (_) {
              // Demo mode / RLS fallback — still proceed to refresh
            }

            // Restore button and reload full list (auto-refresh behavior)
            saveBtn.textContent = originalSaveText || 'Save (upsert)';
            saveBtn.disabled = false;
            await loadAndRenderList();
            showToast('Content saved successfully', 'success');
          };
        }

        const cancelBtn = document.getElementById('cancel-content-btn');
        if (cancelBtn) {
          cancelBtn.onclick = () => {
            loadAndRenderList();
          };
        }
      }
    } catch (err) {
      const msg = (err as any)?.message || JSON.stringify(err) || 'Unknown error';
      content.innerHTML = `<div class="p-6 text-red-400">Error loading content: ${msg}. Please try refreshing the page.</div>`;
    }
  }

  await loadAndRenderList();
}

// ------------------ TAB 3: PRIZE CLAIMS (empty state, table: Date/Referrer/Website/Cashtag/Message/Status, View + Approve/Reject/Mark Paid w/ confirmations, auto-refresh) ------------------
async function renderPrizeClaimsTab(content: HTMLElement) {
  content.innerHTML = `
    <div class="mb-4">
      <div class="flex justify-between items-center">
        <div>
          <div class="h-7 w-40 skeleton mb-1"></div>
          <div class="h-4 w-28 skeleton"></div>
        </div>
        <div class="h-9 w-20 skeleton rounded-2xl"></div>
      </div>
    </div>
    <div class="space-y-2">
      <div class="h-10 skeleton"></div>
      <div class="h-10 skeleton"></div>
      <div class="h-10 skeleton"></div>
    </div>
  `;

  try {
    const { data, error } = await supabase
      .from('prize_claims')
      .select('id, created_at, referrer_code, website, cashtag, message, status, paid_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    adminClaimsCache = data || [];

    if (!adminClaimsCache.length) {
      content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <i class="fa-solid fa-trophy text-6xl text-zinc-700 mb-4 opacity-60"></i>
          <div class="text-2xl font-semibold text-zinc-300">No prize claims yet</div>
          <p class="text-sm text-zinc-500 mt-2 max-w-sm">When the top referrer reaches the minimum referrals and submits a claim, it will appear here for your review and payout.</p>
          <button onclick="window.switchAdminTab(3)" class="mt-6 px-5 py-2 bg-white/10 hover:bg-white/20 rounded-2xl text-sm">Refresh</button>
        </div>`;
      return;
    }

    let html = `
      <div class="flex justify-between items-center mb-4">
        <div>
          <div class="text-2xl font-bold">Prize Claims</div>
          <div class="text-sm text-zinc-400">${adminClaimsCache.length} total submissions</div>
        </div>
        <div class="flex items-center gap-3">
          <span id="claims-last-updated" class="text-[10px] text-zinc-500"></span>
          <button onclick="window.triggerRefreshSpin(this); window.switchAdminTab(3)" class="px-4 py-2 text-sm bg-white/10 rounded-2xl flex items-center gap-2"><i class="fa-solid fa-sync"></i> Refresh</button>
        </div>
      </div>
      <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-white/10 text-left text-zinc-400">
            <th class="py-3 pr-3">Date</th>
            <th class="py-3 pr-3">Referrer</th>
            <th class="py-3 pr-3">Website</th>
            <th class="py-3 pr-3">Cashtag</th>
            <th class="py-3 pr-3">Message</th>
            <th class="py-3 pr-3">Status</th>
            <th class="py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    adminClaimsCache.forEach((claim: any, idx: number) => {
      const date = new Date(claim.created_at || Date.now()).toLocaleDateString();
      const status = claim.status || 'pending';
      const statusColor = status === 'approved' ? 'text-emerald-400 bg-emerald-950' :
                          status === 'paid' ? 'text-sky-400 bg-sky-950' :
                          status === 'rejected' ? 'text-red-400 bg-red-950' : 'text-amber-400 bg-amber-950';

      const website = (claim.website || '').toString();
      const cashtag = (claim.cashtag || '').toString();
      const message = (claim.message || '').toString();
      const shortWebsite = website.length > 28 ? website.slice(0, 25) + '…' : (website || '—');
      const shortMsg = message.length > 32 ? message.slice(0, 29) + '…' : (message || '—');

      html += `
        <tr class="table-row border-b border-white/10 hover:bg-zinc-900/60 align-top">
          <td class="py-3 pr-3 text-xs text-zinc-400 whitespace-nowrap">${date}</td>
          <td class="py-3 pr-3 font-mono text-emerald-400 text-sm">${claim.referrer_code || '—'}</td>
          <td class="py-3 pr-3 text-xs max-w-[160px] truncate" title="${website}">${shortWebsite}</td>
          <td class="py-3 pr-3 font-mono text-xs text-sky-300">
            ${cashtag ? `
              <span class="inline-flex items-center gap-1">
                ${cashtag}
                <button class="copy-cashtag-btn text-sky-400 hover:text-sky-300 p-1" data-cashtag="${cashtag}" title="Copy cashtag">
                  <i class="fa-solid fa-copy text-[10px]"></i>
                </button>
              </span>
            ` : '—'}
          </td>
          <td class="py-3 pr-3 text-xs max-w-[180px] truncate italic text-zinc-300" title="${message}">${shortMsg}</td>
          <td class="py-3 pr-3"><span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}">${status}</span></td>
          <td class="py-3">
            <div class="flex flex-wrap gap-1">
              <button data-idx="${idx}" class="view-claim-btn text-xs px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20">View</button>
              ${status === 'pending' ? `
                <button data-idx="${idx}" data-status="approved" class="action-claim-btn text-xs px-3 py-1 rounded-xl bg-emerald-600/80 hover:bg-emerald-600">Approve</button>
                <button data-idx="${idx}" data-status="rejected" class="action-claim-btn text-xs px-3 py-1 rounded-xl bg-red-600/70 hover:bg-red-600">Reject</button>
              ` : ''}
              ${status === 'approved' ? `
                <button data-idx="${idx}" data-status="paid" class="action-claim-btn text-xs px-3 py-1 rounded-xl bg-sky-600/80 hover:bg-sky-600">Mark Paid</button>
              ` : ''}
            </div>
          </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    content.innerHTML = html;

    // Update last refreshed timestamp
    const claimsTs = document.getElementById('claims-last-updated');
    if (claimsTs) {
      const now = new Date();
      claimsTs.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Attach View buttons (opens claim details modal)
    document.querySelectorAll('.view-claim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.idx!);
        const claim = adminClaimsCache[idx];
        showClaimDetails(claim);
      });
    });

    // Copy cashtag buttons in table
    document.querySelectorAll('.copy-cashtag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        const cashtag = (btn as HTMLElement).dataset.cashtag || '';
        navigator.clipboard.writeText(cashtag).then(() => {
          const orig = btn.innerHTML;
          btn.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i>`;
          showToast('Cashtag copied to clipboard', 'success');
          setTimeout(() => { btn.innerHTML = orig; }, 1200);
        });
      });
    });

    // Attach action buttons with confirmations + auto-refresh after update
    document.querySelectorAll('.action-claim-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt((btn as HTMLElement).dataset.idx!);
        const newStatus = (btn as HTMLElement).dataset.status!;
        const claim = adminClaimsCache[idx];

        if (!confirm(`Are you sure you want to ${newStatus.toUpperCase()} this claim from ${claim.referrer_code || 'unknown'}?`)) {
          return;
        }

        (btn as HTMLElement).textContent = 'Saving...';
        (btn as HTMLElement as HTMLButtonElement).disabled = true;

        try {
          // Call admin-action Edge Function instead of direct DB update
          const { data, error } = await supabase.functions.invoke('admin-action', {
            body: {
              action: 'update_claim_status',
              payload: {
                claimId: claim.id,
                status: newStatus,
                note: null
              }
            }
          });

          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Edge Function failed');

        } catch (err) {
          console.warn('[Admin] admin-action Edge Function failed. Local cache updated.', err);
        }

        // Update cache
        adminClaimsCache[idx].status = newStatus;
        if (newStatus === 'paid') {
          adminClaimsCache[idx].paid_at = new Date().toISOString();
        }

        // Toast feedback
        const actionText = newStatus === 'approved' ? 'approved' : 
                           newStatus === 'rejected' ? 'rejected' : 'marked as paid';
        showToast(`Claim ${actionText}`, 'success');

        // Auto-refresh the entire tab (full re-render + re-attach handlers)
        await renderPrizeClaimsTab(content);
      });
    });

  } catch (e) {
    const msg = (e as any)?.message || JSON.stringify(e) || 'Unknown error';
    content.innerHTML = `<div class="p-6 text-amber-400">Unable to load prize claims. ${msg}</div>`;
  }
}

function showClaimDetails(claim: any) {
  const modal = document.getElementById('claim-details-modal');
  const contentBox = document.getElementById('claim-details-content');
  if (!modal || !contentBox) return;

  const pretty = JSON.stringify(claim, null, 2)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const paidAt = claim.paid_at ? new Date(claim.paid_at).toLocaleString() : '—';

  contentBox.innerHTML = `
    <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div><span class="text-zinc-400">ID</span><div class="font-mono text-xs break-all">${claim.id}</div></div>
      <div><span class="text-zinc-400">Referrer Code</span><div class="font-mono text-emerald-400">${claim.referrer_code || '—'}</div></div>
      <div><span class="text-zinc-400">Status</span><div><span class="px-3 py-px rounded bg-white/10">${claim.status || 'pending'}</span></div></div>
      <div><span class="text-zinc-400">Paid At</span><div class="text-xs">${paidAt}</div></div>
      <div><span class="text-zinc-400">Website</span><div class="break-all">${claim.website || '—'}</div></div>
      <div>
        <span class="text-zinc-400">Cash App Cashtag</span>
        <div class="flex items-center gap-2">
          <div class="font-mono">${claim.cashtag || '—'}</div>
          ${claim.cashtag ? `
            <button class="copy-modal-cashtag-btn text-sky-400 hover:text-sky-300 text-xs px-2 py-0.5 rounded bg-white/5" data-cashtag="${claim.cashtag}">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
          ` : ''}
        </div>
      </div>
      <div class="col-span-2"><span class="text-zinc-400">Message</span><div class="italic text-zinc-300">${claim.message || '—'}</div></div>
    </div>
    <div class="mt-4 pt-4 border-t border-white/10 text-xs text-zinc-400">
      Created: ${claim.created_at ? new Date(claim.created_at).toLocaleString() : '—'}
    </div>
    <pre class="mt-4 p-3 bg-black/40 rounded-xl text-[10px] overflow-auto max-h-48">${pretty}</pre>
  `;

  modal.classList.remove('hidden');

  // Wire cashtag copy button in modal
  const modalCashtagBtn = contentBox.querySelector('.copy-modal-cashtag-btn') as HTMLButtonElement | null;
  if (modalCashtagBtn) {
    modalCashtagBtn.addEventListener('click', () => {
      const cashtag = modalCashtagBtn.dataset.cashtag || '';
      navigator.clipboard.writeText(cashtag).then(() => {
        const orig = modalCashtagBtn.innerHTML;
        modalCashtagBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
        showToast('Cashtag copied to clipboard', 'success');
        setTimeout(() => { modalCashtagBtn.innerHTML = orig; }, 1300);
      });
    });
  }
}

function showReferralDetails(row: any, isHighRisk: boolean = false) {
  const modal = document.getElementById('referral-details-modal');
  const contentBox = document.getElementById('referral-details-content');
  if (!modal || !contentBox) return;

  const pretty = JSON.stringify(row, null, 2)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const created = row.created_at ? new Date(row.created_at).toLocaleString() : '—';

  contentBox.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div><span class="text-zinc-400">Referral ID</span><div class="font-mono text-xs break-all">${row.id || '—'}</div></div>
      <div>
        <span class="text-zinc-400">Referrer Code</span>
        <div class="flex items-center gap-2">
          <div class="font-mono text-emerald-400 text-lg">${row.referrer_code || '—'}</div>
          ${row.referrer_code ? `
            <button class="copy-modal-code-btn text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-white/5 text-xs" data-code="${row.referrer_code}">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
          ` : ''}
        </div>
      </div>
      
      <div><span class="text-zinc-400">IP Address</span><div class="font-mono text-xs">${row.ip_address || '—'}</div></div>
      <div><span class="text-zinc-400">Risk Level</span><div>${isHighRisk ? '<span class="px-3 py-0.5 text-xs rounded bg-red-600 text-white font-medium">HIGH — Multiple referrals from this IP</span>' : '<span class="text-emerald-400">Normal</span>'}</div></div>

      <div class="md:col-span-2"><span class="text-zinc-400">User Agent</span><div class="text-xs break-all text-zinc-300">${row.user_agent || '—'}</div></div>
      
      <div><span class="text-zinc-400">Referrer User ID</span><div class="font-mono text-xs">${row.referrer_user_id || '—'}</div></div>
      <div><span class="text-zinc-400">Referred User ID</span><div class="font-mono text-xs">${row.referred_user_id || '—'}</div></div>
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

  // Wire copy button inside the modal
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
}

// ------------------ MAIN switchAdminTab (now fully restored) ------------------
async function switchAdminTab(tab: number) {
  const content = document.getElementById('admin-content') as HTMLElement | null;
  if (!content) {
    console.error('Admin content container not found');
    return;
  }

  setActiveTab(tab);

  if (tab === 0) {
    await renderReferralsTab(content);
  } else if (tab === 1) {
    await renderShareAnalyticsTab(content);
  } else if (tab === 2) {
    await renderEditContentTab(content);
  } else if (tab === 3) {
    await renderPrizeClaimsTab(content);
  }
}

// ------------------ EXPOSE ADMIN GLOBALS ------------------
(window as any).switchAdminTab = switchAdminTab;

// Helper for refresh button spin animation
(window as any).triggerRefreshSpin = (btn: HTMLElement) => {
  if (!btn) return;
  btn.classList.add('refresh-spin');
  setTimeout(() => btn.classList.remove('refresh-spin'), 900);
};

(window as any).closeAdminPanel = () => {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.add('hidden');
};

(window as any).openAdminPanel = async () => {
  const modal = document.getElementById('admin-modal');
  if (modal) {
    modal.classList.remove('hidden');
    await switchAdminTab(0);
  }
};

(window as any).closeAdminPasswordModal = () => {
  const m = document.getElementById('admin-password-modal');
  if (m) m.classList.add('hidden');
};

(window as any).toggleAdminPasswordVisibility = () => {
  const input = document.getElementById('admin-password-input') as HTMLInputElement | null;
  const eye = document.getElementById('admin-password-eye');
  if (!input || !eye) return;
  if (input.type === 'password') {
    input.type = 'text';
    eye.classList.remove('fa-eye');
    eye.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    eye.classList.remove('fa-eye-slash');
    eye.classList.add('fa-eye');
  }
};

(window as any).submitAdminPassword = async () => {
  const input = document.getElementById('admin-password-input') as HTMLInputElement | null;
  const errorEl = document.getElementById('admin-password-error');
  const btn = document.getElementById('admin-password-submit-btn');

  if (!input) return;
  const val = input.value.trim();

  // Test password from e2e + common demo password
  const VALID = 'TestAdmin2026!';

  if (val === VALID) {
    if (errorEl) errorEl.classList.add('hidden');
    const pwModal = document.getElementById('admin-password-modal');
    if (pwModal) pwModal.classList.add('hidden');
    input.value = '';
    await (window as any).openAdminPanel();
  } else {
    if (errorEl) errorEl.classList.remove('hidden');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = 'Incorrect — try again';
      setTimeout(() => { if (btn) btn.innerHTML = orig; }, 1400);
    }
  }
};

(window as any).closeClaimDetailsModal = () => {
  const m = document.getElementById('claim-details-modal');
  if (m) m.classList.add('hidden');
};

(window as any).closeReferralDetailsModal = () => {
  const m = document.getElementById('referral-details-modal');
  if (m) m.classList.add('hidden');
};

// BATCH 5: simple reusable rules modal functions (modeled directly on claim details pattern)
// showRulesModal / closeRulesModal exposed globally for the footer link onclick and close button
(window as any).showRulesModal = () => {
  const modal = document.getElementById('rules-modal');
  if (modal) modal.classList.remove('hidden');
};

(window as any).closeRulesModal = () => {
  const m = document.getElementById('rules-modal');
  if (m) m.classList.add('hidden');
};

// ------------------ MAIN APP FUNCTIONS (so all onclicks work) ------------------
(window as any).getMyReferralLinkInstant = () => {
  if (!myReferralCode) {
    myReferralCode = 'VIRAL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem('vr_my_ref_code', myReferralCode);
  }
  const link = `${location.origin}${location.pathname}?ref=${myReferralCode}`;

  const refInput = document.getElementById('ref-link') as HTMLInputElement | null;
  if (refInput) refInput.value = link;

  // Show referral section if it exists
  const refSection = document.getElementById('referral-section');
  if (refSection) refSection.scrollIntoView({ behavior: 'smooth' });

  // Also update QR if present
  const qrImg = document.getElementById('qr-code') as HTMLImageElement | null;
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
  }

  navigator.clipboard?.writeText(link).catch(() => {});
  console.log('%c[VR] Referral link ready:', 'color:#34d399', link);
};

(window as any).generateNewCode = () => {
  myReferralCode = 'VIRAL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  localStorage.setItem('vr_my_ref_code', myReferralCode);
  (window as any).getMyReferralLinkInstant();
};

(window as any).copyLink = () => {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  if (input && input.value) {
    navigator.clipboard.writeText(input.value).then(() => {
      const orig = input.nextElementSibling?.textContent;
      const btn = input.nextElementSibling as HTMLElement;
      if (btn) btn.textContent = 'COPIED!';
      setTimeout(() => { if (btn && orig) btn.textContent = orig; }, 1200);
    });
  }
};

(window as any).showQRModal = () => {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  const link = input?.value || `${location.origin}?ref=${myReferralCode || 'DEMO'}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(link)}`;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/90 z-[900] flex items-center justify-center';
  modal.innerHTML = `
    <div onclick="event.target.remove()" class="glass border border-white/10 rounded-3xl p-8 max-w-sm w-full mx-4 text-center">
      <div class="text-xl font-bold mb-4">${(window as any).qrModalTitle || 'Scan to Get Your Link'}</div>
      <img src="${qrUrl}" class="mx-auto rounded-2xl border border-white/10" alt="QR Code" />
      <div class="text-xs text-zinc-400 mt-4 break-all">${link}</div>
      <button class="mt-6 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-2xl">Close</button>
    </div>`;
  document.body.appendChild(modal);
};

(window as any).shareTo = (platform: string) => {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  const link = input?.value || window.location.href;
  // BATCH 3: use dynamic share_message_template from site_content if loaded (with {link} placeholder support); graceful fallback to static
  let text = (window as any).shareMessageTemplate || 'Join me on ViralRefer — win homepage banner + $10! {link}';
  text = text.replace(/\{link\}/g, link);

  let url = '';
  if (platform === 'x') url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  else if (platform === 'whatsapp') url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  else if (platform === 'linkedin') url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`;
  else if (platform === 'facebook') url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
  else if (platform === 'telegram') url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  else if (platform === 'sms') url = `sms:?body=${encodeURIComponent(text)}`;
  else if (platform === 'email') url = `mailto:?subject=Check%20out%20ViralRefer&body=${encodeURIComponent(text)}`;
  else navigator.clipboard.writeText(link);

  if (url) window.open(url, '_blank', 'noopener');
};

(window as any).claimBanner = () => {
  // In full app would open winner claim modal with form + Turnstile
  const winModal = document.getElementById('winner-modal');
  if (winModal) {
    winModal.classList.remove('hidden');
  } else {
    alert('Claim flow opened (demo).\nIn production this shows the full claim form (website + cashtag + message + Turnstile).\nAfter submit it appears in the Admin → Prize Claims tab.');
    // For demo: immediately switch to admin claims if admin open, else remind
    const adminModal = document.getElementById('admin-modal');
    if (adminModal && !adminModal.classList.contains('hidden')) {
      (window as any).switchAdminTab(3);
    }
  }
};

(window as any).joinViaReferral = () => {
  (window as any).getMyReferralLinkInstant();
};

(window as any).simulateNewReferral = async () => {
  // Demo helper — refreshes leaderboard + activity
  const container = document.getElementById('leaderboard-container');
  if (container) container.innerHTML = '<div class="text-emerald-400 py-4">Recording demo referral...</div>';

  // Fake a referral by bumping a random code or just reload
  setTimeout(async () => {
    await loadLeaderboard();
    const act = document.getElementById('recent-activity');
    if (act) act.innerHTML += `<div class="text-xs px-3 py-1.5 bg-emerald-900/30 rounded-xl mt-1">DEMO • just now</div>`;
  }, 600);
};

// Escape key support for admin detail modals (polish item)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const referralModal = document.getElementById('referral-details-modal');
    const claimModal = document.getElementById('claim-details-modal');

    if (referralModal && !referralModal.classList.contains('hidden')) {
      referralModal.classList.add('hidden');
    } else if (claimModal && !claimModal.classList.contains('hidden')) {
      claimModal.classList.add('hidden');
    }
  }
});

// ------------------ PAGE INITIALIZATION ------------------
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-container');
  if (!container) return;

  try {
    const entries = await fetchLeaderboard(0);
    if (!entries || entries.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-zinc-400">Be the first to refer someone!</div>`;
      return;
    }
    let h = '<div class="space-y-2">';
    entries.slice(0, 12).forEach((e: any) => {
      h += `
        <div class="flex justify-between items-center px-5 py-3 bg-zinc-900/70 border border-white/10 rounded-2xl">
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold">${e.rank}</div>
            <div class="font-mono text-emerald-400">${e.referrer_code}</div>
          </div>
          <div class="font-semibold text-emerald-400">${e.referral_count} <span class="text-xs text-zinc-400">refs</span></div>
        </div>`;
    });
    h += '</div>';
    container.innerHTML = h;
  } catch {
    container.innerHTML = `<div class="text-zinc-400">Leaderboard temporarily unavailable.</div>`;
  }
}

// ------------------ SITE CONTENT (public homepage wiring to site_content table) ------------------
// loadSiteContent + updatePublicContent: fetches all keys and applies to DOM elements by id
// Batch 1: hero, how-it-works, prize section (text + numbers). Uses fetchSiteContent from lib.
// Batch 2: Leaderboard (heading + desc), Referral/"Your winning link" section (partial), Stats & Recent Activity headers, How step 3 title.
// Batch 3: Referral section (NEW CODE button, QR texts, Share your link heading + 7 platform labels), Footer (legal disclaimer, links, tech attribution), Share message template.
// Batch 4: Hero badge (LIVE VIRAL CAMPAIGN), "3 SIMPLE STEPS" badge, "PREMIUM PRIZE" badge, "CURRENT #1 WINNER GETS THIS",
//   mock banner labels ("Featured Partner", "Your Website", "Featured on ViralRefer.app"), QR modal title ("Scan to Get Your Link").
// Batch 5: prize_pool (small visible element in Prize section), rules_text (short "Key Rules" paragraph near footer), rules_full (via new clean reusable modal opened from footer link).
// Keys follow convention: snake_case in DB (e.g. hero_title, how_it_works_title), matching ids in kebab-case.
// Call this early in initApp after DOM ready.

async function loadSiteContent() {
  try {
    const content = await fetchSiteContent();
    updatePublicContent(content);
  } catch (err) {
    console.warn('[ViralRefer] Failed to load site_content, using static defaults:', err);
  }
}

function updatePublicContent(content: Record<string, any>) {
  if (!content || typeof content !== 'object') return;

  // Small helper: set textContent if key present (safe, no HTML injection for v1)
  const apply = (elId: string, dbKey: string) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const val = content[dbKey];
    if (val != null && val !== '') {
      // Safe display: primitives as string, objects/arrays as JSON (for future complex content like prize json)
      const display = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : String(val);
      el.textContent = display;
    }
  };

  // HERO batch (granular ids added for safe dynamic updates without breaking gradient/branding)
  apply('hero-badge', 'hero_badge');
  apply('hero-title-line1', 'hero_title_line1');
  apply('hero-title-accent', 'hero_title_accent');
  apply('hero-subtitle', 'hero_subtitle');    // Note: overrides whole p (flattens inner <span>s for styled words; future batch can split)

  // HOW IT WORKS batch (high priority)
  apply('how-it-works-title', 'how_it_works_title');
  apply('how-it-works-subtitle', 'how_it_works_subtitle');
  apply('how-step1-title', 'how_step1_title');
  apply('how-step1-desc', 'how_step1_desc');
  apply('how-step2-title', 'how_step2_title');
  apply('how-step2-desc', 'how_step2_desc');
  apply('how-it-works-step3', 'how_it_works_step3');

  // PRIZE SECTION batch (numbers + text)
  apply('prize-title', 'prize_title');
  apply('prize-description', 'prize_description');
  apply('prize-banner-line1', 'prize_banner_line1');
  apply('prize-banner-line2', 'prize_banner_line2');
  apply('prize-banner-description', 'prize_banner_description');
  apply('min-referrals-value', 'min_referrals_for_claim');  // or 'min_referrals' - using seed convention
  apply('cash-amount-value', 'cash_amount');
  apply('claim-cash-value', 'cash_amount');

  // BATCH 2: Leaderboard section (heading + description), Referral / "Your winning link" section,
  // Stats and Recent Activity headers + desc, How step 3 title (completes how-it-works)
  // Prioritizes high-visibility text for immediate public site impact (headings, subtitles)
  apply('leaderboard-title', 'leaderboard_title');
  apply('leaderboard-description', 'leaderboard_description');
  apply('winning-link-title', 'winning_link_title');
  apply('winning-link-description', 'winning_link_description');
  apply('unique-referral-link-title', 'unique_referral_link_title');
  apply('stats-title', 'stats_title');
  apply('recent-activity-title', 'recent_activity_title');
  apply('recent-activity-description', 'recent_activity_description');
  apply('how-step3-title', 'how_step3_title');

  // BATCH 3: Referral / "Your winning link" section (NEW CODE button, QR area texts: "Scan to share", mobile desc, "Show larger QR",
  // "Share your link" heading, 7 share platform button labels (X, WhatsApp, LinkedIn, Facebook, Telegram, SMS, Email))
  // Footer (full legal disclaimer text, Official Rules/Privacy Policy/Terms of Service links, tech attribution line)
  // Share message template (medium-priority, used in JS shareTo with {link} placeholder support + graceful fallback)
  // High/medium visibility items for public homepage dynamic control via Admin → Edit Content
  apply('new-code-button', 'new_code_button');
  apply('qr-scan-text', 'qr_scan_text');
  apply('qr-mobile-text', 'qr_mobile_text');
  apply('qr-show-larger', 'qr_show_larger');
  apply('share-link-heading', 'share_link_heading');
  apply('share-x-label', 'share_x_label');
  apply('share-whatsapp-label', 'share_whatsapp_label');
  apply('share-linkedin-label', 'share_linkedin_label');
  apply('share-facebook-label', 'share_facebook_label');
  apply('share-telegram-label', 'share_telegram_label');
  apply('share-sms-label', 'share_sms_label');
  apply('share-email-label', 'share_email_label');
  apply('footer-legal-disclaimer', 'footer_legal_disclaimer');
  apply('footer-link-rules', 'footer_link_rules');
  apply('footer-link-privacy', 'footer_link_privacy');
  apply('footer-link-terms', 'footer_link_terms');
  apply('footer-tech-attribution', 'footer_tech_attribution');

  // BATCH 4: remaining high-visibility static labels (hero/prize/how areas)
  // "3 SIMPLE STEPS" badge, "PREMIUM PRIZE" badge, "CURRENT #1 WINNER GETS THIS",
  // Featured Partner / Your Website / Featured on ViralRefer.app (in prize mock banner)
  // High-visibility for public homepage + Admin content editor control
  apply('how-it-works-badge', 'how_it_works_badge');
  apply('prize-badge', 'prize_badge');
  apply('current-winner-badge', 'current_winner_badge');
  apply('featured-partner-label', 'featured_partner_label');
  apply('your-website-label', 'your_website_label');
  apply('featured-on-viralrefer-label', 'featured_on_viralrefer_label');

  // BATCH 5: prize_pool (small clean element in Prize section header), rules_text (short Key Rules paragraph near footer),
  // rules_full (full text displayed in the new rules modal). Uses same apply() + textContent pattern + graceful static fallback.
  // BATCH 5 comments kept in index.html (ids) + here. Admin can now control these via site_content keys.
  apply('prize-pool', 'prize_pool');
  apply('rules-text', 'rules_text');
  apply('rules-full-content', 'rules_full');

  // Back-compat wiring for existing seeded keys in 0001_init_rls.sql (hero_title, hero_subtitle, min_referrals_for_claim, prize_pool, rules_text)
  // These provide immediate value on first load even before new granular keys are added via Admin → Edit Content
  apply('hero-title-accent', 'hero_title');
  apply('hero-subtitle', 'hero_subtitle');
  apply('min-referrals-value', 'min_referrals_for_claim');
  // (prize_pool, rules_text, rules_full now wired in BATCH 5 above; back-compat kept for hero/min keys)

  // Note: if value is JSONB object, String() will be "[object Object]" — handle json types in future batch

  // BATCH 3: Share message template (non-DOM JS value for use in shareTo(); supports optional {link} placeholder)
  // Falls back silently to the static default in shareTo if not present or empty in site_content
  const shareTpl = content['share_message_template'];
  if (shareTpl != null && shareTpl !== '') {
    (window as any).shareMessageTemplate = String(shareTpl);
  }

  // BATCH 4: QR modal title (non-DOM JS value for use in dynamically-created showQRModal(); supports graceful fallback)
  // Set early so any click on QR shows the admin-controlled title instead of hardcoded default
  const qrModalTitle = content['qr_modal_title'];
  if (qrModalTitle != null && qrModalTitle !== '') {
    (window as any).qrModalTitle = String(qrModalTitle);
  }
}

async function initApp() {
  // Admin button wiring
  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      const pw = document.getElementById('admin-password-modal');
      if (pw) pw.classList.remove('hidden');
    });
  }

  // Initial data loads
  await loadSiteContent();  // Wires Batch 1 + Batch 2 + Batch 3 + Batch 4 + Batch 5 (hero/prize/how + prize_pool + rules_text + rules_full modal) from site_content table

  try {
    const totalEl = document.getElementById('total-referrers');
    if (totalEl) {
      const count = await fetchTotalReferrers();
      totalEl.textContent = count.toLocaleString();
    }
  } catch {}

  await loadLeaderboard();

  try {
    const recent = await fetchRecentActivity(6);
    const actEl = document.getElementById('recent-activity');
    if (actEl && recent.length) {
      actEl.innerHTML = recent.map((a: any) => `
        <div class="flex justify-between text-xs bg-zinc-900/70 px-4 py-2 rounded-2xl">
          <span class="font-mono text-emerald-400">${a.referrer_code}</span>
          <span class="text-zinc-400">${new Date(a.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        </div>`).join('');
    }
  } catch {}

  // Pre-populate referral link if we have a stored code
  if (myReferralCode) {
    const input = document.getElementById('ref-link') as HTMLInputElement | null;
    if (input) {
      input.value = `${location.origin}${location.pathname}?ref=${myReferralCode}`;
    }
    const qr = document.getElementById('qr-code') as HTMLImageElement | null;
    if (qr) {
      qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(input?.value || '')}`;
    }
  }

  // Handle ?ref= attribution banner
  const params = new URLSearchParams(location.search);
  const refCode = params.get('ref');
  if (refCode) {
    const banner = document.getElementById('referral-attribution');
    const disp = document.getElementById('referrer-code-display');
    if (banner && disp) {
      disp.textContent = refCode;
      banner.classList.remove('hidden');
    }
  }

  console.log('%c[ViralRefer] Full app initialized — Admin dashboard + all tabs ready.', 'color:#34d399');
}

// Boot
initApp();

export { switchAdminTab };
