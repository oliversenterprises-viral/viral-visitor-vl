/** Pure helpers for Edit Content unified visitor + banner tracking hub. */

import type { FunnelRow } from './visitor-funnel-stats-helpers';
import type { BannerStatRow } from './banner-stats-helpers';
import { formatBannerCtr } from './banner-stats-helpers';

export type TrackingTimeRange = 'all' | '24h' | '7d' | '30d';

export const TRACKING_TIME_RANGE_STORAGE_KEY = 'vr_admin_tracking_time_range';

export const TRACKING_TIME_RANGE_OPTIONS: ReadonlyArray<{ value: TrackingTimeRange; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

const RANGE_MS: Record<Exclude<TrackingTimeRange, 'all'>, number> = {
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
  '30d': 30 * 24 * 60 * 60_000,
};

export function parseTrackingTimeRange(raw: string | null): TrackingTimeRange {
  if (raw === '24h' || raw === '7d' || raw === '30d' || raw === 'all') return raw;
  return 'all';
}

export function eventIsoTimestamp(event: Record<string, unknown>): string {
  return String(event.created_at || event.timestamp || '').trim();
}

/** Client-side window filter for admin quick panels (server rows still capped at 500). */
export function filterEventsByTrackingRange<T extends Record<string, unknown>>(
  events: readonly T[],
  range: TrackingTimeRange,
  now = Date.now(),
): T[] {
  if (range === 'all') return [...events];
  const cutoff = now - RANGE_MS[range];
  return events.filter((e) => {
    const ts = eventIsoTimestamp(e);
    if (!ts) return true;
    const ms = new Date(ts).getTime();
    return !Number.isNaN(ms) && ms >= cutoff;
  });
}

export interface FunnelStepConversion {
  step: string;
  fromStep: string | null;
  stepRate: string;
  overallRate: string;
}

export function computeFunnelStepConversions(funnel: readonly FunnelRow[]): FunnelStepConversion[] {
  const landingUnique = funnel.find((r) => r.name === 'SiteLanding')?.unique ?? 0;
  return funnel.map((row, i) => {
    const prev = i > 0 ? funnel[i - 1] : null;
    const prevUnique = prev?.unique ?? 0;
    const stepRate =
      i === 0
        ? '100%'
        : prevUnique > 0 && row.unique > 0
          ? `${((row.unique / prevUnique) * 100).toFixed(1)}%`
          : '—';
    const overallRate =
      row.name === 'SiteLanding'
        ? '100%'
        : landingUnique > 0 && row.unique > 0
          ? `${((row.unique / landingUnique) * 100).toFixed(1)}%`
          : '—';
    return { step: row.name, fromStep: prev?.name ?? null, stepRate, overallRate };
  });
}

export function countUniqueSessions(events: readonly Record<string, unknown>[]): number {
  const ids = new Set<string>();
  for (const e of events) {
    const id = String(e.session_id || e.sessionId || '').trim();
    if (id) ids.add(id);
  }
  return ids.size;
}

export interface TrackingHubSummary {
  range: TrackingTimeRange;
  landings: number;
  engaged: number;
  sessions: number;
  claimConversion: string;
  bannerImpressions: number;
  bannerClicks: number;
  bannerCtr: string;
  visitorSource: 'server' | 'local';
  bannerSource: 'server' | 'local';
  visitorEvents: number;
  bannerEvents: number;
}

export function buildTrackingHubSummary(input: {
  range: TrackingTimeRange;
  funnel: readonly FunnelRow[];
  claimConversion: string;
  sessions: number;
  engaged: number;
  landings: number;
  visitorSource: 'server' | 'local';
  bannerSource: 'server' | 'local';
  visitorEvents: number;
  bannerEvents: number;
  bannerRows: readonly BannerStatRow[];
}): TrackingHubSummary {
  const impressions = input.bannerRows.reduce((s, r) => s + r.impressions, 0);
  const clicks = input.bannerRows.reduce((s, r) => s + r.clicks, 0);
  return {
    range: input.range,
    landings: input.landings,
    engaged: input.engaged,
    sessions: input.sessions,
    claimConversion: input.claimConversion,
    bannerImpressions: impressions,
    bannerClicks: clicks,
    bannerCtr: formatBannerCtr(impressions, clicks),
    visitorSource: input.visitorSource,
    bannerSource: input.bannerSource,
    visitorEvents: input.visitorEvents,
    bannerEvents: input.bannerEvents,
  };
}

let currentRange: TrackingTimeRange = 'all';
let lastSummary: TrackingHubSummary | null = null;
let onSummaryChange: ((summary: TrackingHubSummary | null) => void) | null = null;

export function getTrackingTimeRange(): TrackingTimeRange {
  return currentRange;
}

export function loadTrackingTimeRange(): TrackingTimeRange {
  try {
    currentRange = parseTrackingTimeRange(localStorage.getItem(TRACKING_TIME_RANGE_STORAGE_KEY));
  } catch {
    currentRange = 'all';
  }
  return currentRange;
}

export function setTrackingTimeRange(range: TrackingTimeRange): void {
  currentRange = range;
  try {
    localStorage.setItem(TRACKING_TIME_RANGE_STORAGE_KEY, range);
  } catch {
    /* non-fatal */
  }
}

const emptySummary = (): TrackingHubSummary => ({
  range: currentRange,
  landings: 0,
  engaged: 0,
  sessions: 0,
  claimConversion: '—',
  bannerImpressions: 0,
  bannerClicks: 0,
  bannerCtr: '—',
  visitorSource: 'local',
  bannerSource: 'local',
  visitorEvents: 0,
  bannerEvents: 0,
});

export function getTrackingHubSummary(): TrackingHubSummary | null {
  return lastSummary;
}

export function reportTrackingHubSummary(partial: Partial<TrackingHubSummary>): void {
  lastSummary = { ...(lastSummary ?? emptySummary()), ...partial, range: currentRange };
  onSummaryChange?.(lastSummary);
}

export function onTrackingHubSummaryChange(
  handler: (summary: TrackingHubSummary | null) => void,
): () => void {
  onSummaryChange = handler;
  return () => {
    if (onSummaryChange === handler) onSummaryChange = null;
  };
}

export function buildTrackingRangeSelectHtml(current: TrackingTimeRange): string {
  const options = TRACKING_TIME_RANGE_OPTIONS.map(
    ({ value, label }) =>
      `<option value="${value}"${value === current ? ' selected' : ''}>${label}</option>`,
  ).join('');
  return `
    <label class="inline-flex items-center gap-1 text-[9px] text-zinc-500">
      <span>Range</span>
      <select data-tracking-time-range class="bg-zinc-900 border border-white/15 rounded px-1 py-0.5 text-[9px] text-zinc-200 focus:border-violet-500/50">
        ${options}
      </select>
    </label>`;
}