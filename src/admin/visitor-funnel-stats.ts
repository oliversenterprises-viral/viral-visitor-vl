import { computeVisitorFunnelStats, getVisitorEventsForStats } from '../lib/visitor-tracking';
import { showToast } from '../ui';

function countryLabel(code: string): string {
  if (!code || code === '—') return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

function bindVisitorStatsRefresh(container: HTMLElement) {
  if (container.dataset.visitorRefreshBound === '1') return;
  container.dataset.visitorRefreshBound = '1';
  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-visitor-stats-refresh]');
    if (!btn || !container.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    void refreshVisitorFunnelStats(container, btn as HTMLButtonElement);
  });
}

async function refreshVisitorFunnelStats(container: HTMLElement, btn?: HTMLButtonElement) {
  const refreshBtn =
    btn || (container.querySelector('[data-visitor-stats-refresh]') as HTMLButtonElement | null);
  const originalLabel = refreshBtn?.textContent || '↻ Refresh';
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '↻ Refreshing…';
  }
  try {
    await renderVisitorFunnelStats(container);
    showToast('Visitor funnel stats refreshed', 'success');
  } catch {
    showToast('Could not refresh visitor stats', 'info');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = originalLabel;
    }
  }
}

export async function renderVisitorFunnelStats(container: HTMLElement, preloadedEvents?: any[]) {
  container.classList.add('visitor-funnel-stats-panel');
  bindVisitorStatsRefresh(container);

  let events: any[];
  let source: 'server' | 'local';
  let fetchError: string | undefined;

  if (preloadedEvents) {
    events = preloadedEvents;
    source = 'local';
  } else {
    const res = await getVisitorEventsForStats();
    events = res.events;
    source = res.source;
    fetchError = res.fetchError;
  }

  const stats = computeVisitorFunnelStats(events);
  const sourceLabel = source === 'server' ? 'Server (all visitors)' : 'Local (this browser only)';
  const refreshedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let html = `
    <div class="text-[10px] font-semibold text-violet-300 mb-1">
      Site Visitor Funnel (${sourceLabel})
    </div>
    <div class="text-[9px] text-zinc-500 mb-1">Updated ${refreshedAt}</div>
    <div class="text-[9px] text-zinc-400 mb-2">
      All traffic on viralrefer.app: landing → get link → copy → share → claim.
      <span class="text-violet-300/80">Unique</span> = distinct browsers (first-party ID). Country from server geo when available.
    </div>
    <div class="text-[9px] text-zinc-300 mb-2">
      Unique visitors (landings): <span class="tabular-nums text-violet-200">${stats.uniqueVisitorsLanding}</span>
      ${stats.uniqueVisitorsAny !== stats.uniqueVisitorsLanding ? ` · engaged (any step): <span class="tabular-nums text-violet-200">${stats.uniqueVisitorsAny}</span>` : ''}
      · <span class="text-zinc-500">${stats.total} events loaded${source === 'server' ? ' (latest 500 from server)' : ''}</span>
    </div>
  `;

  if (fetchError && source === 'local') {
    html += `<div class="text-[9px] text-amber-400/90 mb-2">Server fetch failed (${fetchError}) — showing this browser only.</div>`;
  }

  html += `
    <div class="flex gap-2 mb-2">
      <button type="button" data-visitor-stats-refresh class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded disabled:opacity-50">↻ Refresh</button>
    </div>
    <table class="w-full text-[9px] text-zinc-200 border border-white/10 mb-2">
      <thead><tr class="bg-white/5 text-violet-200">
        <th class="text-left p-1.5">Funnel step</th><th class="p-1.5 text-right">Events</th><th class="p-1.5 text-right">Unique</th>
      </tr></thead><tbody>
  `;

  for (const row of stats.funnel) {
    const uniqueLabel = row.unique > 0 ? String(row.unique) : '—';
    html += `<tr class="border-t border-white/5"><td class="p-1.5 text-zinc-100">${row.name}</td><td class="p-1.5 text-right tabular-nums text-zinc-300">${row.count}</td><td class="p-1.5 text-right tabular-nums text-violet-200/90">${uniqueLabel}</td></tr>`;
  }
  html += `</tbody></table>`;

  const countryRows = stats.byCountry.filter((c) => c.country !== '—');
  html += `<div class="text-[9px] text-zinc-400 mb-1">By country (landings):</div>`;
  if (countryRows.length) {
    html += `<table class="w-full text-[8px] text-zinc-200 border border-white/10 mb-2">
      <thead><tr class="bg-white/5 text-violet-200"><th class="text-left p-1">Country</th><th class="p-1 text-right">Unique</th><th class="p-1 text-right">Landings</th></tr></thead><tbody>`;
    for (const row of countryRows.slice(0, 10)) {
      const label = `${countryLabel(row.country)} (${row.country})`;
      html += `<tr class="border-t border-white/5"><td class="p-1 text-zinc-100">${label}</td><td class="p-1 text-right tabular-nums">${row.unique}</td><td class="p-1 text-right tabular-nums text-zinc-400">${row.events}</td></tr>`;
    }
    html += `</tbody></table>`;
  } else {
    html += `<div class="text-[9px] text-zinc-500 mb-2">No country data yet. New visits are geo-tagged automatically — open the public site, then Refresh.</div>`;
  }

  const sourceEntries = Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]);
  if (sourceEntries.length > 1 || (sourceEntries.length === 1 && sourceEntries[0][0] !== '(direct)')) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">By UTM source (landings only):</div>`;
    html += `<div class="text-[8px] text-zinc-300 mb-2">`;
    for (const [src, count] of sourceEntries.slice(0, 6)) {
      html += `<span class="inline-block mr-2 mb-1 px-1.5 py-0.5 bg-violet-900/40 border border-violet-500/30 rounded">${src}: ${count}</span>`;
    }
    html += `</div>`;
  }

  if (stats.lastEvents.length) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">Recent events:</div>`;
    html += `<div class="font-mono text-[8px] text-zinc-300 bg-black/40 border border-white/10 p-1.5 rounded max-h-24 overflow-y-auto">`;
    for (const e of stats.lastEvents) {
      const t = e.created_at ? new Date(String(e.created_at)).toLocaleString() : '';
      const src = e.utm_source ? ` [${e.utm_source}]` : '';
      const geo = e.country_code ? ` ${countryLabel(String(e.country_code))}` : '';
      html += `${t} ${e.event_name}${geo}${src}<br>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="text-[9px] text-zinc-500">No visitor funnel events yet. Browse the site and click Get my referral link.</div>`;
  }

  container.innerHTML = html;
}

export async function wireVisitorFunnelStatsQuick(root: HTMLElement) {
  const el = root.querySelector('#visitor-stats-quick') as HTMLElement | null;
  if (!el) return;
  await renderVisitorFunnelStats(el);
}