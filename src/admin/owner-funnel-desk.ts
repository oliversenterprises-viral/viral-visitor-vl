/**
 * First screen after the owner password: five numbers + one feed.
 * Server only. No Claims / Promoters / Died-waiting tiles.
 */

import { invokeAdminAction } from '../lib/admin-action-client';
import { escapeHtml } from '../lib/escape-html';
import { formatEventTimestampLabel } from '../lib/stats-helpers';
import { showToast } from '../ui';
import type { OwnerFunnelDeskMetrics, OwnerFunnelFeedRow } from './owner-funnel-desk-helpers';

const SKELETON = `
  <div class="space-y-4 py-1" data-owner-funnel-desk="1">
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
    </div>
    <div class="h-40 skeleton rounded-2xl"></div>
  </div>
`;

const EMPTY_METRICS: OwnerFunnelDeskMetrics = {
  windowDays: 7,
  landings: 0,
  getLink: 0,
  share: 0,
  locked: 0,
  getLinkRate: '—',
  feed: [],
};

function tile(label: string, value: string | number, note: string): string {
  return `
    <article class="rounded-2xl border border-white/10 bg-zinc-900/50 px-3 py-3">
      <div class="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">${escapeHtml(label)}</div>
      <div class="text-2xl font-bold text-white tabular-nums mt-1">${escapeHtml(String(value))}</div>
      <div class="text-[11px] text-zinc-400 mt-1">${escapeHtml(note)}</div>
    </article>`;
}

function feedLine(row: OwnerFunnelFeedRow): string {
  const when = formatEventTimestampLabel(row.at) || row.at;
  const codes =
    row.kind === 'locked' && row.code
      ? row.friendCode
        ? `<span class="text-violet-200 font-semibold">${escapeHtml(row.code)}</span>
           <span class="text-zinc-500"> ← </span>
           <span class="text-zinc-200">${escapeHtml(row.friendCode)}</span>`
        : `<span class="text-violet-200 font-semibold">${escapeHtml(row.code)}</span>`
      : '';
  return `
    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 border-b border-white/5 last:border-0">
      <span class="text-[10px] text-zinc-500 tabular-nums">${escapeHtml(when)}</span>
      <span class="text-sm text-white font-semibold">${escapeHtml(row.label)}</span>
      ${codes}
      <span class="text-[11px] text-zinc-500">Via ${escapeHtml(row.viaLabel)}</span>
    </div>`;
}

export function renderOwnerFunnelDeskView(
  container: HTMLElement,
  metrics: OwnerFunnelDeskMetrics,
  error?: string,
): void {
  container.classList.add('owner-funnel-desk');

  if (error) {
    container.innerHTML = `
      <div data-owner-funnel-desk="1" class="space-y-3">
        <div class="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          can’t load.
        </div>
        <button type="button" data-owner-desk-refresh class="text-xs px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-zinc-100">↻ Retry</button>
      </div>`;
    return;
  }

  const feedHtml = metrics.feed.length
    ? metrics.feed.map(feedLine).join('')
    : `<div class="text-sm text-zinc-500 py-2">No loop events in the last ${metrics.windowDays} days.</div>`;

  container.innerHTML = `
    <div data-owner-funnel-desk="1" class="space-y-4">
      <p class="text-sm text-zinc-400">Last ${metrics.windowDays} days · owner IP, test codes, and webdriver excluded.</p>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3" data-owner-desk-tiles>
        ${tile('Landings', metrics.landings, 'Unique people who landed')}
        ${tile('Get-link', metrics.getLink, 'Unique people who tapped Get my link')}
        ${tile('Share', metrics.share, 'Verified send — not copy')}
        ${tile('Locked', metrics.locked, 'Codes with a real friend credit')}
        ${tile('Get-link rate', metrics.getLinkRate, 'Get-link / Landings')}
      </div>
      <section class="rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3">
        <div class="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold mb-2">
          Landed · Got a link · Shared · Locked
        </div>
        <div data-owner-desk-feed class="max-h-80 overflow-y-auto">${feedHtml}</div>
      </section>
      <div class="flex items-center gap-2">
        <button type="button" data-owner-desk-refresh class="text-xs px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-zinc-100">↻ Refresh</button>
        <span class="text-[10px] text-zinc-500">Server only</span>
      </div>

    </div>
  `;
}

function bindRefresh(container: HTMLElement): void {
  if (container.dataset.ownerDeskBound === '1') return;
  container.dataset.ownerDeskBound = '1';
  container.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const more = target.closest('[data-owner-desk-more]');
    if (more && container.contains(more)) {
      event.preventDefault();
      const panel = container.querySelector<HTMLElement>('[data-owner-desk-more-panel]');
      if (panel) panel.hidden = !panel.hidden;
      return;
    }
    const tool = target.closest('[data-owner-desk-tool]');
    if (tool && container.contains(tool)) {
      event.preventDefault();
      const tab = Number(tool.getAttribute('data-owner-desk-tool'));
      const switchFn = (window as unknown as { switchAdminTab?: (n: number) => void }).switchAdminTab;
      if (Number.isFinite(tab)) switchFn?.(tab);
      return;
    }
    const btn = target.closest('[data-owner-desk-refresh]');
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
    showToast('can’t load.', 'info');
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
  const result = await invokeAdminAction<OwnerFunnelDeskMetrics>('get_owner_funnel_desk');
  if (!result.success) {
    renderOwnerFunnelDeskView(container, EMPTY_METRICS, result.error || 'can’t load.');
    return;
  }
  renderOwnerFunnelDeskView(container, result.data);
}
