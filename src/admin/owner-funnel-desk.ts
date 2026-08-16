/**
 * One owner desk: run the funnel. Server metrics only. No tab pile.
 */

import { invokeAdminAction } from '../lib/admin-action-client';
import { escapeHtml } from '../lib/escape-html';
import { showToast } from '../ui';
import type { OwnerFunnelDeskMetrics } from './owner-funnel-desk-helpers';

const SKELETON = `
  <div class="space-y-4 py-1" data-owner-funnel-desk="1">
    <div class="h-16 skeleton rounded-2xl"></div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
    </div>
  </div>
`;

function tile(
  label: string,
  value: string | number,
  note: string,
  extra = '',
): string {
  return `
    <article class="rounded-2xl border border-white/10 bg-zinc-900/50 px-3 py-3">
      <div class="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">${escapeHtml(label)}</div>
      <div class="text-2xl font-bold text-white tabular-nums mt-1">${escapeHtml(String(value))}</div>
      <div class="text-[11px] text-zinc-400 mt-1">${escapeHtml(note)}</div>
      ${extra}
    </article>`;
}

export function renderOwnerFunnelDeskView(
  container: HTMLElement,
  metrics: OwnerFunnelDeskMetrics,
  error?: string,
): void {
  container.classList.add('owner-funnel-desk');
  const closedJune = metrics.staleJuneBanners.length
    ? metrics.staleJuneBanners.map((b) => b.label || 'June banner').join(', ')
    : '';
  const bannerPanel =
    metrics.bannerCtr && metrics.liveBanner
      ? `
    <aside class="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-3" data-owner-banner-ctr>
      <div class="text-[10px] uppercase tracking-wide text-emerald-300 font-semibold">Live banner CTR</div>
      <div class="text-sm text-white mt-1">${escapeHtml(metrics.bannerCtr.label)}</div>
      <div class="text-[11px] text-zinc-400 mt-1">
        ${metrics.bannerCtr.impressions} views · ${metrics.bannerCtr.clicks} clicks · ${escapeHtml(metrics.bannerCtr.ctr)}
      </div>
    </aside>`
      : '';

  const errorBox = error
    ? `<div class="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-200 mb-3">${escapeHtml(error)}</div>`
    : '';

  const juneNote = closedJune
    ? `<div class="text-[11px] text-zinc-500 mb-3">Closed stale June #1 banner: ${escapeHtml(closedJune)}</div>`
    : '';

  container.innerHTML = `
    <div data-owner-funnel-desk="1" class="space-y-4">
      ${errorBox}
      <div class="rounded-2xl border border-violet-500/30 bg-violet-950/20 px-4 py-3">
        <div class="text-[10px] uppercase tracking-wide text-violet-300 font-semibold">Hero conversion</div>
        <div class="mt-1 text-lg font-bold text-white">
          Get-link ${escapeHtml(metrics.heroGetLinkRate)}
          <span class="text-zinc-500 font-medium"> of landings</span>
          <span class="text-zinc-600 mx-2">→</span>
          Lock ${escapeHtml(metrics.heroLockRate)}
          <span class="text-zinc-500 font-medium"> of get-link</span>
        </div>
        <p class="text-[11px] text-zinc-400 mt-1">Copy is not success. Claims are not conversion.</p>
      </div>
      ${juneNote}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3" data-owner-desk-tiles>
        ${tile('Landings', metrics.landings, 'Unique SiteLanding')}
        ${tile('Get-link', metrics.getLink, `Unique GetReferralLink · ${metrics.getLinkRate} of landings`)}
        ${tile('Share', metrics.share, `ShareReferral / shares, copy excluded · ${metrics.shareRate} of get-link`)}
        ${tile('Lock', metrics.lock, 'Referral rows · friend Get my link only · test/owner out')}
        ${tile('Died waiting', metrics.diedWaiting, 'Get-link with no lock in 48h')}
        ${tile('Promoters', `${metrics.promoterLinks} + ${metrics.creditedGetLinks}`, 'New promoter links + credited friend Get-links')}
        ${tile('Claims', metrics.pendingClaims, metrics.liveBanner ? `Pending prize claims · live banner: ${metrics.liveBannerLabel}` : 'Pending prize claims · no live banner')}
      </div>
      ${bannerPanel}
      <div class="flex items-center gap-2">
        <button type="button" data-owner-desk-refresh class="text-xs px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-zinc-100">↻ Refresh</button>
        <span class="text-[10px] text-zinc-500">Server only · no local stats</span>
      </div>
    </div>
  `;
}

function bindRefresh(container: HTMLElement): void {
  if (container.dataset.ownerDeskBound === '1') return;
  container.dataset.ownerDeskBound = '1';
  container.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest('[data-owner-desk-refresh]');
    if (!btn || !container.contains(btn)) return;
    event.preventDefault();
    void refreshOwnerFunnelDesk(container, btn as HTMLButtonElement);
  });
}

async function refreshOwnerFunnelDesk(
  container: HTMLElement,
  btn?: HTMLButtonElement,
): Promise<void> {
  const original = btn?.textContent || '↻ Refresh';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '↻ Refreshing…';
  }
  try {
    await renderOwnerFunnelDesk(container);
    showToast('Funnel desk refreshed', 'success');
  } catch {
    showToast('Could not refresh funnel desk', 'info');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
  }
}

export async function renderOwnerFunnelDesk(container: HTMLElement): Promise<void> {
  bindRefresh(container);
  container.innerHTML = SKELETON;
  const result = await invokeAdminAction<OwnerFunnelDeskMetrics>('get_owner_funnel_desk', {
    close_stale_june: true,
  });
  if (!result.success) {
    renderOwnerFunnelDeskView(
      container,
      {
        landings: 0,
        getLink: 0,
        getLinkRate: '—',
        share: 0,
        shareRate: '—',
        lock: 0,
        lockRate: '—',
        diedWaiting: 0,
        promoterLinks: 0,
        creditedGetLinks: 0,
        pendingClaims: 0,
        liveBanner: false,
        liveBannerLabel: '',
        heroGetLinkRate: '—',
        heroLockRate: '—',
        bannerCtr: null,
        staleJuneBanners: [],
      },
      result.error || 'Server data unavailable',
    );
    return;
  }
  renderOwnerFunnelDeskView(container, result.data);
}
