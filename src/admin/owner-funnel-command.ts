/**
 * HQ Command order — one hole from the six desk numbers.
 * No extra tiles. No Prize / Website / Promoters copy (those stay behind More).
 */

import {
  formatOwnerRate,
  type OwnerFunnelDeskMetrics,
  type OwnerFunnelFeedRow,
} from './owner-funnel-desk-helpers';

export type HqCommandSeverity = 'hole' | 'watch' | 'ok' | 'blind';

export type HqCommandOrder = {
  id: string;
  title: string;
  detail: string;
  evidence: string;
  severity: HqCommandSeverity;
};

export type HqLoopStepId = 'visits' | 'landings' | 'getlink' | 'share' | 'locked';

export type HqFeedFilter = 'all' | 'landed' | 'got_link' | 'shared' | 'locked';

export type HqLoopStep = {
  id: HqLoopStepId;
  label: string;
  value: number;
  rate: string | null;
  drop: number;
  hole: boolean;
};

export type HqViaMix = { direct: number; friend: number; promoter: number };

const GETLINK_LANDING_HOLE = 0.35;
const SEND_GETLINK_THIN = 0.25;

function count(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function rateOrDash(num: number, den: number): string {
  if (den <= 0) return '—';
  return formatOwnerRate(num, den);
}

function dropCount(from: number, to: number): number {
  if (from <= 0 || to >= from) return 0;
  return from - to;
}

function feedRows(metrics: OwnerFunnelDeskMetrics): OwnerFunnelFeedRow[] {
  return Array.isArray(metrics.feed) ? metrics.feed : [];
}

export function hqLoopHoleStep(orderId: string): HqLoopStepId | null {
  switch (orderId) {
    case 'quiet':
    case 'gsc-blind':
    case 'gsc-timeout':
    case 'gsc-without-visits':
      return 'visits';
    case 'no-friend-land':
      return 'landings';
    case 'land-no-getlink':
      return 'getlink';
    case 'getlink-no-send':
    case 'loop-thin-send':
      return 'share';
    case 'send-no-lock':
      return 'locked';
    default:
      return null;
  }
}

export function hqFeedKindForLoopStep(step: string | null | undefined): HqFeedFilter {
  switch (step) {
    case 'landings':
    case 'landed':
      return 'landed';
    case 'getlink':
    case 'got_link':
      return 'got_link';
    case 'share':
    case 'shared':
      return 'shared';
    case 'locked':
      return 'locked';
    default:
      return 'all';
  }
}

export function hqLoopStepForFeedFilter(filter: string | null | undefined): HqLoopStepId | 'all' {
  switch (filter) {
    case 'landed':
    case 'landings':
      return 'landings';
    case 'got_link':
    case 'getlink':
      return 'getlink';
    case 'shared':
    case 'share':
      return 'share';
    case 'locked':
      return 'locked';
    default:
      return 'all';
  }
}

export function hqNormalizeFeedFilter(raw: string | null | undefined): HqFeedFilter {
  return hqFeedKindForLoopStep(raw);
}

export function hqAgoLabel(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 45) return 'just now';
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function hqViaMix(feed: OwnerFunnelFeedRow[]): HqViaMix {
  const mix: HqViaMix = { direct: 0, friend: 0, promoter: 0 };
  for (const row of feed) {
    if (row.kind !== 'landed') continue;
    if (row.via === 'promoter') mix.promoter += 1;
    else if (row.via === 'friend') mix.friend += 1;
    else mix.direct += 1;
  }
  return mix;
}

export function hqViaMixLine(mix: HqViaMix): string {
  if (mix.direct + mix.friend + mix.promoter <= 0) return '';
  return `Via mix: ${mix.direct} direct · ${mix.friend} /r/ · ${mix.promoter} /a/.`;
}

export function hqNewestFeedRow(
  feed: OwnerFunnelFeedRow[],
  kind?: OwnerFunnelFeedRow['kind'],
): OwnerFunnelFeedRow | null {
  const rows = kind ? feed.filter((row) => row.kind === kind) : feed.slice();
  let best: OwnerFunnelFeedRow | null = null;
  let bestMs = -1;
  for (const row of rows) {
    const ms = Date.parse(row.at);
    if (!Number.isFinite(ms)) continue;
    if (ms >= bestMs) {
      best = row;
      bestMs = ms;
    }
  }
  return best;
}

function hqCommandOrderCore(metrics: OwnerFunnelDeskMetrics): Omit<HqCommandOrder, 'evidence'> {
  const visits = count(metrics.visits);
  const landings = count(metrics.friendLandings ?? metrics.landings);
  const getLink = count(metrics.getLink);
  const share = count(metrics.share);
  const locked = count(metrics.locked);
  const junk = count(metrics.junkVisits);
  const gsc = metrics.gsc;
  const gscStatus = gsc?.status || 'missing_credentials';
  const gscClicks = count(gsc?.clicks);
  const gscReady = gscStatus === 'ok' || gscStatus === 'ok-cached';
  const junkNote = junk > 0 ? ` ${junk} junk/test page views stay off these tiles.` : '';

  if (visits === 0 && landings === 0 && getLink === 0) {
    if (gscReady && gscClicks > 0) {
      return {
        id: 'gsc-without-visits',
        title: 'Google shows taps. This desk shows zero real visits.',
        detail: junk
          ? `${junk} junk/test page views stay off these tiles. Clear junk visits if that is the filter.`
          : 'Junk/test views stay off these tiles. If junk is high, clear junk visits.',
        severity: 'watch',
      };
    }
    if (gscStatus === 'missing_credentials') {
      return {
        id: 'gsc-blind',
        title: 'Search Console is not on this desk.',
        detail:
          'Numbers load from the server GSC_SERVICE_ACCOUNT_JSON secret. Tiles stay at zero until that secret is set.',
        severity: 'blind',
      };
    }
    if (gscStatus === 'timeout') {
      return {
        id: 'gsc-timeout',
        title: 'Search Console timed out.',
        detail: 'Tiles can still load. Refresh, or wait for the last-ok cache.',
        severity: 'watch',
      };
    }
    return {
      id: 'quiet',
      title: 'No real visits in 7 days.',
      detail: 'Organic and /r/ landings are both quiet. Check Google Search below.',
      severity: 'watch',
    };
  }

  if (landings === 0 && getLink === 0) {
    return {
      id: 'no-friend-land',
      title: 'People open the site. Nobody starts a /r/ race.',
      detail: `Share the Get my link path. Direct visits are not the loop.${junkNote}`,
      severity: 'hole',
    };
  }

  if (landings > 0 && (getLink === 0 || getLink / landings < GETLINK_LANDING_HOLE)) {
    return {
      id: 'land-no-getlink',
      title: 'People land on /r/. They do not Get my link.',
      detail: 'That is the hole. Keep the first screen to title, rungs, and Get my link.',
      severity: 'hole',
    };
  }

  if (getLink > 0 && share === 0) {
    return {
      id: 'getlink-no-send',
      title: 'Links mint. Nobody verified Send.',
      detail: 'That is the hole. Copy does not count. Send it now has to be the tap.',
      severity: 'hole',
    };
  }

  if (share > 0 && locked === 0) {
    return {
      id: 'send-no-lock',
      title: 'Sends happen. No friend credit yet.',
      detail: 'Paste and Turnstile are the wall. A friend must Get my link.',
      severity: 'hole',
    };
  }

  if (getLink > 0 && share / getLink < SEND_GETLINK_THIN) {
    return {
      id: 'loop-thin-send',
      title: 'The loop closes, but Send is thin.',
      detail: 'Get-link is ahead of verified Send. Copy still does not count.',
      severity: 'watch',
    };
  }

  return {
    id: 'loop-closing',
    title: 'The loop is closing.',
    detail: 'Keep the Site Drop ladder fast.',
    severity: 'ok',
  };
}

function lastLine(
  feed: OwnerFunnelFeedRow[],
  kind: OwnerFunnelFeedRow['kind'],
  prefix: string,
  now: number,
): string {
  const row = hqNewestFeedRow(feed, kind);
  if (!row) return '';
  const ago = hqAgoLabel(row.at, now);
  return ago ? `${prefix} ${ago}.` : '';
}

function hqOrderEvidence(
  metrics: OwnerFunnelDeskMetrics,
  order: Omit<HqCommandOrder, 'evidence'>,
  now: number,
): string {
  const feed = feedRows(metrics);
  const mixLine = hqViaMixLine(hqViaMix(feed));
  const parts: string[] = [];

  switch (order.id) {
    case 'no-friend-land':
      parts.push(lastLine(feed, 'landed', 'Last land', now) || 'No /r/ land in the log.');
      break;
    case 'land-no-getlink':
      parts.push(lastLine(feed, 'landed', 'Last /r/ land', now));
      parts.push(lastLine(feed, 'got_link', 'Last Get-link', now) || 'No Get-link in the log.');
      break;
    case 'getlink-no-send':
      parts.push(lastLine(feed, 'got_link', 'Last Get-link', now));
      parts.push('No verified Send in the log.');
      break;
    case 'send-no-lock':
      parts.push(lastLine(feed, 'shared', 'Last Send', now));
      parts.push('No lock in the log.');
      break;
    case 'loop-thin-send':
    case 'loop-closing': {
      const last = hqNewestFeedRow(feed, 'locked') || hqNewestFeedRow(feed, 'shared');
      if (last) {
        const ago = hqAgoLabel(last.at, now);
        if (ago) parts.push(`Last ${last.label} ${ago}.`);
      }
      break;
    }
    default:
      break;
  }

  parts.push(mixLine);
  return parts.filter(Boolean).join(' ');
}

export function hqCommandOrder(metrics: OwnerFunnelDeskMetrics, now = Date.now()): HqCommandOrder {
  const core = hqCommandOrderCore(metrics);
  return { ...core, evidence: hqOrderEvidence(metrics, core, now) };
}

export function hqDefaultFeedFilter(metrics: OwnerFunnelDeskMetrics): HqFeedFilter {
  const order = hqCommandOrder(metrics);
  if (order.severity !== 'hole') return 'all';
  return hqFeedKindForLoopStep(hqLoopHoleStep(order.id));
}

export function hqLoopSteps(metrics: OwnerFunnelDeskMetrics): HqLoopStep[] {
  const visits = count(metrics.visits);
  const landings = count(metrics.friendLandings ?? metrics.landings);
  const getLink = count(metrics.getLink);
  const share = count(metrics.share);
  const locked = count(metrics.locked);
  const holeId = hqLoopHoleStep(hqCommandOrder(metrics).id);
  const getLinkBase = landings > 0 ? landings : visits;

  const rows: Array<Omit<HqLoopStep, 'hole'>> = [
    { id: 'visits', label: 'Visits', value: visits, rate: null, drop: 0 },
    {
      id: 'landings',
      label: 'Landings',
      value: landings,
      rate: rateOrDash(landings, visits),
      drop: dropCount(visits, landings),
    },
    {
      id: 'getlink',
      label: 'Get-link',
      value: getLink,
      rate: rateOrDash(getLink, getLinkBase),
      drop: dropCount(getLinkBase, getLink),
    },
    {
      id: 'share',
      label: 'Share',
      value: share,
      rate: rateOrDash(share, getLink),
      drop: dropCount(getLink, share),
    },
    {
      id: 'locked',
      label: 'Locked',
      value: locked,
      rate: rateOrDash(locked, share),
      drop: dropCount(share, locked),
    },
  ];

  return rows.map((row) => ({ ...row, hole: holeId === row.id }));
}

export function hqFeedFilterLabel(filter: HqFeedFilter): string {
  switch (filter) {
    case 'landed':
      return 'Landed';
    case 'got_link':
      return 'Got a link';
    case 'shared':
      return 'Shared';
    case 'locked':
      return 'Locked';
    default:
      return 'All';
  }
}

const BANNED_ORDER =
  /Funnel|Friends|Prize|Website|Promoters|Referrals|Banners|Claims|\bCMS\b|What.?s happening now|More numbers/i;

/** Guard so HQ copy cannot leak More-only labels onto the desk. */
export function hqCommandCopyIsDeskSafe(order: HqCommandOrder): boolean {
  const blob = `${order.id} ${order.title} ${order.detail} ${order.evidence}`;
  return !BANNED_ORDER.test(blob);
}
