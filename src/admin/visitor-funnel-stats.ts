/** Premium visitor funnel quick-stats panel (admin audit). */
import { computeVisitorFunnelStats, getLocalVisitorEvents, getVisitorEventsForStats } from '../lib/visitor-tracking';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { escapeHtml } from '../content';
import { showToast } from '../ui';
import {
  eventTimestamp,
  formatEventTimestampLabel,
  latestEventTimestamp,
} from '../lib/stats-helpers';
import {
  countryLabel,
  computeFunnelTotals,
  countRecentReferralNotifiers,
  filterCountryRowsForDisplay,
  filterExcludedVisitorFunnelEvents,
  formatRecentVisitorEventDetail,
  getReferralNotifierIp,
  isRecentReferralNotifier,
  shouldShowUtmSources,
  sortSourceEntries,
  topCountries,
  type RecentReferralNotifierRow,
} from './visitor-funnel-stats-helpers';

const SKELETON = `<div class="space-y-2 py-1"><div class="h-4 w-56 skeleton rounded"></div><div class="h-16 skeleton rounded"></div></div>`;

function bindVisitorStatsRefresh(container: HTMLElement) {
  if (container.dataset.visitorRefreshBound === '1') return;
  container.dataset.visitorRefreshBound = '1';
  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-visitor-stats-refresh]');
    const csvBtn = (e.target as HTMLElement).closest('button[data-visitor-stats-csv]');
    if (csvBtn && container.contains(csvBtn)) {
      e.preventDefault();
      const csv = container.dataset.visitorCsvPayload;
      if (!csv) return;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `viralrefer-visitor-funnel-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Visitor funnel CSV downloaded', 'success');
      return;
    }
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

function buildVisitorCsv(funnel: Array<{ name: string; count: number; unique: number }>): string {
  const headers = ['step', 'events', 'unique'];
  const rows = funnel.map((r) => [r.name, r.count, r.unique].join(','));
  return [headers.join(','), ...rows].join('\n');
}

interface ReferralNotifierFetchResult {
  rows: RecentReferralNotifierRow[];
  error?: string;
}

async function fetchRecentReferralsForNotifier(limit = 6): Promise<ReferralNotifierFetchResult> {
  if (!isSupabaseConfigured || import.meta.env.MODE === 'test') return { rows: [] };
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('referrer_code, referred_ip, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { rows: [], error: error.message };
    return { rows: (data || []) as RecentReferralNotifierRow[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load referrals';
    return { rows: [], error: message };
  }
}

function renderVisitorFunnelView(
  container: HTMLElement,
  events: Array<Record<string, unknown>>,
  source: 'server' | 'local',
  fetchError?: string,
  recentReferrals: RecentReferralNotifierRow[] = [],
  referralFetchError?: string,
) {
  const visibleEvents = filterExcludedVisitorFunnelEvents(events);
  const excludedCount = events.length - visibleEvents.length;
  const stats = computeVisitorFunnelStats(visibleEvents);
  const totals = computeFunnelTotals(stats.funnel);
  const isServer = source === 'server';
  const refreshedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const latestTs = latestEventTimestamp(visibleEvents);
  const latestLabel = latestTs ? formatEventTimestampLabel(latestTs) : '';

  container.dataset.visitorCsvPayload = buildVisitorCsv(stats.funnel);

  let html = `
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <div class="text-[10px] font-semibold text-violet-300">Site Visitor Funnel</div>
      ${isServer ? '<span class="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-200 text-[8px]">SERVER</span>' : '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[8px]">LOCAL</span>'}
      <span class="text-[9px] text-zinc-500">Updated ${refreshedAt}${latestLabel ? ` · Latest event ${escapeHtml(latestLabel)}` : ''}</span>
    </div>
    <div class="text-[9px] text-zinc-400 mb-2">Landing → get link → copy → share → claim. Unique = distinct browsers.</div>
  `;

  if (excludedCount > 0) {
    html += `<div class="text-[9px] text-zinc-500 mb-2">Filtered ${excludedCount} owner/test event${excludedCount === 1 ? '' : 's'} (161.38.136.60) from this view.</div>`;
  }

  if (fetchError && !isServer) {
    html += `<div class="text-[9px] text-amber-400/90 mb-2">Server unavailable (${escapeHtml(fetchError)}) — local data shown.</div>`;
  }

  html += `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Landings</div><div class="text-lg font-bold text-white tabular-nums">${stats.uniqueVisitorsLanding}</div></div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Engaged</div><div class="text-lg font-bold text-violet-300 tabular-nums">${stats.uniqueVisitorsAny}</div></div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Events</div><div class="text-lg font-bold text-white tabular-nums">${stats.total}</div></div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Claim conv.</div><div class="text-lg font-bold text-emerald-300 tabular-nums">${totals.conversion}</div></div>
    </div>
    <div class="flex gap-2 mb-2">
      <button type="button" data-visitor-stats-refresh class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded disabled:opacity-50">↻ Refresh</button>
      <button type="button" data-visitor-stats-csv class="text-[9px] px-2 py-0.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded">⬇ CSV</button>
    </div>
    <table class="w-full text-[9px] text-zinc-200 border border-white/10 mb-2">
      <thead><tr class="bg-white/5 text-violet-200"><th class="text-left p-1.5">Step</th><th class="p-1.5 text-right">Events</th><th class="p-1.5 text-right">Unique</th></tr></thead><tbody>
  `;

  for (const row of stats.funnel) {
    html += `<tr class="border-t border-white/5"><td class="p-1.5 text-zinc-100">${escapeHtml(row.name)}</td><td class="p-1.5 text-right tabular-nums text-zinc-300">${row.count}</td><td class="p-1.5 text-right tabular-nums text-violet-200/90">${row.unique > 0 ? row.unique : '—'}</td></tr>`;
  }
  html += `</tbody></table>`;

  const countryRows = topCountries(filterCountryRowsForDisplay(stats.byCountry));
  html += `<div class="text-[9px] text-zinc-400 mb-1">By country (landings):</div>`;
  if (countryRows.length) {
    html += `<table class="w-full text-[8px] text-zinc-200 border border-white/10 mb-2"><thead><tr class="bg-white/5 text-violet-200"><th class="text-left p-1">Country</th><th class="p-1 text-right">Unique</th><th class="p-1 text-right">Landings</th></tr></thead><tbody>`;
    for (const row of countryRows) {
      const label = `${countryLabel(row.country)} (${row.country})`;
      html += `<tr class="border-t border-white/5"><td class="p-1 text-zinc-100">${escapeHtml(label)}</td><td class="p-1 text-right tabular-nums">${row.unique}</td><td class="p-1 text-right tabular-nums text-zinc-400">${row.events}</td></tr>`;
    }
    html += `</tbody></table>`;
  } else {
    html += `<div class="text-[9px] text-zinc-500 mb-2">No country data yet — browse the public site, then Refresh.</div>`;
  }

  if (shouldShowUtmSources(stats.bySource)) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">By UTM source (landings):</div><div class="text-[8px] text-zinc-300 mb-2">`;
    for (const [src, count] of sortSourceEntries(stats.bySource).slice(0, 6)) {
      html += `<span class="inline-block mr-2 mb-1 px-1.5 py-0.5 bg-violet-900/40 border border-violet-500/30 rounded">${escapeHtml(src)}: ${count}</span>`;
    }
    html += `</div>`;
  }

  const newReferralCount = countRecentReferralNotifiers(recentReferrals, 60);
  html += `<div class="flex flex-wrap items-center gap-2 mb-1 mt-2">`;
  html += `<div class="text-[9px] text-emerald-300 font-semibold">Referral notifier</div>`;
  if (newReferralCount > 0) {
    html += `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[8px]">${newReferralCount} in last hour</span>`;
  }
  html += `</div>`;
  html += `<div class="font-mono text-[8px] text-zinc-300 bg-emerald-950/30 border border-emerald-500/25 p-1.5 rounded max-h-20 overflow-y-auto mb-2">`;
  if (referralFetchError) {
    html += `<div class="text-amber-400/90">Could not load referrals (${escapeHtml(referralFetchError)}) — click Refresh.</div>`;
  } else if (!recentReferrals.length) {
    html += `<div class="text-zinc-500">No credited referrals yet.</div>`;
  } else {
    for (const row of recentReferrals) {
      const ts = row.created_at || '';
      const when = ts ? formatEventTimestampLabel(ts) : '';
      const code = String(row.referrer_code || '—');
      const ip = getReferralNotifierIp(row) || '—';
      const isNew = isRecentReferralNotifier(ts, 60);
      const dot = isNew
        ? '<span class="text-emerald-400" title="Last hour">●</span> '
        : '<span class="text-zinc-600">○</span> ';
      const timePrefix = when
        ? `<span class="text-zinc-500">${escapeHtml(when)}</span> · `
        : '';
      html += `<div class="mb-0.5 ${isNew ? 'text-emerald-100' : ''}">${dot}${timePrefix}<span class="text-violet-200">${escapeHtml(code)}</span> ← <span class="text-zinc-200">${escapeHtml(ip)}</span></div>`;
    }
  }
  html += `</div>`;

  if (stats.lastEvents.length) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">Recent events:</div><div class="font-mono text-[8px] text-zinc-300 bg-black/40 border border-white/10 p-1.5 rounded max-h-32 overflow-y-auto">`;
    for (const e of stats.lastEvents) {
      const ts = eventTimestamp(e);
      const when = ts ? formatEventTimestampLabel(ts) : '';
      const src = e.utm_source ? ` [${e.utm_source}]` : '';
      const detail = formatRecentVisitorEventDetail(e);
      const geo =
        e.country_code && !detail.includes(String(e.country_code))
          ? ` ${countryLabel(String(e.country_code))}`
          : '';
      const timePrefix = when
        ? `<span class="text-zinc-500">${escapeHtml(when)}</span> · `
        : '';
      const detailSuffix = detail
        ? ` <span class="text-zinc-400">(${escapeHtml(detail)})</span>`
        : '';
      html += `<div class="mb-0.5">${timePrefix}${escapeHtml(String(e.event_name || ''))}${escapeHtml(geo)}${escapeHtml(String(src))}${detailSuffix}</div>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="text-[9px] text-zinc-500">No events yet. Browse viralrefer.app and click Get my referral link.</div>`;
  }

  container.innerHTML = html;
}

export async function renderVisitorFunnelStats(
  container: HTMLElement,
  preloadedEvents?: Array<Record<string, unknown>>,
) {
  container.classList.add('visitor-funnel-stats-panel');
  bindVisitorStatsRefresh(container);

  if (preloadedEvents) {
    const referralNotifier = await fetchRecentReferralsForNotifier();
    renderVisitorFunnelView(
      container,
      preloadedEvents,
      'local',
      undefined,
      referralNotifier.rows,
      referralNotifier.error,
    );
    return;
  }

  const [res, referralNotifier] = await Promise.all([
    getVisitorEventsForStats(),
    fetchRecentReferralsForNotifier(),
  ]);
  renderVisitorFunnelView(
    container,
    res.events,
    res.source,
    res.fetchError,
    referralNotifier.rows,
    referralNotifier.error,
  );
}

export async function wireVisitorFunnelStatsQuick(root: HTMLElement) {
  const el = root.querySelector('#visitor-stats-quick') as HTMLElement | null;
  if (!el) return;
  bindVisitorStatsRefresh(el);
  const local = getLocalVisitorEvents();
  if (local.length) {
    renderVisitorFunnelView(el, local, 'local');
  } else {
    el.innerHTML = SKELETON;
  }
  try {
    const [res, referralNotifier] = await Promise.all([
      getVisitorEventsForStats(),
      fetchRecentReferralsForNotifier(),
    ]);
    renderVisitorFunnelView(
      el,
      res.events,
      res.source,
      res.fetchError,
      referralNotifier.rows,
      referralNotifier.error,
    );
  } catch {
    if (!local.length) {
      el.innerHTML = `<div class="text-[9px] text-amber-400">Could not load visitor stats. Click Refresh.</div>`;
    }
  }
}