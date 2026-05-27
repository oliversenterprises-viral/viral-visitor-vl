import { supabase } from '../lib/supabase';
import { formatError } from '../lib';
import { showToast } from '../ui';
import { adminClaimsCache, replaceClaimsCache, updateClaimInCache, type AdminClaimRow } from './state';

/**
 * Renders the Prize Claims admin tab.
 *
 * Shows all prize claims submitted by top referrers, with status,
 * actions (Approve / Reject / Mark Paid), and detail views.
 */
export async function renderPrizeClaimsTab(content: HTMLElement) {
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

    replaceClaimsCache(data || []);

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

    const html = buildClaimsTableHTML(adminClaimsCache);
    content.innerHTML = html;

    // Update last refreshed timestamp
    const claimsTs = document.getElementById('claims-last-updated');
    if (claimsTs) {
      const now = new Date();
      claimsTs.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    attachClaimsListeners(content);

  } catch (e) {
    content.innerHTML = `<div class="p-6 text-amber-400">Unable to load prize claims. ${formatError(e)}</div>`;
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
 * Builds the full Prize Claims table HTML (header + rows with status badges and action buttons).
 * Pure presentation function — no side effects.
 */
function buildClaimsTableHTML(claims: readonly AdminClaimRow[]): string {
  let html = `
    <div class="flex justify-between items-center mb-4">
      <div>
        <div class="text-2xl font-bold">Prize Claims</div>
        <div class="text-sm text-zinc-400">${claims.length} total submissions</div>
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

  claims.forEach((claim, idx: number) => {
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
  return html;
}

/**
 * Attaches all interactive listeners for the Prize Claims table:
 * - View buttons → open detail modal
 * - Cashtag copy buttons
 * - Action buttons (Approve / Reject / Mark Paid) with confirm + Edge Function update
 */
function attachClaimsListeners(content: HTMLElement) {
  // Attach View buttons (opens claim details modal)
  content.querySelectorAll('.view-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.idx!);
      const claim = adminClaimsCache[idx];
      showClaimDetails(claim);
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
      const idx = parseInt((btn as HTMLElement).dataset.idx!);
      const newStatus = (btn as HTMLElement).dataset.status!;
      const claim = adminClaimsCache[idx];

      if (!confirm(`Are you sure you want to ${newStatus.toUpperCase()} this claim from ${claim.referrer_code || 'unknown'}?`)) {
        return;
      }

      (btn as HTMLElement).textContent = 'Saving...';
      (btn as HTMLElement as HTMLButtonElement).disabled = true;

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

      } catch (err) {
        console.warn('[Admin] admin-action Edge Function failed. Local cache updated.', err);
      }

      updateClaimInCache(idx, {
        status: newStatus,
        ...(newStatus === 'paid' ? { paid_at: new Date().toISOString() } : {}),
      });

      const actionText = newStatus === 'approved' ? 'approved' : 
                         newStatus === 'rejected' ? 'rejected' : 'marked as paid';
      showToast(`Claim ${actionText}`, 'success');

      await renderPrizeClaimsTab(content);
    });
  });
}