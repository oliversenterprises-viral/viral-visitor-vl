import { clearBannerEvents, computeBannerStats, getBannerEventsForStats } from '../content';
import { showToast } from '../ui';

/**
 * Renders the Banner Performance stats UI into the given container.
 * Supports preloaded local events for immediate render (banner-stats-quick at tab top).
 */
export async function renderBannerStats(container: HTMLElement, preloadedEvents?: any[]) {
  container.classList.add('banner-stats-panel');
  let events: any[];
  let source: 'server' | 'local';
  if (preloadedEvents) {
    events = preloadedEvents;
    source = 'local';
  } else {
    const res = await getBannerEventsForStats();
    events = res.events;
    source = res.source;
  }
  const stats = computeBannerStats(events);
  const currentBanners = (window as any).__currentBannersForStats || [];
  const currentKeys = new Set(currentBanners.map((b: any) => {
    const lab = (b.label || '').trim();
    const u = (b.redirectUrl || '').trim();
    return lab && u ? `${lab}|${u}` : (u || lab || '');
  }));

  const isServer = source === 'server';
  const sourceLabel = isServer ? 'Server (cross-browser)' : 'Local (this browser)';
  const sourceNote = isServer
    ? '— persisted via banner_events table'
    : '— localStorage only (last 50)';

  let html = `
    <div class="text-[10px] font-semibold text-emerald-400 mb-1">Banner Performance (${sourceLabel})
      <span class="text-emerald-400/60">${sourceNote}</span>
    </div>
    <div class="flex gap-2 mb-2">
      <button id="bs-refresh" class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">↻ Refresh</button>
      <button id="bs-clear" class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">🗑 Clear Local</button>
      <button id="bs-copy" class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">⎘ Copy JSON</button>
    </div>
  `;

  html += `<div class="text-[9px] text-zinc-400 mb-1">Last ${Math.min(5, stats.lastEvents.length)} events:</div>`;
  if (stats.lastEvents.length) {
    html += `<div class="font-mono text-[8px] text-zinc-300 bg-black/40 border border-white/10 p-1.5 rounded mb-2">`;
    stats.lastEvents.forEach((e: any) => {
      html += `${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${e.type} ${escapeHtmlForStats(e.label || e.redirectUrl || '')}<br>`;
    });
    html += `</div>`;
  } else {
    html += `<div class="text-[9px] text-zinc-500 mb-2">No events yet. Save banners, hard-refresh the public site, then click Refresh.</div>`;
  }

  html += `
    <table class="banner-stats-table w-full text-[9px] text-zinc-200 border border-white/10">
      <thead><tr class="text-emerald-300 bg-white/5">
        <th class="text-left p-1.5 text-emerald-300">Banner</th><th class="p-1.5 text-emerald-300">Imps</th><th class="p-1.5 text-emerald-300">Clicks</th><th class="p-1.5 text-emerald-300">CTR</th>
      </tr></thead><tbody class="text-zinc-200">
  `;
  stats.perBanner.forEach((b: any) => {
    const isCurrent = currentKeys.has(b.key);
    const ctr = b.impressions ? (b.clicks / b.impressions * 100).toFixed(1) + '%' : '—';
    html += `
      <tr class="border-t border-white/5 ${isCurrent ? 'bg-emerald-900/20' : ''}">
        <td class="p-1.5 truncate max-w-[140px] text-zinc-100">${escapeHtmlForStats(b.label)}${isCurrent ? ' <span class="text-emerald-400">(current)</span>' : ''}</td>
        <td class="p-1.5 text-center tabular-nums text-zinc-300">${b.impressions}</td>
        <td class="p-1.5 text-center tabular-nums text-zinc-300">${b.clicks}</td>
        <td class="p-1.5 text-center tabular-nums text-emerald-300/90">${ctr}</td>
      </tr>
    `;
  });
  if (!stats.perBanner.length) {
    html += `<tr><td colspan="4" class="p-1 text-zinc-500">No data</td></tr>`;
  }
  html += `</tbody></table>`;

  container.innerHTML = html;

  const ref = container.querySelector('#bs-refresh') as HTMLButtonElement | null;
  if (ref) ref.onclick = () => renderBannerStats(container);

  const clr = container.querySelector('#bs-clear') as HTMLButtonElement | null;
  if (clr) clr.onclick = () => {
    if (!confirm('Clear all local banner events?')) return;
    clearBannerEvents();
    renderBannerStats(container);
    showToast('Local banner stats cleared', 'info');
  };

  const cpy = container.querySelector('#bs-copy') as HTMLButtonElement | null;
  if (cpy) cpy.onclick = () => {
    const payload = { generated: new Date().toISOString(), source, stats, rawEvents: events.slice(-50) };
    const str = JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(str).then(() => showToast('Copied banner stats JSON', 'success'));
  };
}

function escapeHtmlForStats(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}