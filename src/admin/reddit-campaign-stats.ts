/** Premium Reddit campaign quick-stats panel (admin audit). */
import { computeRedditFunnelStats, getLocalRedditEvents, getRedditEventsForStats } from '../lib/reddit-tracking';
import { escapeHtml } from '../content';
import { showToast } from '../ui';
import {
  REDDIT_PIXEL_DISPLAY_ID,
  computeRedditFunnelTotals,
  shouldShowCampaignBreakdown,
  sortCampaignEntries,
  topCampaigns,
} from './reddit-campaign-stats-helpers';

const SKELETON = `<div class="space-y-2 py-1"><div class="h-4 w-56 skeleton rounded"></div><div class="h-16 skeleton rounded"></div></div>`;

function bindRedditStatsRefresh(container: HTMLElement) {
  if (container.dataset.redditRefreshBound === '1') return;
  container.dataset.redditRefreshBound = '1';
  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-reddit-stats-refresh]');
    const csvBtn = (e.target as HTMLElement).closest('[data-reddit-stats-csv]');
    if (csvBtn && container.contains(csvBtn)) {
      e.preventDefault();
      const csv = container.dataset.redditStatsCsv;
      if (!csv) return;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `viralrefer-reddit-funnel-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Reddit funnel CSV downloaded', 'success');
      return;
    }
    if (!btn || !container.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    void refreshRedditCampaignStats(container, btn as HTMLButtonElement);
  });
}

async function refreshRedditCampaignStats(container: HTMLElement, btn?: HTMLButtonElement) {
  const refreshBtn =
    btn || (container.querySelector('[data-reddit-stats-refresh]') as HTMLButtonElement | null);
  const originalLabel = refreshBtn?.textContent || '↻ Refresh';
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '↻ Refreshing…';
  }
  try {
    await renderRedditCampaignStats(container);
    showToast('Reddit funnel stats refreshed', 'success');
  } catch {
    showToast('Could not refresh Reddit stats', 'info');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = originalLabel;
    }
  }
}

function buildRedditCsv(funnel: Array<{ name: string; count: number }>): string {
  const headers = ['step', 'count'];
  const rows = funnel.map((r) => [r.name, r.count].join(','));
  return [headers.join(','), ...rows].join('\n');
}

function renderRedditCampaignView(
  container: HTMLElement,
  events: Array<Record<string, unknown>>,
  source: 'server' | 'local',
  fetchError?: string,
) {
  const stats = computeRedditFunnelStats(events);
  const totals = computeRedditFunnelTotals(stats.funnel);
  const isServer = source === 'server';
  const refreshedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  container.dataset.redditStatsCsv = buildRedditCsv(stats.funnel);

  let html = `
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <div class="text-[10px] font-semibold text-orange-300">Reddit Campaign Funnel</div>
      ${isServer ? '<span class="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-200 text-[8px]">SERVER</span>' : '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[8px]">LOCAL</span>'}
      <span class="text-[9px] text-zinc-500">Updated ${refreshedAt} · pixel ${REDDIT_PIXEL_DISPLAY_ID}</span>
    </div>
    <div class="text-[9px] text-zinc-400 mb-2">Reddit UTM traffic only (<code class="text-orange-200/80">utm_source=reddit</code>).</div>
  `;

  if (fetchError && !isServer) {
    html += `<div class="text-[9px] text-amber-400/90 mb-2">Server unavailable (${escapeHtml(fetchError)}) — local data shown.</div>`;
  }

  html += `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Landings</div><div class="text-lg font-bold text-white tabular-nums">${totals.landings}</div></div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Claims</div><div class="text-lg font-bold text-orange-300 tabular-nums">${totals.claims}</div></div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Events</div><div class="text-lg font-bold text-white tabular-nums">${stats.total}</div></div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Conv.</div><div class="text-lg font-bold text-emerald-300 tabular-nums">${totals.conversion}</div></div>
    </div>
    <div class="flex gap-2 mb-2 flex-wrap">
      <button type="button" data-reddit-stats-refresh class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded disabled:opacity-50">↻ Refresh</button>
      <button type="button" data-reddit-stats-csv class="text-[9px] px-2 py-0.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded">⬇ CSV</button>
      <a href="https://ads.reddit.com/events-manager/testing" target="_blank" rel="noopener" class="text-[9px] px-2 py-0.5 bg-orange-600/40 hover:bg-orange-600/60 text-orange-100 rounded">Event testing</a>
    </div>
    <table class="w-full text-[9px] text-zinc-200 border border-white/10 mb-2">
      <thead><tr class="bg-white/5 text-orange-200"><th class="text-left p-1.5">Step</th><th class="p-1.5 text-right">Count</th></tr></thead><tbody>
  `;

  for (const row of stats.funnel) {
    html += `<tr class="border-t border-white/5"><td class="p-1.5 text-zinc-100">${escapeHtml(row.name)}</td><td class="p-1.5 text-right tabular-nums text-zinc-300">${row.count}</td></tr>`;
  }
  html += `</tbody></table>`;

  if (shouldShowCampaignBreakdown(stats.byCampaign)) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">By campaign (Reddit landings):</div><div class="text-[8px] text-zinc-300 mb-2">`;
    for (const [camp, count] of topCampaigns(sortCampaignEntries(stats.byCampaign))) {
      html += `<span class="inline-block mr-2 mb-1 px-1.5 py-0.5 bg-orange-900/40 border border-orange-500/30 rounded">${escapeHtml(camp)}: ${count}</span>`;
    }
    html += `</div>`;
  }

  if (stats.lastEvents.length) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">Recent events:</div><div class="font-mono text-[8px] text-zinc-300 bg-black/40 border border-white/10 p-1.5 rounded max-h-24 overflow-y-auto">`;
    for (const e of stats.lastEvents) {
      const camp = e.utm_campaign ? ` (${e.utm_campaign})` : '';
      html += `${escapeHtml(String(e.event_name || ''))}${escapeHtml(String(camp))}<br>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="text-[9px] text-zinc-500">No Reddit events yet. Visit with <code class="text-orange-200">?utm_source=reddit</code>.</div>`;
  }

  container.innerHTML = html;
}

export async function renderRedditCampaignStats(
  container: HTMLElement,
  preloadedEvents?: Array<Record<string, unknown>>,
) {
  container.classList.add('reddit-campaign-stats-panel');
  bindRedditStatsRefresh(container);

  if (preloadedEvents) {
    renderRedditCampaignView(container, preloadedEvents, 'local');
    return;
  }

  const res = await getRedditEventsForStats();
  renderRedditCampaignView(container, res.events, res.source, res.fetchError);
}

export async function wireRedditCampaignStatsQuick(root: HTMLElement) {
  const el = root.querySelector('#reddit-stats-quick') as HTMLElement | null;
  if (!el) return;
  bindRedditStatsRefresh(el);
  const local = getLocalRedditEvents();
  if (local.length) {
    renderRedditCampaignView(el, local, 'local');
  } else {
    el.innerHTML = SKELETON;
  }
  try {
    const res = await getRedditEventsForStats();
    renderRedditCampaignView(el, res.events, res.source, res.fetchError);
  } catch {
    if (!local.length) {
      el.innerHTML = `<div class="text-[9px] text-amber-400">Could not load Reddit stats. Click Refresh.</div>`;
    }
  }
}