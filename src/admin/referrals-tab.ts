import { supabase } from '../lib/supabase';
import { showToast } from '../ui';
import { adminReferralsCache, replaceReferralsCache, type AdminReferralRow } from './state';

/**
 * Admin Tab: Referrals
 *
 * Displays all referral events with:
 * - Live search + time filters
 * - High-risk IP detection
 * - Detail modals
 * - CSV export
 *
 * This is the main monitoring tab for the referral program.
 */
async function renderReferralsTab(content: HTMLElement) {
  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="text-2xl font-bold">Referrals</div>
        <div class="text-sm text-zinc-400">Monitor all referral activity â€¢ Abuse detection built-in</div>
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
        <div id="stat-total" class="text-4xl font-bold text-white mt-1">â€”</div>
      </div>
      <div class="glass admin-stat-card rounded-2xl p-4">
        <div class="text-xs text-zinc-400">UNIQUE REFERRERS</div>
        <div id="stat-unique" class="text-4xl font-bold text-emerald-400 mt-1">â€”</div>
      </div>
      <div class="glass admin-stat-card rounded-2xl p-4">
        <div class="text-xs text-zinc-400">TODAY</div>
        <div id="stat-today" class="text-4xl font-bold text-white mt-1">â€”</div>
      </div>
      <div class="glass admin-stat-card rounded-2xl p-4 border border-red-500/30" title="IPs that have generated 3+ referrals (possible abuse or VPN farming). Click rows to investigate.">
        <div class="text-xs text-red-400 flex items-center gap-1">
          HIGH-RISK IPs
          <i class="fa-solid fa-info-circle text-[10px] opacity-60"></i>
        </div>
        <div id="stat-risk" class="text-4xl font-bold text-red-400 mt-1">â€”</div>
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

  function computeStats(rows: readonly AdminReferralRow[]) {
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

  function renderFilteredReferrals(filtered: readonly AdminReferralRow[], riskIPs: Set<string>) {
    tableContainer.innerHTML = buildReferralsTableHTML(filtered, riskIPs);
    attachReferralTableListeners(tableContainer, filtered, riskIPs);
  }

  // Main load + filter logic
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) throw error;

    replaceReferralsCache(data || []);

    computeStats(adminReferralsCache); // initial stats (riskIPs computed inside)

    // Update last refreshed timestamp
    const tsEl = document.getElementById('referrals-last-updated');
    if (tsEl) {
      const now = new Date();
      tsEl.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    function applyFilters() {
      let filtered = filterReferralsByDays(adminReferralsCache, currentFilterDays);
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

      let rowsToExport = filterReferralsByDays(adminReferralsCache, currentFilterDays);
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

/**
 * Computes the set of high-risk IP addresses (those that generated 3+ referrals).
 * Pure function — used for both stats and row highlighting.
 */
/**
 * Exported for testability (pure function).
 */
export function computeHighRiskIPs(rows: readonly AdminReferralRow[]): Set<string> {
  const ipCounts: Record<string, number> = {};
  rows.forEach(r => {
    if (r.ip_address) ipCounts[r.ip_address] = (ipCounts[r.ip_address] || 0) + 1;
  });
  return new Set(Object.entries(ipCounts).filter(([, c]) => c >= 3).map(([ip]) => ip));
}

/**
 * Filters referrals to the last N days (0 = all time).
 * Pure helper, easy to unit test.
 */
/**
 * Exported for testability (pure function).
 */
export function filterReferralsByDays(rows: readonly AdminReferralRow[], days: number): readonly AdminReferralRow[] {
  if (days === 0) return rows;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return rows.filter(r => new Date(r.created_at) >= cutoff);
}

// --- Small presentation helpers ---

// Relative time formatter used in the referrals table
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

// Simple number formatter for this tab
function formatNumber(n: number): string {
  return n.toLocaleString();
}

// CSV export helper for the Referrals admin tab
function exportReferralsCSV(rows: readonly AdminReferralRow[]) {
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

/**
 * Shows the referral details modal (rich view + copy button).
 * Used exclusively by the Referrals admin tab.
 */
function showReferralDetails(row: AdminReferralRow, isHighRisk: boolean = false) {
  const modal = document.getElementById('referral-details-modal');
  const contentBox = document.getElementById('referral-details-content');
  if (!modal || !contentBox) return;

  const pretty = JSON.stringify(row, null, 2)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const created = row.created_at ? new Date(row.created_at).toLocaleString() : 'â€”';

  contentBox.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div><span class="text-zinc-400">Referral ID</span><div class="font-mono text-xs break-all">${row.id || 'â€”'}</div></div>
      <div>
        <span class="text-zinc-400">Referrer Code</span>
        <div class="flex items-center gap-2">
          <div class="font-mono text-emerald-400 text-lg">${row.referrer_code || 'â€”'}</div>
          ${row.referrer_code ? `
            <button class="copy-modal-code-btn text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-white/5 text-xs" data-code="${row.referrer_code}">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
          ` : ''}
        </div>
      </div>
      
      <div><span class="text-zinc-400">IP Address</span><div class="font-mono text-xs">${row.ip_address || 'â€”'}</div></div>
      <div><span class="text-zinc-400">Risk Level</span><div>${isHighRisk ? '<span class="px-3 py-0.5 text-xs rounded bg-red-600 text-white font-medium">HIGH â€” Multiple referrals from this IP</span>' : '<span class="text-emerald-400">Normal</span>'}</div></div>

      <div class="md:col-span-2"><span class="text-zinc-400">User Agent</span><div class="text-xs break-all text-zinc-300">${row.user_agent || 'â€”'}</div></div>
      
      <div><span class="text-zinc-400">Referrer User ID</span><div class="font-mono text-xs">${row.referrer_user_id || 'â€”'}</div></div>
      <div><span class="text-zinc-400">Referred User ID</span><div class="font-mono text-xs">${row.referred_user_id || 'â€”'}</div></div>
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

/**
 * Builds the complete referrals table HTML (thead + tbody rows).
 * Pure function — no side effects, no event listeners.
 */
function buildReferralsTableHTML(filtered: readonly AdminReferralRow[], riskIPs: Set<string>): string {
  if (!filtered.length) {
    return `
      <div class="text-center py-12 text-zinc-400 border border-white/10 rounded-2xl">
        <i class="fa-solid fa-users text-4xl mb-3 block opacity-60"></i>
        <div class="font-semibold text-zinc-300">No referrals found</div>
        <p class="text-sm mt-1 max-w-xs mx-auto">Try adjusting your search or time range. New referrals will appear here in real time.</p>
      </div>`;
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

  filtered.forEach((row, idx: number) => {
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
  return html;
}

/**
 * Attaches all interactive listeners to the newly rendered referral rows:
 * - Row click → open detail modal
 * - Copy code buttons
 * - "View" buttons
 *
 * This keeps the DOM-mutation + event wiring separate from HTML generation.
 */
function attachReferralTableListeners(
  tableContainer: HTMLElement,
  filtered: readonly AdminReferralRow[],
  riskIPs: Set<string>
) {
  // Row click → open modal (but not when clicking buttons inside)
  tableContainer.querySelectorAll('.referral-row').forEach(rowEl => {
    rowEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const idx = parseInt((rowEl as HTMLElement).dataset.idx!);
      const row = filtered[idx];
      showReferralDetails(row, riskIPs.has(row.ip_address || ''));
    });
  });

  // Copy Code buttons with "Copied!" feedback
  tableContainer.querySelectorAll('.copy-code-btn').forEach(btn => {
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

  // "View" buttons → open modal
  tableContainer.querySelectorAll('.view-referral-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      const idx = parseInt((btn as HTMLElement).dataset.idx!);
      const row = filtered[idx];
      showReferralDetails(row, riskIPs.has(row.ip_address || ''));
    });
  });
}

export { renderReferralsTab };
