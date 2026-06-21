import { computeRedditFunnelStats, getRedditEventsForStats } from '../lib/reddit-tracking';
import { showToast } from '../ui';

function bindRedditStatsRefresh(container: HTMLElement) {
  if (container.dataset.redditRefreshBound === '1') return;
  container.dataset.redditRefreshBound = '1';
  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-reddit-stats-refresh]');
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

export async function renderRedditCampaignStats(container: HTMLElement, preloadedEvents?: any[]) {
  container.classList.add('reddit-campaign-stats-panel');
  bindRedditStatsRefresh(container);

  let events: any[];
  let source: 'server' | 'local';
  let fetchError: string | undefined;

  if (preloadedEvents) {
    events = preloadedEvents;
    source = 'local';
  } else {
    const res = await getRedditEventsForStats();
    events = res.events;
    source = res.source;
    fetchError = res.fetchError;
  }

  const stats = computeRedditFunnelStats(events);
  const sourceLabel = source === 'server' ? 'Server (all Reddit visitors)' : 'Local (this browser only)';
  const pixelId = 'a2_jr6jdbg2r4';
  const refreshedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let html = `
    <div class="text-[10px] font-semibold text-orange-300 mb-1">
      Reddit Campaign Funnel (${sourceLabel})
      <span class="text-orange-300/60"> — pixel ${pixelId}</span>
    </div>
    <div class="text-[9px] text-zinc-500 mb-1">Updated ${refreshedAt}</div>
    <div class="text-[9px] text-zinc-400 mb-2">
      Reddit UTM traffic only (<code class="text-orange-200/80">utm_source=reddit</code>). Funnel steps + pixel events. Counts = total actions, not unique visitors.
    </div>
    <div class="text-[9px] text-zinc-500 mb-2">${stats.total} events loaded${source === 'server' ? ' (latest 500 from server)' : ''}</div>
  `;

  if (fetchError && source === 'local') {
    html += `<div class="text-[9px] text-amber-400/90 mb-2">Server fetch failed (${fetchError}) — showing this browser only.</div>`;
  }

  html += `
    <div class="flex gap-2 mb-2">
      <button type="button" data-reddit-stats-refresh class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded disabled:opacity-50">↻ Refresh</button>
      <a href="https://ads.reddit.com/events-manager/testing" target="_blank" rel="noopener" class="text-[9px] px-2 py-0.5 bg-orange-600/40 hover:bg-orange-600/60 text-orange-100 rounded">Event testing</a>
    </div>
    <table class="w-full text-[9px] text-zinc-200 border border-white/10 mb-2">
      <thead><tr class="bg-white/5 text-orange-200">
        <th class="text-left p-1.5">Funnel step</th><th class="p-1.5 text-right">Count</th>
      </tr></thead><tbody>
  `;

  for (const row of stats.funnel) {
    html += `<tr class="border-t border-white/5"><td class="p-1.5 text-zinc-100">${row.name}</td><td class="p-1.5 text-right tabular-nums text-zinc-300">${row.count}</td></tr>`;
  }
  html += `</tbody></table>`;

  const campaignEntries = Object.entries(stats.byCampaign).sort((a, b) => b[1] - a[1]);
  if (campaignEntries.length > 0 && !(campaignEntries.length === 1 && campaignEntries[0][0] === '(none)')) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">By campaign (Reddit landings):</div>`;
    html += `<div class="text-[8px] text-zinc-300 mb-2">`;
    for (const [camp, count] of campaignEntries.slice(0, 6)) {
      html += `<span class="inline-block mr-2 mb-1 px-1.5 py-0.5 bg-orange-900/40 border border-orange-500/30 rounded">${camp}: ${count}</span>`;
    }
    html += `</div>`;
  }

  if (stats.lastEvents.length) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">Recent events:</div>`;
    html += `<div class="font-mono text-[8px] text-zinc-300 bg-black/40 border border-white/10 p-1.5 rounded max-h-24 overflow-y-auto">`;
    for (const e of stats.lastEvents) {
      const t = e.created_at ? new Date(String(e.created_at)).toLocaleString() : '';
      html += `${t} ${e.event_name} ${e.utm_campaign ? `(${e.utm_campaign})` : ''}<br>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="text-[9px] text-zinc-500">No Reddit funnel events yet. Visit with <code class="text-orange-200">?utm_source=reddit</code> and click Get my referral link.</div>`;
  }

  container.innerHTML = html;
}

export async function wireRedditCampaignStatsQuick(root: HTMLElement) {
  const el = root.querySelector('#reddit-stats-quick') as HTMLElement | null;
  if (!el) return;
  await renderRedditCampaignStats(el);
}