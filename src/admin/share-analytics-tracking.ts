/**
 * Share Analytics admin tab — unified tracking hub (KPI strip, range, autorefresh, copy JSON).
 */

import { escapeHtml } from '../content';
import { showToast } from '../ui';
import {
  buildAdminTabDaysSelectHtml,
  type ShareTrackingSummary,
  SHARES_AUTOREFRESH_KEY,
  SHARES_DAYS_STORAGE_KEY,
} from './admin-tab-tracking-helpers';
import {
  buildAutorefreshSelectHtml,
  wireAdminStatsAutorefresh,
} from '../lib/admin-stats-autorefresh';

let lastSummary: ShareTrackingSummary | null = null;
let onSummaryChange: ((summary: ShareTrackingSummary | null) => void) | null = null;

const COLLAPSE_KEY = 'vr_admin_tracking_collapsed_shares_charts';

export function reportShareTrackingSummary(summary: ShareTrackingSummary): void {
  lastSummary = summary;
  onSummaryChange?.(summary);
}

function isChartsCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function setChartsCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  } catch {
    /* non-fatal */
  }
}

function buildShareHubHeaderHtml(summary: ShareTrackingSummary | null): string {
  const kpi = summary
    ? `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
        <div class="rounded-lg bg-violet-950/40 border border-violet-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">In view</div>
          <div class="text-sm font-bold text-white tabular-nums">${summary.inView}</div>
        </div>
        <div class="rounded-lg bg-violet-950/40 border border-violet-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Unique sharers</div>
          <div class="text-sm font-bold text-emerald-300 tabular-nums">${summary.uniqueSharers}</div>
        </div>
        <div class="rounded-lg bg-violet-950/40 border border-violet-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Top platform</div>
          <div class="text-[10px] font-bold text-white truncate">${escapeHtml(summary.topPlatform)}</div>
          <div class="text-[8px] text-zinc-500 tabular-nums">${summary.topPlatformCount} shares</div>
        </div>
        <div class="rounded-lg bg-amber-950/40 border border-amber-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Peak day</div>
          <div class="text-[10px] font-bold text-amber-300 truncate">${escapeHtml(summary.peakDay)}</div>
          <div class="text-[8px] text-zinc-500 tabular-nums">${summary.peakDayCount} shares</div>
        </div>
        <div class="rounded-lg bg-emerald-950/40 border border-emerald-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">A/B leader</div>
          <div class="text-sm font-bold text-emerald-300 tabular-nums">${escapeHtml(summary.conversionLeader)}</div>
        </div>
      </div>
      <div class="text-[8px] text-zinc-500 mt-1.5">
        ${summary.totalAllTime} shares all time · ${summary.platforms} platforms ·
        ${summary.testShareCount > 0 ? `${summary.testShareCount} test rows filtered from view · ` : ''}
        Range ${escapeHtml(String(summary.filterDays === 0 ? 'all time' : `${summary.filterDays}d`))}
      </div>`
    : `<div class="text-[9px] text-zinc-500 mt-2">Loading share tracking…</div>`;

  return `
    <div id="share-tracking-header" class="mb-3 pb-3 border-b border-white/10">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="text-xs font-semibold text-zinc-100">Share Analytics</div>
          <div class="text-[9px] text-zinc-500">Platform breakdown, A/B variants, and signup conversion proxy</div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${buildAdminTabDaysSelectHtml(SHARES_DAYS_STORAGE_KEY, 'data-share-tracking-range', summary?.filterDays)}
          ${buildAutorefreshSelectHtml('data-share-tracking-autorefresh', SHARES_AUTOREFRESH_KEY)}
          <button type="button" data-share-tracking-copy
            class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">⎘ Copy JSON</button>
          <button type="button" data-share-tracking-refresh
            class="text-[9px] px-2 py-0.5 bg-violet-600/80 hover:bg-violet-600 text-white rounded disabled:opacity-50">↻ Refresh</button>
        </div>
      </div>
      ${kpi}
    </div>`;
}

function renderHubChrome(hub: HTMLElement): void {
  const slot = hub.querySelector('#share-tracking-header-slot');
  if (slot) slot.innerHTML = buildShareHubHeaderHtml(lastSummary);

  const chartsSection = hub.querySelector('[data-tracking-section="share-charts"]') as HTMLElement | null;
  const toggle = hub.querySelector('[data-share-tracking-collapse]') as HTMLButtonElement | null;
  if (chartsSection && toggle) {
    const collapsed = isChartsCollapsed();
    chartsSection.classList.toggle('hidden', collapsed);
    toggle.textContent = collapsed ? 'Show charts' : 'Hide charts';
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }
}

export function buildShareTrackingShellOpenHtml(): string {
  const collapsed = isChartsCollapsed();
  return `
    <div data-vr-share-tracking-hub="1" class="mb-4 p-3 border border-violet-500/25 bg-zinc-950/50 rounded-2xl">
      <div id="share-tracking-header-slot"></div>
      <div class="flex items-center justify-end gap-2 mb-2">
        <button type="button" data-share-tracking-collapse aria-expanded="${collapsed ? 'false' : 'true'}"
          class="text-[8px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-300 rounded">${collapsed ? 'Show charts' : 'Hide charts'}</button>
      </div>
      <div data-tracking-section="share-charts" class="${collapsed ? 'hidden ' : ''}share-charts-section">`;
}

export const SHARE_TRACKING_SHELL_CLOSE = `</div></div>`;

export interface ShareTrackingWireOptions {
  onRefresh: () => void | Promise<void>;
  onRangeChange: (days: number) => void;
  getCopyPayload: () => string;
}

export function wireShareTrackingHub(hub: HTMLElement, options: ShareTrackingWireOptions): void {
  if (hub.dataset.shareHubBound === '1') {
    renderHubChrome(hub);
    return;
  }
  hub.dataset.shareHubBound = '1';

  onSummaryChange = () => renderHubChrome(hub);
  renderHubChrome(hub);

  wireAdminStatsAutorefresh(
    hub,
    SHARES_AUTOREFRESH_KEY,
    'data-share-tracking-autorefresh',
    () => options.onRefresh(),
  );

  hub.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const refreshBtn = target.closest('[data-share-tracking-refresh]');
    const copyBtn = target.closest('[data-share-tracking-copy]');
    const collapseBtn = target.closest('[data-share-tracking-collapse]');

    if (refreshBtn && hub.contains(refreshBtn)) {
      e.preventDefault();
      void options.onRefresh();
      return;
    }
    if (copyBtn && hub.contains(copyBtn)) {
      e.preventDefault();
      const payload = options.getCopyPayload();
      if (payload) {
        navigator.clipboard.writeText(payload).then(() => showToast('Copied share analytics JSON', 'success'));
      }
      return;
    }
    if (collapseBtn && hub.contains(collapseBtn)) {
      e.preventDefault();
      setChartsCollapsed(!isChartsCollapsed());
      renderHubChrome(hub);
    }
  });

  hub.addEventListener('change', (e) => {
    const select = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-share-tracking-range]');
    if (!select || !hub.contains(select)) return;
    options.onRangeChange(Number(select.value));
  });
}