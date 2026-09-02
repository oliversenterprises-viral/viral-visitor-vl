import { invokeAdminAction } from '../lib/admin-action-client';
import { formatError } from '../lib';
import { showToast, updatePendingClaimsBadge } from '../ui';
import { adminClaimsCache, replaceClaimsCache, type AdminClaimRow } from './state';
import { escapeHtml } from '../content';

type ClaimStatusFilter = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  approved: 1,
  paid: 2,
  rejected: 3,
};

/** Live HQ Prize copy — audit only. Owner does not approve. */
export const PRIZE_AUDIT_TITLE = 'Prize audit';
export const PRIZE_AUDIT_LEAD =
  "Claimed 7-day banners only. This week's #1 must tap Claim. You do not approve.";
export const PRIZE_AUDIT_EMPTY =
  "This week's #1 must claim in the app. This list is claimed banners only. You do not approve.";

let currentClaimStatusFilter: ClaimStatusFilter = 'all';

/** Exported for testability (pure function). */
export function sortClaimsByPriority(claims: readonly AdminClaimRow[]): AdminClaimRow[] {
  return [...claims].sort((a, b) => {
    const sa = STATUS_PRIORITY[a.status || 'pending'] ?? 9;
    const sb = STATUS_PRIORITY[b.status || 'pending'] ?? 9;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
}

/** Exported for testability (pure function). */
export function filterClaimsByStatus(claims: readonly AdminClaimRow[], filter: ClaimStatusFilter): AdminClaimRow[] {
  if (filter === 'all') return [...claims];
  return claims.filter((c) => (c.status || 'pending') === filter);
}

/** Exported for testability (pure function). */
export function countPendingClaims(claims: readonly AdminClaimRow[]): number {
  return claims.filter((c) => (c.status || 'pending') === 'pending').length;
}

/** leftover cash status — show as Legacy, never a payout action. */
export function displayClaimStatus(status: string | undefined): string {
  if (status === 'paid') return 'Legacy';
  return status || 'pending';
}

/**
 * Prize tab: audit of claimed 7-day banners. No cash. Owner does not approve.
 */
export async function renderPrizeClaimsTab(content: HTMLElement) {
  content.innerHTML = `
    <div id="prize-claims-main">
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
    </div>
  `;

  const mainArea = content.querySelector('#prize-claims-main') as HTMLElement;

  try {
    const claimsResult = await invokeAdminAction<AdminClaimRow[]>('get_claims');
    if (!claimsResult.success || !Array.isArray(claimsResult.data)) {
      throw new Error(claimsResult.success ? 'Invalid get_claims response' : claimsResult.error);
    }

    replaceClaimsCache(claimsResult.data);
    updatePendingClaimsBadge(countPendingClaims(adminClaimsCache));

    if (!adminClaimsCache.length) {
      mainArea.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10 text-center">
          <i class="fa-solid fa-trophy text-5xl text-zinc-700 mb-3 opacity-60"></i>
          <div class="text-xl font-semibold text-zinc-300">No claims in the record</div>
          <p class="text-sm text-zinc-500 mt-2 max-w-sm">${escapeHtml(PRIZE_AUDIT_EMPTY)}</p>
          <button type="button" onclick="window.switchAdminTab(3)" class="mt-4 px-5 py-2 bg-white/10 hover:bg-white/20 rounded-2xl text-sm">Refresh</button>
        </div>`;
      return;
    }

    renderClaimsList(mainArea, currentClaimStatusFilter);
  } catch (e) {
    mainArea.innerHTML = `<div class="p-6 text-amber-400 border border-amber-500/30 rounded-2xl">
        <div class="font-semibold mb-1">Unable to load prize claims</div>
        <div class="text-sm text-zinc-400">${formatError(e)}</div>
        <button type="button" onclick="window.switchAdminTab(3)" class="mt-3 px-4 py-2 text-sm bg-white/10 rounded-2xl" data-prize-retry="1">Retry</button>
      </div>`;
    showToast(`Unable to load prize claims: ${formatError(e)}`, 'info');
  }
}

/**
 * Shows the claim details modal — website + message only. No cash fields.
 */
export function showClaimDetails(claim: AdminClaimRow) {
  const modal = document.getElementById('claim-details-modal');
  const contentBox = document.getElementById('claim-details-content');
  if (!modal || !contentBox) return;

  const pretty = JSON.stringify(claim, null, 2)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const safeWebsite = escapeHtml(claim.website || '—');
  const safeMessage = escapeHtml(claim.message || '—');
  const safeReferrer = escapeHtml(claim.referrer_code || '—');
  const statusLabel = escapeHtml(displayClaimStatus(claim.status));
  const created = claim.created_at ? new Date(claim.created_at).toLocaleString() : '—';

  contentBox.innerHTML = `
    <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div><span class="text-zinc-400">ID</span><div class="font-mono text-xs break-all">${escapeHtml(claim.id)}</div></div>
      <div><span class="text-zinc-400">Referrer</span><div class="font-mono text-emerald-400">${safeReferrer}</div></div>
      <div><span class="text-zinc-400">Status</span><div><span class="px-3 py-px rounded bg-white/10">${statusLabel}</span></div></div>
      <div><span class="text-zinc-400">Created</span><div class="text-xs">${escapeHtml(created)}</div></div>
      <div class="col-span-2"><span class="text-zinc-400">Website</span><div class="break-all">${safeWebsite}</div></div>
      <div class="col-span-2"><span class="text-zinc-400">Message</span><div class="italic text-zinc-300">${safeMessage}</div></div>
    </div>
    <pre class="mt-4 p-3 bg-black/40 rounded-xl text-[10px] overflow-auto max-h-48">${pretty}</pre>
  `;

  modal.classList.remove('hidden');
}

function renderClaimsList(mainArea: HTMLElement, statusFilter: ClaimStatusFilter) {
  const sorted = sortClaimsByPriority(adminClaimsCache);
  const filtered = filterClaimsByStatus(sorted, statusFilter);
  const pendingCount = countPendingClaims(adminClaimsCache);

  mainArea.innerHTML = buildClaimsTableHTML(filtered, pendingCount, statusFilter);

  const claimsTs = document.getElementById('claims-last-updated');
  if (claimsTs) {
    const now = new Date();
    claimsTs.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  attachClaimsListeners(mainArea, statusFilter);
  updatePendingClaimsBadge(pendingCount);
}

export function buildClaimsTableHTML(
  claims: readonly AdminClaimRow[],
  pendingCount: number,
  activeFilter: ClaimStatusFilter,
): string {
  const filterChip = (value: ClaimStatusFilter, label: string) => {
    const active = activeFilter === value;
    return `<button type="button" data-status="${value}" class="claim-status-filter px-3 py-1 text-xs rounded-full border transition-colors ${
      active ? 'bg-violet-600 border-violet-500 text-white' : 'border-white/20 text-zinc-400 hover:bg-white/10'
    }">${label}</button>`;
  };

  let html = `
    <div class="flex justify-between items-center mb-4">
      <div>
        <div class="text-2xl font-bold">${escapeHtml(PRIZE_AUDIT_TITLE)}</div>
        <div class="text-sm text-zinc-400">${escapeHtml(PRIZE_AUDIT_LEAD)}</div>
        <div class="text-sm text-zinc-400">${pendingCount > 0 ? `${pendingCount} still marked pending · ` : ''}${adminClaimsCache.length} total submissions</div>
      </div>
      <div class="flex items-center gap-3">
        <span id="claims-last-updated" class="text-[10px] text-zinc-500"></span>
        <button type="button" id="export-claims-csv-btn" class="px-4 py-2 text-sm bg-white/10 rounded-2xl flex items-center gap-2"><i class="fa-solid fa-download"></i> Export CSV</button>
        <button type="button" onclick="window.triggerRefreshSpin(this); window.switchAdminTab(3)" class="px-4 py-2 text-sm bg-white/10 rounded-2xl flex items-center gap-2"><i class="fa-solid fa-sync"></i> Refresh</button>
      </div>
    </div>
    <div class="flex flex-wrap gap-2 mb-4">
      ${filterChip('all', 'All')}
      ${filterChip('pending', 'Pending')}
      ${filterChip('approved', 'Approved')}
      ${filterChip('rejected', 'Rejected')}
    </div>
    <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-white/10 text-left text-zinc-400">
          <th class="py-3 pr-3">Date</th>
          <th class="py-3 pr-3">Referrer</th>
          <th class="py-3 pr-3">Website</th>
          <th class="py-3 pr-3">Message</th>
          <th class="py-3 pr-3">Status</th>
          <th class="py-3">View</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (!claims.length) {
    html += `
      <tr><td colspan="6" class="py-10 text-center text-zinc-400">
        No claims match this filter. <button type="button" data-status="all" class="claim-status-filter text-violet-400 hover:underline ml-1">Show all</button>
      </td></tr>`;
  }

  claims.forEach((claim) => {
    const date = new Date(claim.created_at || Date.now()).toLocaleDateString();
    const status = claim.status || 'pending';
    const statusLabel = displayClaimStatus(status);
    const statusColor = status === 'approved' ? 'text-emerald-400 bg-emerald-950' :
                        status === 'rejected' ? 'text-red-400 bg-red-950' :
                        status === 'paid' ? 'text-zinc-300 bg-zinc-800' : 'text-amber-400 bg-amber-950';

    const website = escapeHtml((claim.website || '').toString());
    const message = escapeHtml((claim.message || '').toString());
    const shortWebsite = website.length > 28 ? website.slice(0, 25) + '…' : (website || '—');
    const shortMsg = message.length > 32 ? message.slice(0, 29) + '…' : (message || '—');

    html += `
      <tr class="table-row border-b border-white/10 hover:bg-zinc-900/60 align-top">
        <td class="py-3 pr-3 text-xs text-zinc-400 whitespace-nowrap">${date}</td>
        <td class="py-3 pr-3 font-mono text-emerald-400 text-sm">${escapeHtml((claim.referrer_code || '—').toString())}</td>
        <td class="py-3 pr-3 text-xs max-w-[160px] truncate" title="${website}">${shortWebsite}</td>
        <td class="py-3 pr-3 text-xs max-w-[180px] truncate italic text-zinc-300" title="${message}">${shortMsg}</td>
        <td class="py-3 pr-3"><span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}">${escapeHtml(statusLabel)}</span></td>
        <td class="py-3">
          <button type="button" data-claim-id="${escapeHtml(claim.id)}" class="view-claim-btn text-xs px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20">View details</button>
        </td>
      </tr>`;
  });

  html += `</tbody></table></div>`;
  return html;
}

function exportClaimsCSV(claims: readonly AdminClaimRow[]) {
  const headers = ['id', 'created_at', 'referrer_code', 'website', 'message', 'status'];
  const rows = claims.map((c) => headers.map((h) => {
    const v = String((c as Record<string, unknown>)[h] ?? '');
    return `"${v.replace(/"/g, '""')}"`;
  }).join(','));
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `viralrefer-claims-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function attachClaimsListeners(content: HTMLElement, statusFilter: ClaimStatusFilter) {
  content.querySelectorAll('.claim-status-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentClaimStatusFilter = ((btn as HTMLElement).dataset.status || 'all') as ClaimStatusFilter;
      renderClaimsList(content, currentClaimStatusFilter);
    });
  });

  const exportBtn = content.querySelector('#export-claims-csv-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const sorted = sortClaimsByPriority(adminClaimsCache);
      const toExport = filterClaimsByStatus(sorted, statusFilter);
      exportClaimsCSV(toExport);
      showToast('Claims CSV downloaded', 'success');
    });
  }

  const findClaimById = (id: string) => adminClaimsCache.find((c) => c.id === id);

  content.querySelectorAll('.view-claim-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const claim = findClaimById((btn as HTMLElement).dataset.claimId || '');
      if (claim) showClaimDetails(claim);
    });
  });
}
