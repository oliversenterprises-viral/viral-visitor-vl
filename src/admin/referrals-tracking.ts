/**
 * Referrals admin tab — unified tracking hub (KPI strip, range, autorefresh, copy JSON).
 */

import { escapeHtml } from '../content';
import { showToast } from '../ui';
import {
  buildAdminTabDaysSelectHtml,
  type ReferralTrackingSummary,
  REFERRALS_AUTOREFRESH_KEY,
  REFERRALS_DAYS_STORAGE_KEY,
} from './admin-tab-tracking-helpers';
import {
  buildAutorefreshSelectHtml,
  wireAdminStatsAutorefresh,
} from '../lib/admin-stats-autorefresh';

let lastSummary: ReferralTrackingSummary | null = null;
let onSummaryChange: ((summary: ReferralTrackingSummary | null) => void) | null = null;

const COLLAPSE_KEY = 'vr_admin_tracking_collapsed_referrals_stats';

export function reportReferralsTrackingSummary(summary: ReferralTrackingSummary): void {
  lastSummary = summary;
  onSummaryChange?.(summary);
}

function isStatsCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function setStatsCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  } catch {
    /* non-fatal */
  }
}

function buildReferralsHubHeaderHtml(summary: ReferralTrackingSummary | null): string {
  const kpi = summary
    ? `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
        <div class="rounded-lg bg-violet-950/40 border border-violet-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">In view</div>
          <div class="text-sm font-bold text-white tabular-nums">${summary.inView}</div>
        </div>
        <div class="rounded-lg bg-violet-950/40 border border-violet-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Unique referrers</div>
          <div class="text-sm font-bold text-emerald-300 tabular-nums">${summary.uniqueReferrers}</div>
        </div>
        <div class="rounded-lg bg-violet-950/40 border border-violet-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Today</div>
          <div class="text-sm font-bold text-white tabular-nums">${summary.today}</div>
        </div>
        <div class="rounded-lg bg-red-950/40 border border-red-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">High-risk IPs</div>
          <div class="text-sm font-bold text-red-400 tabular-nums">${summary.highRiskIps}</div>
        </div>
        <div class="rounded-lg bg-emerald-950/40 border border-emerald-500/25 px-2 py-1.5">
          <div class="text-[7px] text-zinc-500 uppercase">Top referrer</div>
          <div class="text-[10px] font-bold text-emerald-300 truncate">${escapeHtml(summary.topReferrer)}</div>
          <div class="text-[8px] text-zinc-500 tabular-nums">${summary.topReferrerCount} refs</div>
        </div>
      </div>
      <div class="text-[8px] text-zinc-500 mt-1.5">
        ${summary.totalReal} real referrals in database · Range ${escapeHtml(String(summary.filterDays === 0 ? 'all time' : `${summary.filterDays}d`))}
      </div>`
    : `<div class="text-[9px] text-zinc-500 mt-2">Loading referral tracking…</div>`;

  return `
    <div id="referrals-tracking-header" class="mb-3 pb-3 border-b border-white/10">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="text-xs font-semibold text-zinc-100">Referral Analytics</div>
          <div class="text-[9px] text-zinc-500">Credited signups, abuse detection, and referrer performance</div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${buildAdminTabDaysSelectHtml(REFERRALS_DAYS_STORAGE_KEY, 'data-referrals-tracking-range', summary?.filterDays)}
          ${buildAutorefreshSelectHtml('data-referrals-tracking-autorefresh', REFERRALS_AUTOREFRESH_KEY)}
          <button type="button" data-referrals-tracking-copy
            class="text-[9px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded">⎘ Copy JSON</button>
          <button type="button" data-referrals-tracking-refresh
            class="text-[9px] px-2 py-0.5 bg-violet-600/80 hover:bg-violet-600 text-white rounded disabled:opacity-50">↻ Refresh</button>
        </div>
      </div>
      ${kpi}
    </div>`;
}

function renderHubChrome(hub: HTMLElement): void {
  const slot = hub.querySelector('#referrals-tracking-header-slot');
  if (slot) slot.innerHTML = buildReferralsHubHeaderHtml(lastSummary);

  const statsSection = hub.querySelector('[data-tracking-section="referrals-stats"]') as HTMLElement | null;
  const toggle = hub.querySelector('[data-referrals-tracking-collapse]') as HTMLButtonElement | null;
  if (statsSection && toggle) {
    const collapsed = isStatsCollapsed();
    statsSection.classList.toggle('hidden', collapsed);
    toggle.textContent = collapsed ? 'Show stats' : 'Hide stats';
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }
}

export function buildReferralsTrackingShellOpenHtml(): string {
  const collapsed = isStatsCollapsed();
  return `
    <div data-vr-referrals-tracking-hub="1" class="mb-4 p-3 border border-violet-500/25 bg-zinc-950/50 rounded-2xl">
      <div id="referrals-tracking-header-slot"></div>
      <div class="flex items-center justify-end gap-2 mb-2">
        <button type="button" data-referrals-tracking-collapse aria-expanded="${collapsed ? 'false' : 'true'}"
          class="text-[8px] px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-300 rounded">${collapsed ? 'Show stats' : 'Hide stats'}</button>
      </div>
      <div data-tracking-section="referrals-stats" class="${collapsed ? 'hidden ' : ''}referrals-stats-section">`;
}

export const REFERRALS_TRACKING_SHELL_CLOSE = `</div></div>`;

export interface ReferralsTrackingWireOptions {
  onRefresh: () => void | Promise<void>;
  onRangeChange: (days: number) => void;
  getCopyPayload: () => string;
}

export function wireReferralsTrackingHub(hub: HTMLElement, options: ReferralsTrackingWireOptions): void {
  if (hub.dataset.referralsHubBound === '1') {
    renderHubChrome(hub);
    return;
  }
  hub.dataset.referralsHubBound = '1';

  onSummaryChange = () => renderHubChrome(hub);
  renderHubChrome(hub);

  wireAdminStatsAutorefresh(
    hub,
    REFERRALS_AUTOREFRESH_KEY,
    'data-referrals-tracking-autorefresh',
    () => options.onRefresh(),
  );

  hub.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const refreshBtn = target.closest('[data-referrals-tracking-refresh]');
    const copyBtn = target.closest('[data-referrals-tracking-copy]');
    const collapseBtn = target.closest('[data-referrals-tracking-collapse]');

    if (refreshBtn && hub.contains(refreshBtn)) {
      e.preventDefault();
      void options.onRefresh();
      return;
    }
    if (copyBtn && hub.contains(copyBtn)) {
      e.preventDefault();
      const payload = options.getCopyPayload();
      if (payload) {
        navigator.clipboard.writeText(payload).then(() => showToast('Copied referrals JSON', 'success'));
      }
      return;
    }
    if (collapseBtn && hub.contains(collapseBtn)) {
      e.preventDefault();
      setStatsCollapsed(!isStatsCollapsed());
      renderHubChrome(hub);
    }
  });

  hub.addEventListener('change', (e) => {
    const select = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-referrals-tracking-range]');
    if (!select || !hub.contains(select)) return;
    options.onRangeChange(Number(select.value));
  });
}