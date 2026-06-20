import { clearBannerEvents, computeBannerStats, getBannerEventsForStats, getLocalBannerEvents } from '../content';
import { showToast } from '../ui';

function bindBannerStatsActions(container: HTMLElement) {
  if (container.dataset.bannerRefreshBound === '1') return;
  container.dataset.bannerRefreshBound = '1';
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const refreshBtn = target.closest('[data-banner-stats-refresh]');
    const clearBtn = target.closest('[data-banner-stats-clear]');
    const copyBtn = target.closest('[data-banner-stats-copy]');
    if (!container.contains(refreshBtn || clearBtn || copyBtn)) return;

    if (refreshBtn) {
      e.preventDefault();
      e.stopPropagation();
      void refreshBannerStats(container, refreshBtn as HTMLButtonElement);
      return;
    }
    if (clearBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('Clear all local banner events?')) return;
      clearBannerEvents();
      void renderBannerStats(container);
      showToast('Local banner stats cleared', 'info');
      return;
    }
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const payload = container.dataset.bannerStatsCopy;
      if (payload) {
        navigator.clipboard.writeText(payload).then(() => showToast('Copied banner stats JSON', 'success'));
      }
    }
  });
}

async function refreshBannerStats(container: HTMLElement, btn?: HTMLButtonElement) {
  const refreshBtn =
    btn || (container.querySelector('[data-banner-stats-refresh]') as HTMLButtonElement | null);
  const originalLabel = refreshBtn?.textContent || '↻ Refresh';
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '↻ Refreshing…';
  }
  try {
    await renderBannerStats(container);
    showToast('Banner stats refreshed', 'success');
  } catch {
    showToast('Could not refresh banner stats', 'info');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = originalLabel;
    }
  }
}

/**
 * Renders the Banner Performance stats UI into the given container.
 * Supports preloaded local events for immediate render (banner-stats-quick at tab top).
 */
export async function renderBannerStats(container: HTMLElement, preloadedEvents?: any[]) {
  container.classList.add('banner-stats-panel');
  bindBannerStatsActions(container);

  let events: any[];
  let source: 'server' | 'local';
  let fetchError: string | undefined;

  if (preloadedEvents) {
    events = preloadedEvents;
    source = 'local';
  } else {
    const res = await getBannerEventsForStats();
    events = res.events;
    source = res.source;
    fetchError = res.fetchError;
  }

  const stats = computeBannerStats(events);
  const currentBanners = (window as any).__currentBannersForStats || [];
  const currentKeys = new Set(
    currentBanners.map((b: any) => {
      const lab = (b.label || '').trim();
      const u = (b.redirectUrl || '').trim();
      return lab && u ? `${lab}|${u}` : u || lab || '';
    }),
  );

  const isServer = source === 'server';
  const sourceLabel = isServer ? 'Server (cross-browser)' : 'Local (this browser)';
  const sourceNote = isServer
    ? '— persisted via banner_events table'
    : '— localStorage only (last 50)';
  const refreshedAt = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const copyPayload = JSON.stringify(
    { generated: new Date().toISOString(), source, stats, rawEvents: events.slice(-50) },
    null,
    2,
  );
  container.dataset.bannerStatsCopy = copyPayload;

  let html = `
    <div class="text-[10px] font-semibold text-emerald-400 mb-1">Banner Performance (${sourceLabel})
      <span class="text-emerald-400/60">${sourceNote}</span>
    </div>
    <div class="text-[9px] text-zinc-500 mb-1">Updated ${refreshedAt}</div>
  `;

  if (fetchError && source === 'local') {
    html += `<div class="text-[9px] text-amber-400/90 mb-2">Server fetch failed (${fetchError}) — showing this browser only.</div>`;
  }

  html += `
    <div class="flex gap-2 mb-2">
      <button type="button" data-banner-stats-refresh class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded disabled:opacity-50">↻ Refresh</button>
      <button type="button" data-banner-stats-clear class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">🗑 Clear Local</button>
      <button type="button" data-banner-stats-copy class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">⎘ Copy JSON</button>
    </div>
  `;

  html += `<div class="text-[9px] text-zinc-400 mb-1">Last ${Math.min(5, stats.lastEvents.length)} events:</div>`;
  if (stats.lastEvents.length) {
    html += `<div class="font-mono text-[8px] text-zinc-300 bg-black/40 border border-white/10 p-1.5 rounded mb-2">`;
    stats.lastEvents.forEach((e: any) => {
      const t = e.timestamp ? new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const eventType = e.type || e.event_type || '';
      html += `${t} ${eventType} ${escapeHtmlForStats(e.label || e.redirectUrl || '')}<br>`;
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
    const ctr = b.impressions ? ((b.clicks / b.impressions) * 100).toFixed(1) + '%' : '—';
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
}

export async function wireBannerStatsQuick(root: HTMLElement) {
  const el = root.querySelector('#banner-stats-quick') as HTMLElement | null;
  if (!el) return;
  const local = getLocalBannerEvents();
  if (local.length) {
    await renderBannerStats(el, local);
  }
  await renderBannerStats(el);
}

function escapeHtmlForStats(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}