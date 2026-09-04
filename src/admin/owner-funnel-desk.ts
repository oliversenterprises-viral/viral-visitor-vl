/**
 * First screen after the owner password: six numbers + one feed.
 * Server only. No Claims / Promoters / Died-waiting tiles.
 * Command order names the hole. Loop strip is not extra tiles.
 */

import { invokeAdminAction } from '../lib/admin-action-client';
import { escapeHtml } from '../lib/escape-html';
import { formatEventTimestampLabel } from '../lib/stats-helpers';
import { showToast } from '../ui';
import {
  hqCommandOrder,
  hqDefaultFeedFilter,
  hqFeedFilterLabel,
  hqFeedKindForLoopStep,
  hqLoopStepForFeedFilter,
  hqLoopSteps,
  hqNormalizeFeedFilter,
  type HqFeedFilter,
} from './owner-funnel-command';
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
  type OwnerFunnelTelegramStatus,
} from './owner-funnel-desk-helpers';
import {
  emptyPlatformGuardSnapshot,
  evaluatePlatformGuard,
  parsePlatformGuardSnapshot,
  rememberPublicPlatformGuard,
  type PlatformGuardSnapshot,
} from '../lib/platform-guard';

const SKELETON = `
  <div class="space-y-4 py-1" data-owner-funnel-desk="1">
    <div class="h-20 skeleton rounded-2xl"></div>
    <div class="h-16 skeleton rounded-2xl"></div>
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

export const GROK_HITS_CLEAR_CONFIRM =
  'Delete Grok Build test hits from HQ only? Real visits, Google Search, and the verify file stay.';

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
      <details class="hq-gsc-lists" data-hq-gsc-lists="${escapeHtml(status)}" ${status === 'ok' || status === 'ok-cached' ? '' : 'open'}>
        <summary class="hq-gsc-lists-summary">Search lists</summary>
        <div class="grid md:grid-cols-2 gap-3 mt-2">
          ${gscList('Tool pages', gsc.toolPages, 'tools')}
          ${gscList('Top searches', gsc.topSearches, 'searches')}
          ${gscList('Other pages', gsc.otherPages, 'pages')}
          ${gscList('Search countries', gsc.countries, 'countries')}
        </div>
      </details>
    </section>`;
}

function renderCommandOrder(metrics: OwnerFunnelDeskMetrics): string {
  const order = hqCommandOrder(metrics);
  const evidence = order.evidence
    ? `<p class="hq-order-evidence" data-hq-order-evidence>${escapeHtml(order.evidence)}</p>`
    : '';
  return `
    <section
      class="hq-order hq-order--${escapeHtml(order.severity)}"
      data-hq-command-order="${escapeHtml(order.id)}"
      role="status"
      aria-live="polite"
    >
      <div class="hq-order-kicker">Order</div>
      <div class="hq-order-title">${escapeHtml(order.title)}</div>
      <p class="hq-order-detail">${escapeHtml(order.detail)}</p>
      ${evidence}
    </section>`;
}

function renderPlatformGuardCard(snap: PlatformGuardSnapshot): string {
  const view = evaluatePlatformGuard(snap);
  const meters = view.meters
    .map(
      (meter) => `
      <article class="hq-guard-meter hq-guard-meter--${escapeHtml(meter.status)}" data-hq-guard-meter="${escapeHtml(meter.id)}">
        <div class="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">${escapeHtml(meter.label)}</div>
        <div class="text-xl font-bold text-white tabular-nums mt-1">${escapeHtml(meter.value)}</div>
        <div class="text-[11px] text-zinc-400 mt-1">${escapeHtml(meter.note)}</div>
      </article>`,
    )
    .join('');
  return `
    <section class="hq-guard hq-guard--${escapeHtml(view.severity)}" data-hq-platform-guard="${escapeHtml(view.severity)}" role="status">
      <div class="hq-order-kicker">Guard</div>
      <div class="hq-order-title">${escapeHtml(view.title)}</div>
      <p class="hq-order-detail">${escapeHtml(view.detail)}</p>
      <div class="hq-guard-meters">${meters}</div>
    </section>`;
}

function renderLoopStrip(metrics: OwnerFunnelDeskMetrics): string {
  const steps = hqLoopSteps(metrics);
  const body = steps
    .map((step, i) => {
      const hole = step.hole ? ' data-hq-loop-hole="1"' : '';
      const join = i === 0 ? '' : `<div class="hq-loop-join" aria-hidden="true"></div>`;
      const holeLabel = step.hole ? ', this is the hole' : '';
      const drop = step.drop > 0 ? `<div class="hq-loop-drop tabular-nums">−${step.drop}</div>` : '';
      return `${join}
        <button type="button" class="hq-loop-step${step.hole ? ' hq-loop-step--hole' : ''}" data-hq-loop-step="${escapeHtml(step.id)}"${hole} aria-pressed="false" aria-label="${escapeHtml(step.label)} ${escapeHtml(String(step.value))}${escapeHtml(holeLabel)}">
          <div class="hq-loop-value tabular-nums">${escapeHtml(String(step.value))}</div>
          <div class="hq-loop-label">${escapeHtml(step.label)}</div>
          ${
            step.rate
              ? `<div class="hq-loop-rate tabular-nums">${escapeHtml(step.rate)}</div>`
              : `<div class="hq-loop-rate hq-loop-rate--empty">&nbsp;</div>`
          }
          ${drop}
        </button>`;
    })
    .join('');
  return `
    <nav class="hq-loop" data-hq-loop aria-label="Loop last ${metrics.windowDays} days. Tap a step to filter the log.">
      ${body}
    </nav>`;
}

function renderFeedFilters(): string {
  const chips: Array<{ id: HqFeedFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'landed', label: 'Landed' },
    { id: 'got_link', label: 'Got a link' },
    { id: 'shared', label: 'Shared' },
    { id: 'locked', label: 'Locked' },
  ];
  const buttons = chips
    .map(
      (chip) => `
      <button type="button" class="hq-feed-filter" data-hq-feed-filter="${chip.id}" aria-pressed="false">${escapeHtml(chip.label)}</button>`,
    )
    .join('');
  return `
    <div class="hq-feed-filters" data-hq-feed-filters>
      ${buttons}
    </div>`;
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
    <div class="hq-desk-feed-row hq-desk-feed-row--${row.kind} flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 border-b border-white/5 last:border-0" data-hq-feed-kind="${escapeHtml(row.kind)}">
      <span class="text-[10px] text-zinc-500 tabular-nums">${escapeHtml(when)}</span>
      <span class="hq-desk-feed-kind hq-desk-feed-kind--${escapeHtml(row.kind)}">${escapeHtml(row.label)}</span>
      ${codes}
      <span class="text-[11px] text-zinc-500">Via ${escapeHtml(row.viaLabel)}</span>
    </div>`;
}

export function applyHqDeskFilter(container: HTMLElement, raw: string): void {
  const filter = hqNormalizeFeedFilter(raw);
  container.dataset.hqDeskFilter = filter;
  const rows = container.querySelectorAll<HTMLElement>('[data-hq-feed-kind]');
  let visible = 0;
  for (const row of rows) {
    const show = filter === 'all' || row.getAttribute('data-hq-feed-kind') === filter;
    row.hidden = !show;
    if (show) visible += 1;
  }
  const empty = container.querySelector<HTMLElement>('[data-hq-feed-empty]');
  if (empty) {
    if (rows.length === 0) {
      empty.hidden = false;
    } else if (visible === 0) {
      empty.hidden = false;
      empty.textContent = `No ${hqFeedFilterLabel(filter)} events in this log.`;
    } else {
      empty.hidden = true;
    }
  }
  const loopOn = hqLoopStepForFeedFilter(filter);
  for (const step of container.querySelectorAll<HTMLElement>('[data-hq-loop-step]')) {
    const on = loopOn !== 'all' && step.getAttribute('data-hq-loop-step') === loopOn;
    step.classList.toggle('hq-loop-step--on', on);
    step.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  for (const chip of container.querySelectorAll<HTMLElement>('[data-hq-feed-filter]')) {
    const on = chip.getAttribute('data-hq-feed-filter') === filter;
    chip.classList.toggle('hq-feed-filter--on', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

export function renderOwnerTelegramStripHtml(
  telegram: OwnerFunnelTelegramStatus | undefined,
): string {
  const connected = telegram?.connected === true;
  const line = !connected
    ? 'Telegram is not connected yet.'
    : telegram?.importantOnly === false
      ? 'Telegram · every recorded step pings your chat, including landings.'
      : 'Telegram · Get-link, Copy, Send, Claim, a site added, and site/banner clicks ping your chat. Landings do not.';
  const body = connected
    ? `<span class="text-emerald-300">Telegram</span>${escapeHtml(line.slice('Telegram'.length))}`
    : escapeHtml(line);
  return `<p data-owner-desk-telegram class="block max-w-full text-[11px] leading-snug text-zinc-400">${body}</p>`;
}

export function renderOwnerFunnelDeskView(
  container: HTMLElement,
  metrics: OwnerFunnelDeskMetrics,
  _error?: string,
  guard?: PlatformGuardSnapshot,
): void {
  container.classList.add('owner-funnel-desk');
  const gsc = parseOwnerFunnelGsc(metrics.gsc);
  const viewMetrics: OwnerFunnelDeskMetrics = {
    ...metrics,
    gsc,
  };

  const feedHtml = viewMetrics.feed.length
    ? viewMetrics.feed.map(feedLine).join('')
    : '';
  const emptyFeed =
    viewMetrics.feed.length === 0
      ? `No loop events in the last ${viewMetrics.windowDays} days.`
      : '';

  const junkKept = viewMetrics.junkVisits && viewMetrics.junkVisits > 0
    ? `<p class="text-[11px] text-zinc-500" data-owner-desk-junk-note="1">${escapeHtml(String(viewMetrics.junkVisits))} junk/test page views kept off these tiles. Search Console is separate.</p>`
    : `<p class="text-[11px] text-zinc-500" data-owner-desk-junk-note="0">Junk/test page views stay off these tiles. Search Console is separate.</p>`;

  container.innerHTML = `
    <div data-owner-funnel-desk="1" class="hq-desk space-y-4">
      ${renderCommandOrder(viewMetrics)}
      ${renderLoopStrip(viewMetrics)}
      <p class="text-sm text-zinc-400" data-hq-desk-meta>
        Last ${viewMetrics.windowDays} days · owner IP, test codes, webdriver, and junk sources excluded.
        <span class="hq-desk-updated" data-hq-desk-updated>Updated just now</span>
        <span class="hq-desk-keyhint">R refreshes · 1–4 log · 0 all</span>
      </p>
      ${renderOwnerTelegramStripHtml(viewMetrics.telegram)}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3" data-owner-desk-tiles>
        ${tile('Visits', viewMetrics.visits, 'Real page views — junk/test excluded', 'visits')}
        ${tile('Friend landings', viewMetrics.friendLandings, 'Unique people on /r/ or /a/', 'landings')}
        ${tile('Get-link', viewMetrics.getLink, 'Unique people who tapped Get my link', 'getlink')}
        ${tile('Share', viewMetrics.share, 'Verified send — not copy', 'share')}
        ${tile('Locked', viewMetrics.locked, 'Codes with a real friend credit', 'locked')}
        ${tile(
          'Get-link rate',
          viewMetrics.getLinkRate,
          viewMetrics.friendLandings > 0 ? 'Get-link / Friend landings' : 'Get-link / Visits',
          'rate',
        )}
      </div>
      ${junkKept}
      ${renderPlatformGuardCard(guard || emptyPlatformGuardSnapshot())}
      ${renderGscCard(gsc)}
      <section class="hq-desk-feed rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3">
        <div class="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold mb-2">
          Landed · Got a link · Shared · Locked
        </div>
        ${renderFeedFilters()}
        <div data-owner-desk-feed class="max-h-80 overflow-y-auto">${feedHtml}</div>
        <div class="text-sm text-zinc-500 py-2" data-hq-feed-empty ${emptyFeed ? '' : 'hidden'}>${escapeHtml(emptyFeed)}</div>
      </section>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" data-owner-desk-refresh class="hq-desk-refresh text-xs px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-zinc-100" title="Refresh (R)" aria-label="Refresh HQ desk">↻ Refresh</button>
        <button type="button" data-owner-desk-clear-junk class="hq-desk-clear-junk text-xs px-3 py-1.5 rounded-2xl bg-amber-600/80 hover:bg-amber-600 text-white" title="Deletes junk/test visitor rows and zeros junk_hits only. Does not touch Google Search Console or the verify file.">Clear junk visits</button>
        <button type="button" data-owner-desk-clear-grok class="hq-desk-clear-grok text-xs px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-zinc-100" title="Deletes Grok Build / agent browser hits only. Real visits, Google Search, and the verify file stay.">Clear Grok hits</button>
        <span class="text-[10px] text-zinc-500">Server only · GSC untouched</span>
      </div>

    </div>
  `;

  const nextFilter = hqNormalizeFeedFilter(
    container.dataset.hqDeskFilter || hqDefaultFeedFilter(viewMetrics),
  );
  applyHqDeskFilter(container, nextFilter);
  bindDeskInteractions(container);
}

function bindDeskInteractions(container: HTMLElement): void {
  if (container.dataset.ownerDeskBound === '1') return;
  container.dataset.ownerDeskBound = '1';
  container.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('[data-owner-desk-refresh]');
    if (btn && container.contains(btn)) {
      event.preventDefault();
      void refreshOwnerFunnelDesk(container, btn as HTMLButtonElement);
      return;
    }
    const clearBtn = target.closest('[data-owner-desk-clear-junk]');
    if (clearBtn && container.contains(clearBtn)) {
      event.preventDefault();
      void clearJunkDeskVisits(container, clearBtn as HTMLButtonElement);
      return;
    }
    const grokBtn = target.closest('[data-owner-desk-clear-grok]');
    if (grokBtn && container.contains(grokBtn)) {
      event.preventDefault();
      void clearGrokDeskHits(container, grokBtn as HTMLButtonElement);
      return;
    }
    const chip = target.closest('button[data-hq-feed-filter]');
    if (chip && container.contains(chip)) {
      event.preventDefault();
      applyHqDeskFilter(container, chip.getAttribute('data-hq-feed-filter') || 'all');
      return;
    }
    const step = target.closest('button[data-hq-loop-step]');
    if (step && container.contains(step)) {
      event.preventDefault();
      const id = step.getAttribute('data-hq-loop-step') || 'all';
      const kind = hqFeedKindForLoopStep(id);
      const current = hqNormalizeFeedFilter(container.dataset.hqDeskFilter);
      applyHqDeskFilter(container, kind === current ? 'all' : kind);
    }
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

async function clearGrokDeskHits(
  container: HTMLElement,
  btn?: HTMLButtonElement,
): Promise<void> {
  if (typeof window !== 'undefined' && !window.confirm(GROK_HITS_CLEAR_CONFIRM)) return;
  const original = btn?.textContent || 'Clear Grok hits';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Clearing Grok hits…';
  }
  try {
    const result = await invokeAdminAction<{
      deleted?: number;
      deleted_interactions?: number;
      gsc?: string;
    }>('clear_grok_test_hits');
    if (!result.success) {
      showToast(result.error || 'Grok hit clear failed', 'info');
      return;
    }
    const deleted = result.data?.deleted ?? 0;
    const clicks = result.data?.deleted_interactions ?? 0;
    showToast(
      `Cleared ${deleted} Grok test hits${clicks ? ` and ${clicks} click rows` : ''}. Search Console unchanged.`,
      'success',
    );
    await renderOwnerFunnelDesk(container);
  } catch {
    showToast('Grok hit clear failed. Search Console was not touched.', 'info');
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
  bindDeskInteractions(container);
  container.innerHTML = SKELETON;
  try {
    // Tiles come from get_owner_funnel_desk (homepage ticker RPCs + last-N events).
    const [result, guardResult] = await Promise.all([
      invokeAdminAction<OwnerFunnelDeskMetrics>(
        'get_owner_funnel_desk',
        {},
        { timeoutMs: 8_000 },
      ),
      invokeAdminAction<PlatformGuardSnapshot>('get_platform_guard', {}, { timeoutMs: 4_000 }).catch(
        () => ({ success: false as const, error: 'guard' }),
      ),
    ]);
    const loaded = ownerFunnelDeskFromInvokeResult(result);
    const guard = guardResult.success
      ? parsePlatformGuardSnapshot(guardResult.data)
      : emptyPlatformGuardSnapshot();
    rememberPublicPlatformGuard(guard);
    renderOwnerFunnelDeskView(container, loaded.metrics, undefined, guard);
  } catch {
    renderOwnerFunnelDeskView(container, EMPTY_METRICS);
  }
}
