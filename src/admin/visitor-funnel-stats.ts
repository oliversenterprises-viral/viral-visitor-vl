/**
 * Site Visitor Funnel — Edit Content admin panel (clean rewrite).
 * Production-safe: never throws out of the panel; server fetch is isolated.
 */

import {
  computeVisitorFunnelStats,
  formatVisitorEventDisplayName,
} from '../lib/visitor-tracking';
import { fetchVisitorFunnelEvents } from '../lib/visitor-funnel-fetch';
import { escapeHtml } from '../lib/escape-html';
import { showToast } from '../ui';
import {
  eventTimestamp,
  formatEventTimestampLabel,
  latestEventTimestamp,
} from '../lib/stats-helpers';
import {
  buildAutorefreshSelectHtml,
  wireAdminStatsAutorefresh,
} from '../lib/admin-stats-autorefresh';
import { buildAutoClearTestSelectHtml } from '../lib/admin-stats-auto-clear-test';
import {
  resolveEditContentRoot,
  runClearTestAdminStatsForEditContent,
} from './edit-content-clear-test';
import { withAdminStatsReadOnlyRefresh } from '../lib/admin-stats-refresh-guard';
import {
  countryLabel,
  computeFunnelTotals,
  countRecentReferralNotifiers,
  countTestVisitorFunnelEvents,
  filterCountryRowsForDisplay,
  filterExcludedVisitorFunnelEvents,
  formatRecentVisitorEventDetail,
  formatReferralNotifierLine,
  isRecentReferralNotifier,
  shouldShowUtmSources,
  sortSourceEntries,
  topCountries,
  type RecentReferralNotifierRow,
} from './visitor-funnel-stats-helpers';
import {
  computeFunnelStepConversions,
  countUniqueSessions,
  filterEventsByTrackingRange,
  getTrackingTimeRange,
  reportTrackingHubSummary,
} from './edit-content-tracking-helpers';
import { isTestReferralRecord } from '../lib/test-referral';
import { getAdminSessionToken } from '../lib/admin-session';
import { registerAdminLiveRefresh, refreshAdminLiveIndicators } from './admin-live-hub';
import { invokeAdminAction } from '../lib/admin-action-client';
import {
  buildReferrerLinkStatsHtml,
  summarizeReferrerLinkRows,
  type ReferrerLinkRow,
  type ReferrerLinkStatsSummary,
} from './referrer-link-stats-helpers';

let unregisterVisitorLive: (() => void) | null = null;

const SKELETON =
  '<div class="space-y-2 py-1"><div class="h-4 w-56 skeleton rounded"></div><div class="h-16 skeleton rounded"></div></div>';
const VISITOR_AUTOREFRESH_KEY = 'vr_admin_autorefresh_visitor_ms';

const FUNNEL_LABELS: Record<string, string> = {
  SiteLanding: 'Landing',
  GetReferralLink: 'Get link',
  CopyReferralLink: 'Copy link',
  ShareReferral: 'Share',
  OpenPrizeClaim: 'Open claim',
  SubmitPrizeClaim: 'Submit claim',
};

function buildVisitorCsv(funnel: Array<{ name: string; count: number; unique: number }>): string {
  const headers = ['step', 'events', 'unique'];
  const rows = funnel.map((r) => [r.name, r.count, r.unique].join(','));
  return [headers.join(','), ...rows].join('\n');
}

async function fetchRecentReferrals(limit = 8): Promise<{
  rows: RecentReferralNotifierRow[];
  error?: string;
}> {
  try {
    if (!getAdminSessionToken()) return { rows: [], error: 'Admin session required' };
    const result = await invokeAdminAction<RecentReferralNotifierRow[]>('get_referrals', {
      limit,
    });
    if (!result.success) return { rows: [], error: result.error };
    const rows = (Array.isArray(result.data) ? result.data : []).filter(
      (row) => !isTestReferralRecord(row as Record<string, unknown>),
    );
    return { rows };
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : 'Could not load referrals',
    };
  }
}

async function fetchReferrerLinkStats(): Promise<{
  summary: ReferrerLinkStatsSummary | null;
  error?: string;
}> {
  try {
    if (!getAdminSessionToken()) return { summary: null, error: 'Admin session required' };
    const result = await invokeAdminAction<ReferrerLinkRow[]>('get_referrer_link_stats');
    if (!result.success) return { summary: null, error: result.error };
    const rows = Array.isArray(result.data) ? result.data : [];
    return { summary: summarizeReferrerLinkRows(rows) };
  } catch (err) {
    return {
      summary: null,
      error: err instanceof Error ? err.message : 'Could not load link lock stats',
    };
  }
}

function bindVisitorStatsRefresh(container: HTMLElement): void {
  if (container.dataset.visitorRefreshBound === '1') return;
  container.dataset.visitorRefreshBound = '1';
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const refreshBtn = target.closest('button[data-visitor-stats-refresh]');
    const clearBtn = target.closest('button[data-visitor-stats-clear-test]');
    const copyBtn = target.closest('button[data-visitor-stats-copy]');
    const csvBtn = target.closest('button[data-visitor-stats-csv]');

    if (copyBtn && container.contains(copyBtn)) {
      e.preventDefault();
      const payload = container.dataset.visitorStatsCopy;
      if (payload) {
        void navigator.clipboard
          .writeText(payload)
          .then(() => showToast('Copied visitor funnel JSON', 'success'));
      }
      return;
    }

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

    if (clearBtn && container.contains(clearBtn)) {
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        const button = clearBtn as HTMLButtonElement;
        const original = button.textContent || 'Clear test events';
        if (
          !window.confirm(
            'Remove owner/smoke test rows from visitor funnel AND banner stats in the database? Real visitor data is kept.',
          )
        ) {
          return;
        }
        button.disabled = true;
        button.textContent = 'Clearing…';
        try {
          const root = resolveEditContentRoot(container);
          if (!root) throw new Error('Edit content root not found');
          await runClearTestAdminStatsForEditContent(root, { toastWhenEmpty: true });
        } catch {
          showToast('Could not clear test funnel events', 'info');
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      })();
      return;
    }

    if (refreshBtn && container.contains(refreshBtn)) {
      e.preventDefault();
      e.stopPropagation();
      void refreshVisitorFunnelStats(container, refreshBtn as HTMLButtonElement);
    }
  });
}

function wireVisitorAutorefresh(container: HTMLElement): void {
  wireAdminStatsAutorefresh(
    container,
    VISITOR_AUTOREFRESH_KEY,
    'data-visitor-stats-autorefresh',
    () => silentRefreshVisitorFunnelStats(container),
  );
}

async function silentRefreshVisitorFunnelStats(container: HTMLElement): Promise<void> {
  await withAdminStatsReadOnlyRefresh(async () => {
    await renderVisitorFunnelStats(container);
  });
}

async function refreshVisitorFunnelStats(
  container: HTMLElement,
  btn?: HTMLButtonElement,
  options: { silent?: boolean } = {},
): Promise<void> {
  const refreshBtn =
    btn || (container.querySelector('[data-visitor-stats-refresh]') as HTMLButtonElement | null);
  const originalLabel = refreshBtn?.textContent || '↻ Refresh';
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '↻ Refreshing…';
  }
  try {
    await withAdminStatsReadOnlyRefresh(async () => {
      await renderVisitorFunnelStats(container);
    });
    if (!options.silent) showToast('Visitor funnel stats refreshed', 'success');
  } catch {
    if (!options.silent) showToast('Could not refresh visitor stats', 'info');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = originalLabel;
    }
  }
}

function renderVisitorFunnelView(
  container: HTMLElement,
  events: Array<Record<string, unknown>>,
  source: 'server' | 'local',
  fetchError?: string,
  recentReferrals: RecentReferralNotifierRow[] = [],
  referralFetchError?: string,
  linkLockSummary: ReferrerLinkStatsSummary | null = null,
  linkLockError?: string,
): void {
  const safeEvents = Array.isArray(events) ? events : [];

  let ranged = safeEvents;
  let excludedCount = 0;
  let stats = computeVisitorFunnelStats([]);
  let totals = computeFunnelTotals(stats.funnel);
  let stepConversions = computeFunnelStepConversions(stats.funnel);
  let uniqueSessions = 0;
  let effectiveSource = source;
  let effectiveError = fetchError;

  try {
    const visible = filterExcludedVisitorFunnelEvents(safeEvents);
    ranged = filterEventsByTrackingRange(visible, getTrackingTimeRange());
    excludedCount = countTestVisitorFunnelEvents(safeEvents);
    stats = computeVisitorFunnelStats(ranged);
    totals = computeFunnelTotals(stats.funnel);
    stepConversions = computeFunnelStepConversions(stats.funnel);
    uniqueSessions = countUniqueSessions(ranged);
  } catch (err) {
    console.error('[visitor-funnel] compute failed', err);
    effectiveError =
      effectiveError || (err instanceof Error ? err.message : 'Stats compute failed');
    effectiveSource = source === 'server' ? 'server' : 'local';
    // Keep empty stats shell so UI still renders
  }

  const isServer = effectiveSource === 'server';
  const refreshedAt = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const latestTs = stats.lastEvents.length
    ? eventTimestamp(stats.lastEvents[0]!)
    : latestEventTimestamp(ranged);
  const latestLabel = latestTs ? formatEventTimestampLabel(latestTs) : '';
  const range = getTrackingTimeRange();
  const rangeNote = range === 'all' ? '' : ` · Range ${range.toUpperCase()}`;
  const funnelEventCount = stats.funnelEventCount ?? ranged.length;
  const viralLoopEventCount = stats.viralLoopEventCount ?? 0;
  const eventMixNote =
    viralLoopEventCount > 0
      ? `${funnelEventCount} funnel + ${viralLoopEventCount} loop`
      : `${funnelEventCount} event${funnelEventCount === 1 ? '' : 's'}`;

  try {
    reportTrackingHubSummary({
      claimConversion: totals.conversion,
      sessions: uniqueSessions,
      engaged: stats.uniqueVisitorsAny,
      landings: stats.uniqueVisitorsLanding,
      visitorSource: effectiveSource,
      visitorEvents: funnelEventCount,
    });
  } catch {
    /* KPI strip must never break this panel */
  }

  container.dataset.visitorCsvPayload = buildVisitorCsv(stats.funnel);
  try {
    container.dataset.visitorStatsCopy = JSON.stringify(
      {
        generated: new Date().toISOString(),
        source: effectiveSource,
        range,
        rowCount: safeEvents.length,
        totals,
        funnel: stats.funnel,
        uniqueSessions,
        byCountry: stats.byCountry,
        bySource: stats.bySource,
      },
      null,
      2,
    );
  } catch {
    delete container.dataset.visitorStatsCopy;
  }

  let html = `
    <div class="flex flex-wrap items-center gap-2 mb-2">
      ${
        isServer
          ? '<span class="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-200 text-[8px] font-semibold">SERVER</span>'
          : '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[8px] font-semibold">LOCAL</span>'
      }
      <span id="visitor-live-indicator" class="hidden text-[9px] text-emerald-400/90"><i class="fa-solid fa-circle text-[5px] mr-0.5"></i>live</span>
      <span class="text-[9px] text-zinc-500">Updated ${escapeHtml(refreshedAt)}${
        latestLabel ? ` · Latest ${escapeHtml(latestLabel)}` : ''
      }${escapeHtml(rangeNote)} · ${escapeHtml(eventMixNote)}${
        isServer ? ` · ${safeEvents.length} rows` : ''
      }</span>
    </div>
    <div class="text-[9px] text-zinc-400 mb-2">
      Simple path: land → get free link → share with friends → friend taps Get my link → you climb.
      Engaged = did more than land · Sessions = different tabs.
    </div>
  `;

  if (linkLockSummary) {
    html += buildReferrerLinkStatsHtml(linkLockSummary);
  } else if (linkLockError) {
    html += `<div class="text-[9px] text-amber-400/90 mb-2 border border-amber-500/25 rounded-lg px-2 py-1.5">
      Link lock stats: ${escapeHtml(linkLockError)}
    </div>`;
  }

  if (excludedCount > 0) {
    html += `<div class="text-[9px] text-zinc-500 mb-2">Filtered ${excludedCount} owner/smoke/test event${
      excludedCount === 1 ? '' : 's'
    } from this view.</div>`;
  }

  if (effectiveError && !isServer) {
    const needsLogin = /session required|privileges required|re-login/i.test(effectiveError);
    html += `<div class="text-[9px] text-amber-400/90 mb-2 border border-amber-500/30 bg-amber-950/30 rounded-lg px-2 py-1.5">
      <div class="font-semibold text-amber-300">Server data unavailable</div>
      <div class="mt-0.5 break-all">${escapeHtml(effectiveError)}</div>
      <div class="mt-1 text-zinc-400">${
        needsLogin
          ? 'Close admin → ADMIN → enter owner password → Edit Content → ↻ Refresh.'
          : 'Click ↻ Refresh. If stuck, hard-refresh (Ctrl+Shift+R) and re-login.'
      }</div>
    </div>`;
  }

  if (isServer && safeEvents.length === 0) {
    html += `<div class="text-[9px] text-zinc-500 mb-2">Server connected — no visitor_events rows in the latest window yet.</div>`;
  }

  html += `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Landings</div><div class="text-lg font-bold text-white tabular-nums">${stats.uniqueVisitorsLanding}</div></div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Engaged</div><div class="text-lg font-bold text-violet-300 tabular-nums">${stats.uniqueVisitorsAny}</div></div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Sessions</div><div class="text-lg font-bold text-white tabular-nums">${uniqueSessions || '—'}</div></div>
      <div class="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"><div class="text-[8px] text-zinc-500 uppercase">Claim conv.</div><div class="text-lg font-bold text-emerald-300 tabular-nums">${escapeHtml(String(totals.conversion))}</div></div>
    </div>
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <button type="button" data-visitor-stats-refresh class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded disabled:opacity-50">↻ Refresh</button>
      ${buildAutorefreshSelectHtml('data-visitor-stats-autorefresh', VISITOR_AUTOREFRESH_KEY)}
      <button type="button" data-visitor-stats-copy class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">⎘ Copy JSON</button>
      <button type="button" data-visitor-stats-csv class="text-[9px] px-2 py-0.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded">⬇ CSV</button>
      <button type="button" data-visitor-stats-clear-test title="Deletes owner IP, smoke automation, and E2E test rows from visitor_events and banner_events"
        class="text-[9px] px-2 py-0.5 bg-amber-600/80 hover:bg-amber-600 text-white rounded disabled:opacity-50">Clear test events${excludedCount > 0 ? ` (${excludedCount})` : ''}</button>
      ${buildAutoClearTestSelectHtml()}
    </div>
    <table class="w-full text-[9px] text-zinc-200 border border-white/10 mb-2">
      <thead><tr class="bg-white/5 text-violet-200">
        <th class="text-left p-1.5">Step</th>
        <th class="p-1.5 text-right">Events</th>
        <th class="p-1.5 text-right">Unique</th>
        <th class="p-1.5 text-right">Step conv.</th>
        <th class="p-1.5 text-right">From landing</th>
      </tr></thead><tbody>
  `;

  for (let i = 0; i < stats.funnel.length; i++) {
    const row = stats.funnel[i];
    const conv = stepConversions[i] || { stepRate: '—', overallRate: '—' };
    const label = FUNNEL_LABELS[row.name] || row.name;
    const barPct =
      row.name === 'SiteLanding'
        ? 100
        : Math.min(100, Math.round(parseFloat(String(conv.overallRate)) || 0));
    html += `<tr class="border-t border-white/5">
      <td class="p-1.5 text-zinc-100">
        <div class="flex items-center gap-1.5">
          <span>${escapeHtml(label)}</span>
          <span class="inline-block h-1 flex-1 max-w-[48px] rounded bg-violet-900/60 overflow-hidden" title="Share of landings">
            <span class="block h-full bg-violet-500/70" style="width:${barPct}%"></span>
          </span>
        </div>
      </td>
      <td class="p-1.5 text-right tabular-nums text-zinc-300">${row.count}</td>
      <td class="p-1.5 text-right tabular-nums text-violet-200/90">${row.unique > 0 ? row.unique : '—'}</td>
      <td class="p-1.5 text-right tabular-nums text-zinc-400">${escapeHtml(String(conv.stepRate))}</td>
      <td class="p-1.5 text-right tabular-nums text-emerald-300/90">${escapeHtml(String(conv.overallRate))}</td>
    </tr>`;
  }
  html += `</tbody></table>`;

  const viralLoops = stats.viralLoops || [];
  const viralRows = viralLoops.filter((r) => r.count > 0 || r.unique > 0);
  if (viralRows.length) {
    html += `<div class="text-[9px] font-semibold text-cyan-300 mt-2 mb-1">Viral loops</div>`;
    html += `<table class="w-full text-[8px] text-zinc-200 border border-white/10 mb-2"><thead><tr class="bg-white/5 text-cyan-200"><th class="text-left p-1">Loop event</th><th class="p-1 text-right">Events</th><th class="p-1 text-right">Unique</th></tr></thead><tbody>`;
    for (const row of viralRows) {
      html += `<tr class="border-t border-white/5"><td class="p-1 text-zinc-100">${escapeHtml(row.name)}</td><td class="p-1 text-right tabular-nums">${row.count}</td><td class="p-1 text-right tabular-nums text-cyan-200/90">${row.unique > 0 ? row.unique : '—'}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  const countryRows = topCountries(filterCountryRowsForDisplay(stats.byCountry || []));
  html += `<div class="text-[9px] text-zinc-400 mb-1">By country (landings):</div>`;
  if (countryRows.length) {
    html += `<table class="w-full text-[8px] text-zinc-200 border border-white/10 mb-2"><thead><tr class="bg-white/5 text-violet-200"><th class="text-left p-1">Country</th><th class="p-1 text-right">Unique</th><th class="p-1 text-right">Landings</th></tr></thead><tbody>`;
    for (const row of countryRows) {
      const label = `${countryLabel(row.country)} (${row.country})`;
      html += `<tr class="border-t border-white/5"><td class="p-1 text-zinc-100">${escapeHtml(label)}</td><td class="p-1 text-right tabular-nums">${row.unique}</td><td class="p-1 text-right tabular-nums text-zinc-400">${row.events}</td></tr>`;
    }
    html += `</tbody></table>`;
  } else {
    html += `<div class="text-[9px] text-zinc-500 mb-2">No country data yet.</div>`;
  }

  if (shouldShowUtmSources(stats.bySource || {})) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">By UTM source (landings):</div><div class="text-[8px] text-zinc-300 mb-2">`;
    for (const [src, count] of sortSourceEntries(stats.bySource || {}).slice(0, 6)) {
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
    html += `<div class="text-amber-400/90">Referral notifier: ${escapeHtml(referralFetchError)}</div>`;
  } else if (!recentReferrals.length) {
    html += `<div class="text-zinc-500">No credited referrals yet.</div>`;
  } else {
    for (const row of recentReferrals) {
      const ts = row.created_at || '';
      const when = ts ? formatEventTimestampLabel(ts) : '';
      const { code, ipLabel } = formatReferralNotifierLine(row);
      const isNew = isRecentReferralNotifier(ts, 60);
      const dot = isNew
        ? '<span class="text-emerald-400" title="Last hour">●</span> '
        : '<span class="text-zinc-600">○</span> ';
      const timePrefix = when
        ? `<span class="text-zinc-500">${escapeHtml(when)}</span> · `
        : '';
      html += `<div class="mb-0.5 ${isNew ? 'text-emerald-100' : ''}">${dot}${timePrefix}<span class="text-violet-200">${escapeHtml(code)}</span> <span class="text-zinc-500">credited</span> ← <span class="text-zinc-200">${escapeHtml(ipLabel)}</span></div>`;
    }
  }
  html += `</div>`;

  if (stats.lastEvents.length) {
    html += `<div class="text-[9px] text-zinc-400 mb-1">Recent events:</div><div class="font-mono text-[8px] text-zinc-300 bg-black/40 border border-white/10 p-1.5 rounded max-h-32 overflow-y-auto">`;
    for (const e of stats.lastEvents) {
      const ts = eventTimestamp(e);
      const when = ts ? formatEventTimestampLabel(ts) : '';
      const rawName = String(e.event_name || e.eventName || '');
      const displayName = formatVisitorEventDisplayName(rawName);
      const utm = String(e.utm_source || e.utmSource || '').trim();
      const detail = formatRecentVisitorEventDetail(e);
      const timePrefix = when
        ? `<span class="text-zinc-500">${escapeHtml(when)}</span> · `
        : '';
      const utmSuffix =
        utm && utm !== '(direct)'
          ? ` <span class="text-zinc-500">[${escapeHtml(utm)}]</span>`
          : '';
      const detailSuffix = detail
        ? ` <span class="text-zinc-400">(${escapeHtml(detail)})</span>`
        : '';
      html += `<div class="mb-0.5">${timePrefix}<span class="text-zinc-100">${escapeHtml(displayName)}</span>${utmSuffix}${detailSuffix}</div>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="text-[9px] text-zinc-500">No recent funnel events in range.</div>`;
  }

  container.innerHTML = html;
  wireVisitorAutorefresh(container);
  refreshAdminLiveIndicators();
}

export async function renderVisitorFunnelStats(
  container: HTMLElement,
  preloadedEvents?: Array<Record<string, unknown>>,
): Promise<void> {
  container.classList.add('visitor-funnel-stats-panel');
  bindVisitorStatsRefresh(container);

  if (preloadedEvents) {
    const [referralNotifier, linkLock] = await Promise.all([
      fetchRecentReferrals(),
      fetchReferrerLinkStats(),
    ]);
    renderVisitorFunnelView(
      container,
      preloadedEvents,
      'local',
      undefined,
      referralNotifier.rows,
      referralNotifier.error,
      linkLock.summary,
      linkLock.error,
    );
    return;
  }

  const [funnel, referralNotifier, linkLock] = await Promise.all([
    fetchVisitorFunnelEvents(),
    fetchRecentReferrals(),
    fetchReferrerLinkStats(),
  ]);

  renderVisitorFunnelView(
    container,
    funnel.events,
    funnel.source,
    funnel.fetchError,
    referralNotifier.rows,
    referralNotifier.error,
    linkLock.summary,
    linkLock.error,
  );
}

export async function wireVisitorFunnelStatsQuick(root: HTMLElement): Promise<void> {
  const el = root.querySelector('#visitor-stats-quick') as HTMLElement | null;
  if (!el) return;

  if (unregisterVisitorLive) unregisterVisitorLive();
  unregisterVisitorLive = registerAdminLiveRefresh('visitor', () => {
    const panel = root.querySelector('#visitor-stats-quick') as HTMLElement | null;
    if (panel && document.body.contains(panel)) {
      void silentRefreshVisitorFunnelStats(panel);
    }
  });

  bindVisitorStatsRefresh(el);
  el.innerHTML = SKELETON;

  try {
    const [funnel, referralNotifier] = await Promise.all([
      fetchVisitorFunnelEvents(),
      fetchRecentReferrals(),
    ]);
    const panel =
      (root.querySelector('#visitor-stats-quick') as HTMLElement | null) || el;
    // Prefer root containment over document.body so initial paint works in tests
    // and when the panel is still under the edit-content root. Live refresh still
    // guards with document.body.contains above.
    if (!root.contains(panel)) return;
    renderVisitorFunnelView(
      panel,
      funnel.events,
      funnel.source,
      funnel.fetchError,
      referralNotifier.rows,
      referralNotifier.error,
    );
  } catch (err) {
    const panel =
      (root.querySelector('#visitor-stats-quick') as HTMLElement | null) || el;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[visitor-funnel] panel failed', err);
    try {
      renderVisitorFunnelView(panel, [], 'local', msg, [], undefined);
    } catch {
      panel.innerHTML = `<div class="text-[9px] text-amber-400 p-2 border border-amber-500/30 rounded-lg">
        Could not load visitor stats (${escapeHtml(msg)}).
        <button type="button" data-visitor-stats-refresh class="underline ml-1">Refresh</button>
      </div>`;
      bindVisitorStatsRefresh(panel);
    }
  }
}
