import { supabase } from '../lib/supabase';
import { showToast } from '../ui';

/** Shape of a single share event as used by this analytics tab */
interface ShareEvent {
  platform: string;
  referrer_code: string;
  created_at: string;
}

/** Internal view model returned by the computation layer */
interface AnalyticsViewData {
  total: number;
  sortedPlatforms: Array<[string, number]>;
  topReferrers: Array<[string, number]>;
  trendLabels: string[];
  trendData: number[];
  uniqueSharers: number;
  peakDay: { day: string; count: number };
  avgPerDay: number;
  insights: string[];
}

// Local state for the currently filtered analytics data (used by export button)
let currentAnalyticsFiltered: ShareEvent[] = [];

/**
 * Admin Tab: Share Analytics
 *
 * Advanced analytics dashboard for share events:
 * - Platform and referrer breakdowns
 * - Time-series charts (Chart.js, lazy-loaded)
 * - Key insights
 * - Filtered CSV export
 *
 * One of the heavier admin tabs (dynamically imported).
 */
async function renderShareAnalyticsTab(content: HTMLElement) {
  content.innerHTML = `<div class="text-center py-6">Loading advanced analytics...</div>`;

  try {
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    let sharesData: ShareEvent[] | null = null;
    const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';
    if (adminSecret) {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('admin-action', {
        body: { action: 'get_shares' },
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!edgeErr && edgeData?.success && Array.isArray(edgeData.data)) {
        sharesData = edgeData.data.map((row: { platform: string; referral_link?: string; referrer_code?: string; created_at: string }) => ({
          platform: row.platform,
          referrer_code: row.referrer_code || row.referral_link || 'unknown',
          created_at: row.created_at,
        }));
      }
    }
    if (!sharesData) {
      const { data } = await supabase
        .from('shares')
        .select('platform, referrer_code, created_at')
        .order('created_at', { ascending: false });
      sharesData = (data as ShareEvent[]) || [];
    }

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

    const allShares: ShareEvent[] = sharesData as ShareEvent[];

    function formatNumber(n: number): string {
      return n.toLocaleString();
    }

    function filterByDays(days: number): ShareEvent[] {
      if (days === 0) return allShares;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return allShares.filter((s: ShareEvent) => new Date(s.created_at) >= cutoff);
    }

    function computeAnalyticsData(filteredShares: ShareEvent[]): AnalyticsViewData {
      const total = filteredShares.length;

      const platformCounts: Record<string, number> = {};
      filteredShares.forEach((s) => {
        platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
      });
      const sortedPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);

      const referrerCounts: Record<string, number> = {};
      filteredShares.forEach((s) => {
        referrerCounts[s.referrer_code] = (referrerCounts[s.referrer_code] || 0) + 1;
      });
      const topReferrers = Object.entries(referrerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      const dailyCounts: Record<string, number> = {};
      filteredShares.forEach((s) => {
        const day = new Date(s.created_at).toISOString().split('T')[0];
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      });
      const sortedDays = Object.keys(dailyCounts).sort().slice(-14);
      const trendLabels = sortedDays;
      const trendData = sortedDays.map(day => dailyCounts[day] || 0);

      const uniqueSharers = new Set(filteredShares.map((s) => s.referrer_code)).size;

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

      return {
        total,
        sortedPlatforms,
        topReferrers,
        trendLabels,
        trendData,
        uniqueSharers,
        peakDay,
        avgPerDay,
        insights,
      };
    }

    function buildAnalyticsHTML(data: AnalyticsViewData) {

      let html = `
        <div class="mb-6">
          <div class="flex items-center justify-between">
            <div class="admin-stat-card">
              <div class="text-sm text-zinc-400">TOTAL SHARES</div>
              <div class="text-6xl font-bold text-white">${formatNumber(data.total)}</div>
              <div class="text-xs text-zinc-500 mt-1">From ${data.uniqueSharers} unique people • Avg ${data.avgPerDay}/day</div>
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
              ${data.insights.map((i: string) => `<li>• ${i}</li>`).join('')}
            </ul>
          </div>

          <div>
            <h4 class="text-sm font-semibold text-zinc-300 mb-3">Top Referrers by Shares</h4>
            <div class="space-y-1.5">
      `;

      data.topReferrers.forEach(([referrer, count], index: number) => {
        const percentage = Math.round((count / data.total) * 100);
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

      data.sortedPlatforms.forEach(([platform, count]) => {
        const percentage = Math.round((count / data.total) * 100);
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

      return html;
    }

    function renderAnalyticsCharts(data: AnalyticsViewData) {
      const { sortedPlatforms, trendLabels, trendData } = data;

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
            labels: trendLabels.map((d) => d.slice(5)),
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
    }

    function attachAnalyticsListeners() {
      // Re-attach time filters
      document.querySelectorAll('.time-filter').forEach(btn => {
        btn.addEventListener('click', () => {
          const days = parseInt((btn as HTMLElement).dataset.days || '0');
          const filtered = days === 0 ? allShares : filterByDays(days);
          currentAnalyticsFiltered = filtered;
          renderAnalytics(filtered);
        });
      });

      // Export CSV for current view
      const exportSharesBtn = document.getElementById('export-shares-btn') as HTMLButtonElement | null;
      if (exportSharesBtn) {
        exportSharesBtn.onclick = () => {
          const currentFiltered = currentAnalyticsFiltered || allShares;
          exportSharesCSV(currentFiltered);
          showToast('Shares exported successfully', 'success');
        };
      }
    }

    function renderAnalytics(filteredShares: ShareEvent[]) {
      currentAnalyticsFiltered = filteredShares;

      const data = computeAnalyticsData(filteredShares);
      const html = buildAnalyticsHTML(data);

      content.innerHTML = html;

      renderAnalyticsCharts(data);

      // Update timestamp
      const analyticsTs = document.getElementById('analytics-last-updated');
      if (analyticsTs) {
        const now = new Date();
        analyticsTs.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      attachAnalyticsListeners();
    }

    // Store last rendered data for export
    currentAnalyticsFiltered = allShares;
    renderAnalytics(allShares);

  } catch (e) {
    const { data } = await supabase.from('shares').select('platform');
    const counts: Record<string, number> = {};
    (data || []).forEach((s: { platform: string }) => counts[s.platform] = (counts[s.platform] || 0) + 1);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    content.innerHTML = `<pre class="text-xs bg-black/40 p-4 rounded-xl">Total: ${total}\n${JSON.stringify(counts, null, 2)}</pre>`;
  }
}

// CSV export helper for shares (moved here with the tab; only used by Share Analytics)
function exportSharesCSV(shares: readonly ShareEvent[]) {
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

export { renderShareAnalyticsTab };
