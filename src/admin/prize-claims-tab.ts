import { supabase } from '../lib/supabase';
import { formatError } from '../lib';
import { showToast, updatePendingClaimsBadge } from '../ui';
import { adminClaimsCache, replaceClaimsCache, updateClaimInCache, type AdminClaimRow } from './state';
import { escapeHtml } from '../content';

type ClaimStatusFilter = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  approved: 1,
  paid: 2,
  rejected: 3,
};

let currentClaimStatusFilter: ClaimStatusFilter = 'all';

function getClaimsTabRoot(from: HTMLElement): HTMLElement {
  return (from.closest('#admin-content') as HTMLElement) || from;
}

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

/**
 * Renders the Prize Claims admin tab.
 *
 * Shows all prize claims submitted by top referrers, with status,
 * actions (Approve / Reject / Mark Paid), and detail views.
 */
export async function renderPrizeClaimsTab(content: HTMLElement) {
  // Always render Owner Test Tools (amber box) at top for easy owner testing + magic link bypass
  // Then the main live claims list below it. This merges the useful owner tooling with the full functional list.
  content.innerHTML = `
    <!-- Owner Test Tools (always visible - magic link + bypass test claim) -->
    <div class="mb-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5">
      <div class="flex items-center gap-2 mb-2">
        <i class="fa-solid fa-user-shield text-amber-400"></i>
        <span class="font-semibold text-amber-300">Owner Test Tools</span>
        <span class="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">Bypass for oliversenterprises@gmail.com</span>
      </div>
      <p class="mb-3 text-sm text-zinc-300">Sign in once with your owner Supabase account using the magic link below. This lets you submit test claims instantly even if you are not currently #1 (bypass in submit-claim Edge).</p>

      <div class="flex flex-wrap items-center gap-3">
        <button id="owner-magic-btn" class="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 active:scale-[0.985]">
          Send magic link to oliversenterprises@gmail.com
        </button>
        <button id="owner-check-session-btn" class="rounded-2xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15">Check sign-in status</button>
        <div id="owner-auth-status" class="text-sm text-zinc-400">Not signed in</div>
      </div>

      <div id="owner-user-id-row" class="mt-3 hidden items-center gap-2 text-xs font-mono">
        <span class="text-zinc-500">Your Supabase User ID:</span>
        <span id="owner-user-id" class="max-w-[420px] truncate rounded bg-black/40 px-2 py-px text-emerald-400"></span>
        <button id="owner-copy-id-btn" class="rounded bg-white/10 px-2 py-px text-[10px] hover:bg-white/20">Copy ID</button>
      </div>

      <div class="mt-3">
        <button id="owner-test-claim-btn" class="hidden rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
          Submit Test Claim as Owner (bypass)
        </button>
        <div id="owner-test-result" class="mt-1 text-xs text-zinc-400"></div>
      </div>
      <div class="mt-2 text-[10px] text-amber-400/70">After sign-in, use the bypass to populate test data. The list below will update live.</div>
    </div>

    <!-- Main Prize Claims list area (skeleton first) -->
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

  // Wire the always-present owner tools (non-blocking)
  wireOwnerTestTools(content);

  const mainArea = content.querySelector('#prize-claims-main') as HTMLElement;

  try {
    let rows: any[] = [];

    // Prefer Edge Function (service_role) so the full list (including pending) is visible
    // even for password-only admin (no real auth session) or when RLS own/approved policies would hide data.
    try {
      const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';
      const invokeOpts: { body: { action: string }; headers?: Record<string, string> } = {
        body: { action: 'get_claims' },
      };
      if (adminSecret) invokeOpts.headers = { 'x-admin-secret': adminSecret };
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('admin-action', invokeOpts);
      if (!edgeErr && edgeData?.success && Array.isArray(edgeData.data)) {
        rows = edgeData.data;
      } else {
        throw edgeErr || new Error('Edge get_claims did not return data');
      }
    } catch (_edgeError) {
      // Fallback to direct (works well once owner is signed in via the tools above or real auth)
      const { data, error } = await supabase
        .from('prize_claims')
        .select('id, created_at, referrer_code, website, cashtag, message, status, paid_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      rows = data || [];
    }

    replaceClaimsCache(rows);
    updatePendingClaimsBadge(countPendingClaims(adminClaimsCache));

    if (!adminClaimsCache.length) {
      mainArea.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10 text-center">
          <i class="fa-solid fa-trophy text-5xl text-zinc-700 mb-3 opacity-60"></i>
          <div class="text-xl font-semibold text-zinc-300">No prize claims yet</div>
          <p class="text-sm text-zinc-500 mt-2 max-w-sm">Use Owner Test Tools above to submit test claims, or wait for the real #1 referrer to claim.</p>
          <button onclick="window.switchAdminTab(3)" class="mt-4 px-5 py-2 bg-white/10 hover:bg-white/20 rounded-2xl text-sm">Refresh</button>
        </div>`;
      setupSafeClaimsRealtime(content);
      return;
    }

    renderClaimsList(mainArea, currentClaimStatusFilter);

    // Safe realtime so new claims or status changes appear without manual refresh
    setupSafeClaimsRealtime(content);

  } catch (e) {
    mainArea.innerHTML = `<div class="p-6 text-amber-400">Unable to load prize claims. ${formatError(e)}</div>`;
    showToast(`Unable to load prize claims: ${formatError(e)}`, 'info');
  }
}

/**
 * Shows the claim details modal.
 */
export function showClaimDetails(claim: AdminClaimRow) {
  const modal = document.getElementById('claim-details-modal');
  const contentBox = document.getElementById('claim-details-content');
  if (!modal || !contentBox) return;

  const pretty = JSON.stringify(claim, null, 2)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const paidAt = claim.paid_at ? new Date(claim.paid_at).toLocaleString() : '—';
  const safeWebsite = escapeHtml(claim.website || '—');
  const safeCashtag = escapeHtml(claim.cashtag || '—');
  const safeMessage = escapeHtml(claim.message || '—');
  const safeReferrer = escapeHtml(claim.referrer_code || '—');

  contentBox.innerHTML = `
    <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div><span class="text-zinc-400">ID</span><div class="font-mono text-xs break-all">${claim.id}</div></div>
      <div><span class="text-zinc-400">Referrer Code</span><div class="font-mono text-emerald-400">${safeReferrer}</div></div>
      <div><span class="text-zinc-400">Status</span><div><span class="px-3 py-px rounded bg-white/10">${escapeHtml(claim.status || 'pending')}</span></div></div>
      <div><span class="text-zinc-400">Paid At</span><div class="text-xs">${paidAt}</div></div>
      <div><span class="text-zinc-400">Website</span><div class="break-all">${safeWebsite}</div></div>
      <div>
        <span class="text-zinc-400">Cash App Cashtag</span>
        <div class="flex items-center gap-2">
          <div class="font-mono">${safeCashtag}</div>
          ${claim.cashtag ? `
            <button class="copy-modal-cashtag-btn text-sky-400 hover:text-sky-300 text-xs px-2 py-0.5 rounded bg-white/5" data-cashtag="${escapeHtml(claim.cashtag)}">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
          ` : ''}
        </div>
      </div>
      <div class="col-span-2"><span class="text-zinc-400">Message</span><div class="italic text-zinc-300">${safeMessage}</div></div>
    </div>
    <div class="mt-4 pt-4 border-t border-white/10 text-xs text-zinc-400">
      Created: ${claim.created_at ? new Date(claim.created_at).toLocaleString() : '—'}
    </div>
    <pre class="mt-4 p-3 bg-black/40 rounded-xl text-[10px] overflow-auto max-h-48">${pretty}</pre>
  `;

  modal.classList.remove('hidden');

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

/**
 * Wire the Owner Test Tools (magic link, session check, test claim bypass invoke).
 * Adapted for the integrated UI. On successful test claim it re-renders the whole tab (list updates).
 */
function wireOwnerTestTools(content: HTMLElement) {
  const OWNER_EMAIL = 'oliversenterprises@gmail.com';

  const magicBtn = content.querySelector('#owner-magic-btn') as HTMLButtonElement | null;
  const checkBtn = content.querySelector('#owner-check-session-btn') as HTMLButtonElement | null;
  const statusEl = content.querySelector('#owner-auth-status') as HTMLElement | null;
  const idRow = content.querySelector('#owner-user-id-row') as HTMLElement | null;
  const idEl = content.querySelector('#owner-user-id') as HTMLElement | null;
  const copyIdBtn = content.querySelector('#owner-copy-id-btn') as HTMLButtonElement | null;
  const testBtn = content.querySelector('#owner-test-claim-btn') as HTMLButtonElement | null;
  const resultEl = content.querySelector('#owner-test-result') as HTMLElement | null;

  if (!magicBtn || !statusEl) return;

  const updateStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === OWNER_EMAIL) {
        statusEl.textContent = `Signed in as ${user.email}`;
        statusEl.className = 'text-sm text-emerald-400';
        if (idRow && idEl) {
          idEl.textContent = user.id;
          idRow.classList.remove('hidden');
          idRow.classList.add('flex');
        }
        if (testBtn) testBtn.classList.remove('hidden');
      } else if (user) {
        statusEl.textContent = `Signed in as ${user.email} (different account)`;
        statusEl.className = 'text-sm text-amber-400';
        if (idRow) idRow.classList.add('hidden');
        if (testBtn) testBtn.classList.add('hidden');
      } else {
        statusEl.textContent = 'Not signed in';
        statusEl.className = 'text-sm text-zinc-400';
        if (idRow) idRow.classList.add('hidden');
        if (testBtn) testBtn.classList.add('hidden');
      }
    } catch (_e) {
      statusEl.textContent = 'Session check failed';
      statusEl.className = 'text-sm text-red-400';
    }
  };

  updateStatus();

  magicBtn.addEventListener('click', async () => {
    const orig = magicBtn.innerHTML;
    magicBtn.disabled = true;
    magicBtn.innerHTML = 'Sending magic link...';
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: OWNER_EMAIL, options: { shouldCreateUser: false } });
      if (error) throw error;
      statusEl.textContent = 'Magic link sent! Check your email (oliversenterprises@gmail.com) and click the link.';
      statusEl.className = 'text-sm text-emerald-400';
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await updateStatus();
        const u = (await supabase.auth.getUser()).data.user;
        if (attempts > 12 || u) clearInterval(poll);
      }, 2500);
    } catch (e: any) {
      statusEl.textContent = `Error: ${e?.message || e}`;
      statusEl.className = 'text-sm text-red-400';
    } finally {
      magicBtn.disabled = false;
      magicBtn.innerHTML = orig;
    }
  });

  if (checkBtn) checkBtn.addEventListener('click', updateStatus);

  if (copyIdBtn && idEl) {
    copyIdBtn.addEventListener('click', () => {
      const id = idEl.textContent?.trim();
      if (id) navigator.clipboard.writeText(id).then(() => {
        const orig = copyIdBtn.textContent;
        copyIdBtn.textContent = 'Copied!';
        setTimeout(() => { if (copyIdBtn) copyIdBtn.textContent = orig || 'Copy ID'; }, 1400);
      });
    });
  }

  if (testBtn && resultEl) {
    testBtn.addEventListener('click', async () => {
      resultEl.textContent = 'Submitting test claim via owner bypass...';
      testBtn.disabled = true;
      try {
        const { data, error } = await supabase.functions.invoke('submit-claim', {
          body: {
            turnstileToken: 'owner-bypass-test',
            website: 'https://oliversenterprises.test',
            cashtag: '$owner-test',
            message: 'Owner test claim from Admin Owner Test Tools (bypass)',
          }
        });
        if (error) throw error;
        if (data?.success) {
          resultEl.innerHTML = `<span class="text-emerald-400">Success! Claim ID: ${escapeHtml(String(data.claimId || ''))}. Bypass used: ${data.bypassUsed ? 'yes' : 'no'}</span>`;
          showToast('Test claim submitted (owner bypass)', 'success');
          // Re-render the tab so the new claim appears in the list (realtime will also catch it)
          setTimeout(() => renderPrizeClaimsTab(content), 600);
        } else {
          resultEl.textContent = `Server said: ${data?.error || 'Unknown error'}`;
          resultEl.className = 'mt-1 text-xs text-red-400';
        }
      } catch (e: any) {
        resultEl.textContent = `Failed: ${e?.message || e}`;
        resultEl.className = 'mt-1 text-xs text-red-400';
      } finally {
        testBtn.disabled = false;
      }
    });
  }
}

/**
 * Safe realtime subscription for prize_claims.
 * Unsubscribes any previous channel first to avoid the "cannot add postgres_changes after subscribe" lifecycle bug.
 * On any change we simply refresh the tab (simple, reliable, and re-uses the Edge/direct fetch logic).
 */
let claimsChannel: any = null;

function setupSafeClaimsRealtime(container: HTMLElement) {
  // Clean previous subscription to prevent the channel bug
  if (claimsChannel) {
    try { claimsChannel.unsubscribe(); } catch { /* channel already closed */ }
    claimsChannel = null;
  }

  claimsChannel = supabase
    .channel('prize-claims-admin-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'prize_claims' },
      (_payload) => {
        // Lightweight: re-render the tab so list + caches stay consistent
        // (could do optimistic patch but full refresh is robust and cheap at current scale)
        const main = container.querySelector('#prize-claims-main') || container;
        // Only refresh if the tab is still mounted
        if (main && document.body.contains(main)) {
          // Use the existing render which handles owner tools + list + re-sub
          renderPrizeClaimsTab(container).catch(() => {});
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const ts = document.getElementById('claims-last-updated');
        if (ts) ts.textContent = (ts.textContent || '') + ' • live';
      }
    });

  // Best-effort cleanup when tab is re-rendered or admin closes (helps across switches)
  // The next render will call this again and clean first.
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

/**
 * Builds the full Prize Claims table HTML (header + rows with status badges and action buttons).
 * Pure presentation function — no side effects.
 */
function buildClaimsTableHTML(
  claims: readonly AdminClaimRow[],
  pendingCount: number,
  activeFilter: ClaimStatusFilter,
): string {
  const filterChip = (value: ClaimStatusFilter, label: string) => {
    const active = activeFilter === value;
    return `<button data-status="${value}" class="claim-status-filter px-3 py-1 text-xs rounded-full border transition-colors ${
      active ? 'bg-violet-600 border-violet-500 text-white' : 'border-white/20 text-zinc-400 hover:bg-white/10'
    }">${label}</button>`;
  };

  let html = `
    <div class="flex justify-between items-center mb-4">
      <div>
        <div class="text-2xl font-bold">Prize Claims</div>
        <div class="text-sm text-zinc-400">${pendingCount > 0 ? `${pendingCount} pending · ` : ''}${adminClaimsCache.length} total submissions</div>
      </div>
      <div class="flex items-center gap-3">
        <span id="claims-last-updated" class="text-[10px] text-zinc-500"></span>
        <button id="export-claims-csv-btn" class="px-4 py-2 text-sm bg-white/10 rounded-2xl flex items-center gap-2"><i class="fa-solid fa-download"></i> Export CSV</button>
        <button onclick="window.triggerRefreshSpin(this); window.switchAdminTab(3)" class="px-4 py-2 text-sm bg-white/10 rounded-2xl flex items-center gap-2"><i class="fa-solid fa-sync"></i> Refresh</button>
      </div>
    </div>
    <div class="flex flex-wrap gap-2 mb-4">
      ${filterChip('all', 'All')}
      ${filterChip('pending', 'Pending')}
      ${filterChip('approved', 'Approved')}
      ${filterChip('paid', 'Paid')}
      ${filterChip('rejected', 'Rejected')}
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

  if (!claims.length) {
    html += `
      <tr><td colspan="7" class="py-10 text-center text-zinc-400">
        No claims match this filter. <button data-status="all" class="claim-status-filter text-violet-400 hover:underline ml-1">Show all</button>
      </td></tr>`;
  }

  claims.forEach((claim) => {
    const date = new Date(claim.created_at || Date.now()).toLocaleDateString();
    const status = claim.status || 'pending';
    const statusColor = status === 'approved' ? 'text-emerald-400 bg-emerald-950' :
                        status === 'paid' ? 'text-sky-400 bg-sky-950' :
                        status === 'rejected' ? 'text-red-400 bg-red-950' : 'text-amber-400 bg-amber-950';

    const website = escapeHtml((claim.website || '').toString());
    const cashtag = escapeHtml((claim.cashtag || '').toString());
    const message = escapeHtml((claim.message || '').toString());
    const shortWebsite = website.length > 28 ? website.slice(0, 25) + '…' : (website || '—');
    const shortMsg = message.length > 32 ? message.slice(0, 29) + '…' : (message || '—');

    html += `
      <tr class="table-row border-b border-white/10 hover:bg-zinc-900/60 align-top">
        <td class="py-3 pr-3 text-xs text-zinc-400 whitespace-nowrap">${date}</td>
        <td class="py-3 pr-3 font-mono text-emerald-400 text-sm">${escapeHtml((claim.referrer_code || '—').toString())}</td>
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
            <button data-claim-id="${claim.id}" class="view-claim-btn text-xs px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20">View</button>
            ${status === 'pending' ? `
              <button data-claim-id="${claim.id}" data-status="approved" class="action-claim-btn text-xs px-3 py-1 rounded-xl bg-emerald-600/80 hover:bg-emerald-600">Approve</button>
              <button data-claim-id="${claim.id}" data-status="rejected" class="action-claim-btn text-xs px-3 py-1 rounded-xl bg-red-600/70 hover:bg-red-600">Reject</button>
            ` : ''}
            ${status === 'approved' ? `
              <button data-claim-id="${claim.id}" data-status="paid" class="action-claim-btn text-xs px-3 py-1 rounded-xl bg-sky-600/80 hover:bg-sky-600">Mark Paid</button>
            ` : ''}
          </div>
        </td>
      </tr>`;
  });

  html += `</tbody></table></div>`;
  return html;
}

/**
 * Attaches all interactive listeners for the Prize Claims table:
 * - View buttons → open detail modal
 * - Cashtag copy buttons
 * - Action buttons (Approve / Reject / Mark Paid) with confirm + Edge Function update
 */
function exportClaimsCSV(claims: readonly AdminClaimRow[]) {
  const headers = ['id', 'created_at', 'referrer_code', 'website', 'cashtag', 'message', 'status', 'paid_at'];
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

  // Attach View buttons (opens claim details modal)
  content.querySelectorAll('.view-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const claim = findClaimById((btn as HTMLElement).dataset.claimId || '');
      if (claim) showClaimDetails(claim);
    });
  });

  // Copy cashtag buttons in table
  content.querySelectorAll('.copy-cashtag-btn').forEach(btn => {
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
  content.querySelectorAll('.action-claim-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const claimId = (btn as HTMLElement).dataset.claimId || '';
      const cacheIdx = adminClaimsCache.findIndex((c) => c.id === claimId);
      const newStatus = (btn as HTMLElement).dataset.status!;
      const claim = cacheIdx >= 0 ? adminClaimsCache[cacheIdx] : undefined;
      if (!claim) return;

      if (!confirm(`Are you sure you want to ${newStatus.toUpperCase()} this claim from ${claim.referrer_code || 'unknown'}?`)) {
        return;
      }

      const btnEl = btn as HTMLButtonElement;
      const originalText = btnEl.textContent || '';
      btnEl.textContent = 'Saving...';
      btnEl.disabled = true;

      try {
        const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';
        const { data, error } = await supabase.functions.invoke('admin-action', {
          body: {
            action: 'update_claim_status',
            payload: {
              claimId: claim.id,
              status: newStatus,
              note: null
            }
          },
          headers: adminSecret ? { 'x-admin-secret': adminSecret } : {}
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Edge Function failed');

        updateClaimInCache(cacheIdx, {
          status: newStatus,
          ...(newStatus === 'paid' ? { paid_at: new Date().toISOString() } : {}),
        });

        const actionText = newStatus === 'approved' ? 'approved' :
                           newStatus === 'rejected' ? 'rejected' : 'marked as paid';
        showToast(`Claim ${actionText}`, 'success');
        updatePendingClaimsBadge(countPendingClaims(adminClaimsCache));
        await renderPrizeClaimsTab(getClaimsTabRoot(content));
      } catch (err) {
        console.warn('[Admin] admin-action Edge Function failed:', err);
        showToast(`Failed to update claim: ${formatError(err)}`, 'info');
        btnEl.textContent = originalText;
        btnEl.disabled = false;
      }
    });
  });
}