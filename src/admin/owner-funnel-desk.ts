/**
 * First screen after the owner password: six numbers + one feed.
 * Server only. No Claims / Promoters / Died-waiting tiles.
 */

import {
  fetchAdminAction,
  invokeAdminAction,
  type AdminActionFetchResult,
} from '../lib/admin-action-client';
import { getAdminSessionToken } from '../lib/admin-session';
import { escapeHtml } from '../lib/escape-html';
import { formatEventTimestampLabel } from '../lib/stats-helpers';
import { showToast } from '../ui';
import {
  emptyOwnerFunnelGsc,
  formatGscCount,
  formatGscPosition,
  GSC_CACHED_NOTE,
  GSC_CONSOLE_URL,
  GSC_MISSING_NOTE,
  GSC_TIMEOUT_NOTE,
  parseOwnerFunnelGsc,
  type OwnerFunnelDeskMetrics,
  type OwnerFunnelFeedRow,
  type OwnerFunnelGscMetrics,
} from './owner-funnel-desk-helpers';

const SKELETON = `
  <div class="space-y-4 py-1" data-owner-funnel-desk="1">
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div class="h-24 skeleton rounded-2xl"></div>
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
  visits: 0,
  junkVisits: 0,
  friendLandings: 0,
  landings: 0,
  getLink: 0,
  share: 0,
  locked: 0,
  getLinkRate: '0%',
  feed: [],
  gsc: emptyOwnerFunnelGsc(),
};

export const JUNK_CLEAR_CONFIRM =
  'Clear junk and test visits only? Google Search Console and the verify file stay. Real quality visits stay.';

/** Same abort as HQ paint — Command desk must not hang on functions.invoke. */
export const OWNER_FUNNEL_DESK_TIMEOUT_MS = 8_000;
export const OWNER_FUNNEL_DESK_TIMEOUT_NOTE = 'Command desk timed out — tap Refresh.';

/** Deployed admin-action may not know get_owner_funnel_desk yet. */
export function isOwnerFunnelDeskActionMissing(error: string | undefined | null): boolean {
  const msg = String(error || '').toLowerCase();
  if (!msg) return false;
  if (msg.includes('unknown action')) return true;
  if (msg.includes('non-2xx') || msg.includes('functionshttperror')) return true;
  return (
    msg.includes('get_owner_funnel_desk') &&
    /not found|does not exist|could not find|unsupported|unrecognized/.test(msg)
  );
}

/**
 * After a valid owner session, always return tiles.
 * Missing action / RPC / query miss → zeros. Real counts when the server has them.
 * Never signal an error that would replace the desk with "can't load."
 */
export function ownerFunnelDeskFromInvokeResult(result: {
  success: boolean;
  data?: OwnerFunnelDeskMetrics | null;
  error?: string;
}): { metrics: OwnerFunnelDeskMetrics; error?: string } {
  if (result.success) {
    const metrics = result.data || EMPTY_METRICS;
    return { metrics: { ...metrics, gsc: parseOwnerFunnelGsc(metrics.gsc) } };
  }
  return { metrics: EMPTY_METRICS };
}

/** Fail-fast fetchAdminAction envelope → Command tiles. */
export function ownerFunnelDeskFromFetchResult(fetched: AdminActionFetchResult): {
  metrics: OwnerFunnelDeskMetrics;
  error?: string;
} {
  if (!fetched.ok) {
    const loaded = ownerFunnelDeskFromInvokeResult({ success: false, error: fetched.error });
    return fetched.timedOut ? { ...loaded, error: fetched.error } : loaded;
  }
  const envelope = fetched.envelope || {};
  const data = (envelope.data !== undefined ? envelope.data : envelope) as
    | OwnerFunnelDeskMetrics
    | Record<string, unknown>
    | null;
  return ownerFunnelDeskFromInvokeResult({
    success: envelope.success === true,
    data: data as OwnerFunnelDeskMetrics | null,
    error: typeof envelope.error === 'string' ? envelope.error : undefined,
  });
}

function tile(
  label: string,
  value: string | number,
  note: string,
  kind: 'visits' | 'landings' | 'getlink' | 'share' | 'locked' | 'rate',
): string {
  return `
    <article class="hq-desk-tile hq-desk-tile--${kind} rounded-2xl border border-white/10 bg-zinc-900/50 px-3 py-3" data-hq-tile="${kind}">
      <div class="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">${escapeHtml(label)}</div>
      <div class="text-2xl font-bold text-white tabular-nums mt-1">${escapeHtml(String(value))}</div>
      <div class="text-[11px] text-zinc-400 mt-1">${escapeHtml(note)}</div>
    </article>`;
}

function gscList(title: string, rows: OwnerFunnelGscMetrics['toolPages'], kind: string): string {
  const body = rows.length
    ? rows
        .slice(0, 8)
        .map(
          (row) => `
        <div class="hq-gsc-row">
          <span class="hq-gsc-row-label">${escapeHtml(row.label)}</span>
          <span class="hq-gsc-row-num tabular-nums">${escapeHtml(String(row.clicks))}</span>
        </div>`,
        )
        .join('')
    : `<div class="text-[11px] text-zinc-500 py-1">None yet</div>`;
  return `
    <div class="hq-gsc-list" data-owner-desk-gsc-list="${escapeHtml(kind)}">
      <div class="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold mb-1">${escapeHtml(title)}</div>
      ${body}
    </div>`;
}

function renderGscCard(gsc: OwnerFunnelGscMetrics): string {
  const status = gsc.status;
  const clicks = formatGscCount(gsc.clicks, status);
  const shown = formatGscCount(gsc.impressions, status);
  const showNums = status === 'ok' || status === 'ok-cached';
  const tap = showNums ? gsc.tapRate : '—';
  const pos = showNums ? formatGscPosition(gsc.avgPosition) : '—';
  const note =
    status === 'missing_credentials'
      ? gsc.note || GSC_MISSING_NOTE
      : status === 'error'
        ? gsc.note || 'Search Console numbers could not load.'
        : status === 'timeout'
          ? gsc.note || GSC_TIMEOUT_NOTE
          : status === 'ok-cached'
            ? gsc.note || GSC_CACHED_NOTE
            : '';
  return `
    <section class="hq-gsc-card rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3" data-owner-desk-gsc="1" data-gsc-status="${escapeHtml(status)}">
      <div class="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <div class="text-[10px] uppercase tracking-wide text-violet-300/90 font-bold">Google Search · tools &amp; pages</div>
          <p class="text-[11px] text-zinc-500 mt-0.5">Last ${gsc.windowDays} days · URL-prefix ${escapeHtml(gsc.property)}</p>
        </div>
        <a href="${escapeHtml(gsc.consoleUrl || GSC_CONSOLE_URL)}" target="_blank" rel="noopener noreferrer" class="hq-gsc-link text-[11px] text-violet-300 hover:text-violet-100" data-owner-desk-gsc-console="1">
          Search Console performance
        </a>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3" data-owner-desk-gsc-tiles>
        ${tile('Clicks', clicks, 'Taps from Google', 'getlink')}
        ${tile('Shown in Google', shown, 'Impressions', 'visits')}
        ${tile('Tap rate', tap, 'Clicks / shown', 'rate')}
        ${tile('Avg position', pos, 'Mean rank', 'landings')}
      </div>
      ${
        note
          ? `<p class="text-[12px] text-amber-200/90 mb-3" data-owner-desk-gsc-note="${escapeHtml(status)}">${escapeHtml(note)}</p>`
          : ''
      }
      <div class="grid md:grid-cols-2 gap-3">
        ${gscList('Tool pages', gsc.toolPages, 'tools')}
        ${gscList('Top searches', gsc.topSearches, 'searches')}
        ${gscList('Other pages', gsc.otherPages, 'pages')}
        ${gscList('Search countries', gsc.countries, 'countries')}
      </div>
    </section>`;
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
    <div class="hq-desk-feed-row hq-desk-feed-row--${row.kind} flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 border-b border-white/5 last:border-0">
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

  const feedHtml = metrics.feed.length
    ? metrics.feed.map(feedLine).join('')
    : `<div class="text-sm text-zinc-500 py-2">No loop events in the last ${metrics.windowDays} days.</div>`;

  const junkKept = metrics.junkVisits && metrics.junkVisits > 0
    ? `<p class="text-[11px] text-zinc-500" data-owner-desk-junk-note="1">${escapeHtml(String(metrics.junkVisits))} junk/test page views kept off these tiles. Search Console is separate.</p>`
    : `<p class="text-[11px] text-zinc-500" data-owner-desk-junk-note="0">Junk/test page views stay off these tiles. Search Console is separate.</p>`;

  const fetchError = error
    ? `<p class="text-[12px] text-amber-200/90" data-owner-desk-fetch-error="1">${escapeHtml(error)}</p>`
    : '';

  container.innerHTML = `
    <div data-owner-funnel-desk="1" class="hq-desk space-y-4">
      <p class="text-sm text-zinc-400">Last ${metrics.windowDays} days · owner IP, test codes, webdriver, and junk sources excluded.</p>
      ${fetchError}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3" data-owner-desk-tiles>
        ${tile('Visits', metrics.visits, 'Real page views — junk/test excluded', 'visits')}
        ${tile('Friend landings', metrics.friendLandings, 'Unique people on /r/ or /a/', 'landings')}
        ${tile('Get-link', metrics.getLink, 'Unique people who tapped Get my link', 'getlink')}
        ${tile('Share', metrics.share, 'Verified send — not copy', 'share')}
        ${tile('Locked', metrics.locked, 'Codes with a real friend credit', 'locked')}
        ${tile(
          'Get-link rate',
          metrics.getLinkRate,
          metrics.friendLandings > 0 ? 'Get-link / Friend landings' : 'Get-link / Visits',
          'rate',
        )}
      </div>
      ${junkKept}
      ${renderGscCard(parseOwnerFunnelGsc(metrics.gsc))}
      <section class="hq-desk-feed rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3">
        <div class="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold mb-2">
          Landed · Got a link · Shared · Locked
        </div>
        <div data-owner-desk-feed class="max-h-80 overflow-y-auto">${feedHtml}</div>
      </section>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" data-owner-desk-refresh class="hq-desk-refresh text-xs px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-zinc-100">↻ Refresh</button>
        <button type="button" data-owner-desk-clear-junk class="hq-desk-clear-junk text-xs px-3 py-1.5 rounded-2xl bg-amber-600/80 hover:bg-amber-600 text-white" title="Deletes junk/test visitor rows and zeros junk_hits only. Does not touch Google Search Console or the verify file.">Clear junk visits</button>
        <span class="text-[10px] text-zinc-500">Server only · GSC untouched</span>
      </div>

    </div>
  `;
}

function bindRefresh(container: HTMLElement): void {
  if (container.dataset.ownerDeskBound === '1') return;
  container.dataset.ownerDeskBound = '1';
  container.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const btn = target.closest('[data-owner-desk-refresh]');
    if (btn && container.contains(btn)) {
      event.preventDefault();
      void refreshOwnerFunnelDesk(container, btn as HTMLButtonElement);
      return;
    }
    const clearBtn = target.closest('[data-owner-desk-clear-junk]');
    if (!clearBtn || !container.contains(clearBtn)) return;
    event.preventDefault();
    void clearJunkDeskVisits(container, clearBtn as HTMLButtonElement);
  });
}

async function clearJunkDeskVisits(
  container: HTMLElement,
  btn?: HTMLButtonElement,
): Promise<void> {
  if (typeof window !== 'undefined' && !window.confirm(JUNK_CLEAR_CONFIRM)) return;
  const original = btn?.textContent || 'Clear junk visits';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Clearing junk…';
  }
  try {
    const result = await invokeAdminAction<{
      deleted?: number;
      junk_hits_cleared?: boolean;
      gsc?: string;
    }>('clear_junk_visits');
    if (!result.success) {
      showToast(result.error || 'Junk clear failed', 'info');
      return;
    }
    const deleted = result.data?.deleted ?? 0;
    showToast(`Cleared ${deleted} junk/test visits. Search Console unchanged.`, 'success');
    await renderOwnerFunnelDesk(container);
  } catch {
    showToast('Junk clear failed. Search Console was not touched.', 'info');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
  }
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
    renderOwnerFunnelDeskView(container, EMPTY_METRICS);
    showToast('Desk still here. Counts stay at zero until the server answers.', 'info');
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
  try {
    // Same fetch path as owner login — get_owner_funnel_desk + session token + abort.
    const fetched = await fetchAdminAction('get_owner_funnel_desk', {}, {
      sessionToken: getAdminSessionToken(),
      timeoutMs: 8_000,
    });
    const loaded = ownerFunnelDeskFromFetchResult(fetched);
    const error = fetched.ok === false && fetched.timedOut
      ? OWNER_FUNNEL_DESK_TIMEOUT_NOTE
      : loaded.error;
    renderOwnerFunnelDeskView(container, loaded.metrics, error);
  } catch {
    renderOwnerFunnelDeskView(container, EMPTY_METRICS);
  }
}
