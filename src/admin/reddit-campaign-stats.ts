import { computeRedditFunnelStats, getRedditEventsForStats, getLocalRedditEvents } from '../lib/reddit-tracking';
export async function renderRedditCampaignStats(container: HTMLElement, preloadedEvents?: any[]) {
  container.classList.add('reddit-campaign-stats-panel');

  let events: any[];
  let source: 'server' | 'local';
  if (preloadedEvents) {
    events = preloadedEvents;
    source = 'local';
  } else {
    const res = await getRedditEventsForStats();
    events = res.events;
    source = res.source;
  }

  const stats = computeRedditFunnelStats(events);
  const sourceLabel = source === 'server' ? 'Server (all Reddit visitors)' : 'Local (this browser only)';
  const pixelId = 'a2_jr6jdbg2r4';

  let html = `
    <div class="text-[10px] font-semibold text-orange-300 mb-1">
      Reddit Campaign Funnel (${sourceLabel})
      <span class="text-orange-300/60"> — pixel ${pixelId}</span>
    </div>
    <div class="text-[9px] text-zinc-400 mb-2">
      Tracks Reddit ad visitors: landing → get link → copy → share → claim. Register matching Custom events in Reddit Events Manager.
    </div>
    <div class="flex gap-2 mb-2">
      <button id="rs-refresh" class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">↻ Refresh</button>
      <a href="https://ads.reddit.com/events-manager" target="_blank" rel="noopener" class="text-[9px] px-2 py-0.5 bg-orange-600/40 hover:bg-orange-600/60 text-orange-100 rounded">Open Reddit Events Manager</a>
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

  if (stats.lastEvents.length) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">Recent events:</div>`;
    html += `<div class="font-mono text-[8px] text-zinc-300 bg-black/40 border border-white/10 p-1.5 rounded max-h-24 overflow-y-auto">`;
    for (const e of stats.lastEvents) {
      const t = e.created_at ? new Date(e.created_at).toLocaleString() : '';
      html += `${t} ${e.event_name} ${e.utm_campaign ? `(${e.utm_campaign})` : ''}<br>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="text-[9px] text-zinc-500">No Reddit funnel events yet. Visit with <code class="text-orange-200">?utm_source=reddit</code> and click Get my referral link.</div>`;
  }

  container.innerHTML = html;

  const ref = container.querySelector('#rs-refresh') as HTMLButtonElement | null;
  if (ref) {
    ref.onclick = () => renderRedditCampaignStats(container);
  }
}

export async function wireRedditCampaignStatsQuick(root: HTMLElement) {
  const el = root.querySelector('#reddit-stats-quick') as HTMLElement | null;
  if (!el) return;
  const local = getLocalRedditEvents();
  await renderRedditCampaignStats(el, local);
  renderRedditCampaignStats(el).catch(() => {});
}