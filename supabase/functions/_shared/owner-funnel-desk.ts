/**
 * Owner funnel desk — six numbers + one feed.
 * Visits / Friend landings / Get-link / Share / Locked / Get-link rate.
 * Copy, clipboard, and intent-open are not shares. Pending/expired are not lock.
 */

import { isTestReferralRecord, isTestReferrerCode } from './test-referral.ts';
import type { OwnerFunnelGscMetrics } from './owner-funnel-gsc.ts';
import { filterTestVisitorFunnelEvents } from './visitor-funnel-test.ts';
import {
  isVerifiedSharePlatform,
  LOCK_PLATFORM_FIRST_REFERRAL,
  normalizeSharePlatform,
} from './referrer-share-deadline.ts';

export const OWNER_FUNNEL_WINDOW_DAYS = 7;
export const OWNER_FUNNEL_FEED_LIMIT = 40;
/** Bounded last-N for event-query tiles + feed. Never page the full table. */
export const OWNER_FUNNEL_WINDOW_LIMIT = 400;

export type OwnerFunnelVia = 'direct' | 'friend' | 'promoter';
export type OwnerFunnelFeedKind = 'landed' | 'got_link' | 'shared' | 'locked';

export type OwnerFunnelFeedRow = {
  kind: OwnerFunnelFeedKind;
  label: 'Landed' | 'Got a link' | 'Shared' | 'Locked';
  at: string;
  via: OwnerFunnelVia;
  viaLabel: string;
  code?: string;
  friendCode?: string;
};

export type OwnerFunnelDeskMetrics = {
  windowDays: number;
  visits: number;
  junkVisits?: number;
  friendLandings: number;
  landings: number;
  getLink: number;
  share: number;
  locked: number;
  getLinkRate: string;
  feed: OwnerFunnelFeedRow[];
  gsc?: OwnerFunnelGscMetrics;
};

export type OwnerFunnelEvent = Record<string, unknown>;
export type OwnerFunnelShareRow = Record<string, unknown>;
export type OwnerFunnelReferralRow = Record<string, unknown>;
export type OwnerFunnelLinkRow = Record<string, unknown>;

const FEED_LABEL: Record<OwnerFunnelFeedKind, OwnerFunnelFeedRow['label']> = {
  landed: 'Landed',
  got_link: 'Got a link',
  shared: 'Shared',
  locked: 'Locked',
};

export function ownerFunnelCutoffIso(
  now = Date.now(),
  days = OWNER_FUNNEL_WINDOW_DAYS,
): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

export function inOwnerFunnelWindow(
  iso: string | undefined,
  cutoffIso: string,
): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= Date.parse(cutoffIso);
}

function eventName(event: OwnerFunnelEvent): string {
  return String(event.event_name || event.eventName || '').trim();
}

function visitorId(event: OwnerFunnelEvent): string {
  return String(event.visitor_id || event.visitorId || '').trim();
}

function createdIso(row: Record<string, unknown>): string {
  return String(row.created_at || row.createdAt || row.timestamp || '').trim();
}

function createdMs(row: Record<string, unknown>): number {
  const t = Date.parse(createdIso(row));
  return Number.isFinite(t) ? t : 0;
}

function metadataRecord(event: OwnerFunnelEvent): Record<string, unknown> {
  const meta = event.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  if (typeof meta === 'string' && meta.trim()) {
    try {
      const parsed = JSON.parse(meta) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function normalizeCode(raw: unknown): string {
  return String(raw || '').trim().toUpperCase();
}

export function formatOwnerRate(num: number, den: number): string {
  if (!den || den <= 0) return '0%';
  return `${((num / den) * 100).toFixed(1)}%`;
}

export function uniqueVisitorsForEvent(
  events: readonly OwnerFunnelEvent[],
  name: string,
): number {
  const ids = new Set<string>();
  for (const event of events) {
    if (eventName(event) !== name) continue;
    const id = visitorId(event);
    if (id) ids.add(id);
  }
  return ids.size;
}

export function filterOwnerFunnelEvents(
  events: readonly OwnerFunnelEvent[],
): OwnerFunnelEvent[] {
  return filterTestVisitorFunnelEvents(events);
}

export function resolveOwnerFunnelVia(row: Record<string, unknown>): OwnerFunnelVia {
  const meta = metadataRecord(row);
  const path = String(meta.path || row.path || '').trim();
  const aff = String(meta.aff_code || meta.affCode || row.aff_code || '').trim();
  const ref = String(row.ref_code || row.refCode || meta.ref_code || '').trim();
  if (/^\/a\//i.test(path) || aff) return 'promoter';
  if (/^\/r\//i.test(path) || ref) return 'friend';
  return 'direct';
}

export function isOwnerFunnelAttributedLanding(row: Record<string, unknown>): boolean {
  return resolveOwnerFunnelVia(row) !== 'direct';
}

export function uniqueAttributedLandingVisitors(events: readonly OwnerFunnelEvent[]): number {
  const ids = new Set<string>();
  for (const event of events) {
    if (eventName(event) !== 'SiteLanding') continue;
    if (!isOwnerFunnelAttributedLanding(event)) continue;
    const id = visitorId(event);
    if (id) ids.add(id);
  }
  return ids.size;
}

export function deskGetLinkRate(getLink: number, friendLandings: number, visits: number): string {
  if (friendLandings > 0) return formatOwnerRate(getLink, friendLandings);
  return formatOwnerRate(getLink, visits);
}

export function ownerFunnelViaLabel(via: OwnerFunnelVia): string {
  if (via === 'promoter') return "promoter /a/";
  if (via === 'friend') return "friend's /r/";
  return 'direct';
}

const INTENT_PLATFORMS = new Set([
  'whatsapp', 'boost-whatsapp', 'sms', 'twitter', 'x', 'linkedin', 'facebook',
  'telegram', 'email', 'reddit', 'bluesky', 'threads', 'pinterest',
]);

export function isIntentSharePlatform(platform: string): boolean {
  const p = normalizeSharePlatform(platform);
  if (p === 'native') return false;
  return INTENT_PLATFORMS.has(p) || p.startsWith('boost-');
}

function shareConfirmed(row: Record<string, unknown>): boolean {
  const meta = metadataRecord(row);
  const raw = row.confirmed ?? row.confirm_lock ?? row.confirmLock ?? meta.confirmed;
  return raw === true || raw === 1 || raw === '1' || raw === 'true';
}

/** Verified record-share send. Not copy, clipboard, intent-open, or first_referral. */
export function isDeskVerifiedShare(platformOrRow: string | Record<string, unknown>): boolean {
  const row = typeof platformOrRow === 'string' ? { platform: platformOrRow } : platformOrRow;
  const p = normalizeSharePlatform(sharePlatform(row));
  if (!p || p === LOCK_PLATFORM_FIRST_REFERRAL) return false;
  if (p === 'intent' || p === 'intent-open' || p === 'clipboard') return false;
  if (!isVerifiedSharePlatform(p)) return false;
  if (p === 'native' || p === 'whatsapp' || p === 'boost-whatsapp') return true;
  if (isIntentSharePlatform(p)) return shareConfirmed(row);
  return true;
}

function sharePlatform(row: Record<string, unknown>): string {
  const meta = metadataRecord(row);
  return String(meta.platform || row.platform || '').trim();
}

function shareReferrerCode(row: Record<string, unknown>): string {
  const direct = normalizeCode(row.referrer_code || row.referrerCode);
  if (direct && direct !== 'UNKNOWN') return direct;
  const link = String(row.referral_link || row.referralLink || '');
  const match = link.match(/\/r\/([A-Za-z0-9_-]+)/i);
  return match?.[1] ? match[1].toUpperCase() : '';
}

export function filterDeskShares(
  shares: readonly OwnerFunnelShareRow[],
): OwnerFunnelShareRow[] {
  return shares.filter((row) => {
    if (!isDeskVerifiedShare(row)) return false;
    const code = shareReferrerCode(row);
    if (!code || isTestReferrerCode(code)) return false;
    return true;
  });
}

export function filterDeskReferrals(
  rows: readonly OwnerFunnelReferralRow[],
): OwnerFunnelReferralRow[] {
  return rows.filter((row) => !isTestReferralRecord(row));
}

export function isLockedReferrer(input: {
  status?: string | null;
  referralCount: number;
}): boolean {
  if (input.referralCount >= 1) return true;
  return String(input.status || '').toLowerCase() === 'active';
}

function friendCodeFromReferral(
  row: OwnerFunnelReferralRow,
  getLinkEvents: readonly OwnerFunnelEvent[],
): string {
  const direct = normalizeCode(
    row.referred_code || row.referredCode || row.visitor_code || row.visitorCode,
  );
  if (direct && !isTestReferrerCode(direct)) return direct;

  const referrer = normalizeCode(row.referrer_code);
  const at = createdMs(row);
  if (!referrer || !at) return '';

  let best = '';
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const event of getLinkEvents) {
    if (eventName(event) !== 'GetReferralLink') continue;
    if (normalizeCode(event.ref_code || event.refCode) !== referrer) continue;
    const delta = Math.abs(createdMs(event) - at);
    if (delta > 15 * 60_000 || delta >= bestDelta) continue;
    const meta = metadataRecord(event);
    const code = normalizeCode(meta.code || meta.my_code || meta.new_code);
    if (code && code !== referrer && !isTestReferrerCode(code)) {
      best = code;
      bestDelta = delta;
    }
  }
  return best;
}

/** Homepage SECURITY DEFINER RPCs — index-friendly LIMIT, not a table scan. */
export function deskFromPublicSurfaces(input: {
  ticker?: unknown;
  linkStats?: unknown;
  activity?: unknown;
  visits?: number;
  junkVisits?: number;
  windowDays?: number;
}): OwnerFunnelDeskMetrics {
  const ticker = Array.isArray(input.ticker) ? input.ticker : [];
  const activityRaw = input.activity;
  const activityRows = Array.isArray(activityRaw)
    ? activityRaw
    : activityRaw && typeof activityRaw === 'object' && Array.isArray((activityRaw as { rows?: unknown }).rows)
      ? ((activityRaw as { rows: unknown[] }).rows)
      : [];
  const stats =
    input.linkStats && typeof input.linkStats === 'object' && !Array.isArray(input.linkStats)
      ? (input.linkStats as Record<string, unknown>)
      : {};
  const getLinkRaw = Number(stats.unique_people ?? stats.uniquePeople ?? stats.events ?? 0);
  const getLink = Number.isFinite(getLinkRaw) && getLinkRaw > 0 ? Math.round(getLinkRaw) : 0;

  const feed: OwnerFunnelFeedRow[] = [];
  const shareCodes = new Set<string>();
  const lockedCodes = new Set<string>();
  const push = (row: Record<string, unknown>) => {
    const kind = String(row.kind || '');
    const step = String(row.step || row.event_name || '');
    const at = String(row.created_at || row.createdAt || '');
    const code = String(row.referrer_code || row.referrerCode || '').trim().toUpperCase();
    if (!at) return;
    if (step === 'SiteLanding') {
      feed.push(feedRow('landed', at, 'friend'));
    } else if (step === 'GetReferralLink') {
      feed.push(feedRow('got_link', at, 'direct'));
    } else if (kind === 'share' || step === 'ShareReferral') {
      feed.push(feedRow('shared', at, 'direct', code ? { code } : {}));
      if (code) shareCodes.add(code);
    } else if (kind === 'referral') {
      feed.push(feedRow('locked', at, 'friend', code ? { code } : {}));
      if (code) lockedCodes.add(code);
    }
  };
  for (const row of [...ticker, ...activityRows]) {
    if (row && typeof row === 'object' && !Array.isArray(row)) push(row as Record<string, unknown>);
  }
  feed.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const friendLandings = feed.filter((row) => row.kind === 'landed').length;
  const visits =
    Number.isFinite(input.visits) && (input.visits as number) > 0 ? (input.visits as number) : 0;
  const junkVisits =
    Number.isFinite(input.junkVisits) && (input.junkVisits as number) > 0
      ? (input.junkVisits as number)
      : 0;
  return {
    windowDays: input.windowDays ?? OWNER_FUNNEL_WINDOW_DAYS,
    visits,
    junkVisits,
    friendLandings,
    landings: friendLandings,
    getLink,
    share: shareCodes.size,
    locked: lockedCodes.size,
    getLinkRate: deskGetLinkRate(getLink, friendLandings, visits),
    feed: feed.slice(0, OWNER_FUNNEL_FEED_LIMIT),
  };
}

export function deskHasVisitorSignal(metrics: OwnerFunnelDeskMetrics): boolean {
  return (
    metrics.visits > 0 ||
    metrics.friendLandings > 0 ||
    metrics.getLink > 0 ||
    metrics.share > 0 ||
    metrics.locked > 0 ||
    metrics.feed.length > 0
  );
}

function feedRow(
  kind: OwnerFunnelFeedKind,
  at: string,
  via: OwnerFunnelVia,
  extra: { code?: string; friendCode?: string } = {},
): OwnerFunnelFeedRow {
  return {
    kind,
    label: FEED_LABEL[kind],
    at,
    via,
    viaLabel: ownerFunnelViaLabel(via),
    ...(extra.code ? { code: extra.code } : {}),
    ...(extra.friendCode ? { friendCode: extra.friendCode } : {}),
  };
}

export function computeOwnerFunnelDeskMetrics(input: {
  events?: readonly OwnerFunnelEvent[];
  shares?: readonly OwnerFunnelShareRow[];
  referrals?: readonly OwnerFunnelReferralRow[];
  referrerLinks?: readonly OwnerFunnelLinkRow[];
  now?: number;
  windowDays?: number;
  visits?: number;
  junkVisits?: number;
}): OwnerFunnelDeskMetrics {
  const now = input.now ?? Date.now();
  const windowDays = input.windowDays ?? OWNER_FUNNEL_WINDOW_DAYS;
  const cutoff = ownerFunnelCutoffIso(now, windowDays);

  const events = filterOwnerFunnelEvents(input.events || []).filter((event) =>
    inOwnerFunnelWindow(createdIso(event), cutoff),
  );
  const shares = filterDeskShares(input.shares || []).filter((row) =>
    inOwnerFunnelWindow(createdIso(row), cutoff),
  );
  const referrals = filterDeskReferrals(input.referrals || []).filter((row) =>
    inOwnerFunnelWindow(createdIso(row), cutoff),
  );
  const links = (input.referrerLinks || []).filter((row) => {
    const code = normalizeCode(row.referrer_code);
    return !!code && !isTestReferrerCode(code);
  });

  const landings = uniqueAttributedLandingVisitors(events);
  const landingVisits = uniqueVisitorsForEvent(events, 'SiteLanding');
  const visits =
    Number.isFinite(input.visits) && (input.visits as number) >= 0
      ? (input.visits as number)
      : landingVisits;
  const junkVisits =
    Number.isFinite(input.junkVisits) && (input.junkVisits as number) >= 0 ? (input.junkVisits as number) : 0;
  const getLink = uniqueVisitorsForEvent(events, 'GetReferralLink');
  const shareCodes = new Set<string>();
  for (const row of shares) {
    const code = shareReferrerCode(row);
    if (code) shareCodes.add(code);
  }
  const share = shareCodes.size;

  const referralCount = new Map<string, number>();
  for (const row of referrals) {
    const code = normalizeCode(row.referrer_code);
    if (!code) continue;
    referralCount.set(code, (referralCount.get(code) || 0) + 1);
  }

  const linkByCode = new Map<string, OwnerFunnelLinkRow>();
  for (const row of links) {
    const code = normalizeCode(row.referrer_code);
    if (code && !linkByCode.has(code)) linkByCode.set(code, row);
  }

  const lockedCodes = new Set<string>();
  for (const [code, count] of referralCount) {
    const rawStatus = linkByCode.get(code)?.status;
    const status = typeof rawStatus === 'string' ? rawStatus : undefined;
    if (isLockedReferrer({ referralCount: count, status })) {
      lockedCodes.add(code);
    }
  }
  for (const [code, row] of linkByCode) {
    if (String(row.status || '').toLowerCase() !== 'active') continue;
    const lockAt = createdIso(row) || String(row.first_verified_share_at || '');
    if (!inOwnerFunnelWindow(lockAt, cutoff) && !referralCount.has(code)) continue;
    if (isLockedReferrer({ referralCount: referralCount.get(code) || 0, status: 'active' })) {
      lockedCodes.add(code);
    }
  }

  const getLinkEvents = events.filter((event) => eventName(event) === 'GetReferralLink');
  const feed: OwnerFunnelFeedRow[] = [];

  for (const event of events) {
    const name = eventName(event);
    const at = createdIso(event);
    if (!at) continue;
    const via = resolveOwnerFunnelVia(event);
    if (name === 'SiteLanding') {
      if (via === 'direct') continue;
      feed.push(feedRow('landed', at, via));
    } else if (name === 'GetReferralLink') {
      feed.push(feedRow('got_link', at, via));
    }
  }

  for (const row of shares) {
    const at = createdIso(row);
    if (!at) continue;
    feed.push(
      feedRow('shared', at, resolveOwnerFunnelVia(row), {
        code: shareReferrerCode(row) || undefined,
      }),
    );
  }

  for (const row of referrals) {
    const at = createdIso(row);
    const code = normalizeCode(row.referrer_code);
    if (!at || !code || !lockedCodes.has(code)) continue;
    const friendCode = friendCodeFromReferral(row, getLinkEvents);
    const via = resolveOwnerFunnelVia({
      ...row,
      ref_code: code,
      metadata: { path: '/r/' + code },
    });
    feed.push(feedRow('locked', at, via, { code, friendCode: friendCode || undefined }));
  }

  feed.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return {
    windowDays,
    visits,
    junkVisits,
    friendLandings: landings,
    landings,
    getLink,
    share,
    locked: lockedCodes.size,
    getLinkRate: deskGetLinkRate(getLink, landings, visits),
    feed: feed.slice(0, OWNER_FUNNEL_FEED_LIMIT),
  };
}

export function parseOwnerFunnelDeskCounts(raw: unknown): {
  visits: number;
  junkVisits: number;
  friendLandings: number;
  landings: number;
  getLink: number;
  share: number;
  locked: number;
  windowDays: number;
} | null {
  if (raw == null) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  const num = (...keys: string[]): number | null => {
    for (const key of keys) {
      const value = o[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
      if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
        const parsed = Number(value);
        if (parsed >= 0) return parsed;
      }
    }
    return null;
  };
  const friendLandings = num('friend_landings', 'friendLandings') ?? num('landings');
  const landings = friendLandings;
  const visits = num('visits') ?? 0;
  const junkVisits = num('junk_visits', 'junkVisits') ?? 0;
  const getLink = num('get_link', 'getLink');
  const share = num('share');
  const locked = num('locked');
  const windowDays = num('window_days', 'windowDays') ?? OWNER_FUNNEL_WINDOW_DAYS;
  if (landings == null || getLink == null || share == null || locked == null) return null;
  return { visits, junkVisits, friendLandings: landings, landings, getLink, share, locked, windowDays };
}

/** Tile counts come from the RPC when present. A paged dump is feed-only. */
export function assembleOwnerFunnelDeskFromServer(input: {
  counts: unknown;
  events?: readonly OwnerFunnelEvent[];
  shares?: readonly OwnerFunnelShareRow[];
  referrals?: readonly OwnerFunnelReferralRow[];
  referrerLinks?: readonly OwnerFunnelLinkRow[];
  now?: number;
}): OwnerFunnelDeskMetrics | null {
  const counts = parseOwnerFunnelDeskCounts(input.counts);
  if (!counts) return null;
  const feedOnly = computeOwnerFunnelDeskMetrics({
    events: input.events,
    shares: input.shares,
    referrals: input.referrals,
    referrerLinks: input.referrerLinks,
    now: input.now,
    windowDays: counts.windowDays,
  });
  return {
    windowDays: counts.windowDays,
    visits: counts.visits,
    junkVisits: counts.junkVisits,
    friendLandings: counts.friendLandings,
    landings: counts.landings,
    getLink: counts.getLink,
    share: counts.share,
    locked: counts.locked,
    getLinkRate: deskGetLinkRate(counts.getLink, counts.friendLandings, counts.visits),
    feed: feedOnly.feed,
  };
}


export const OWNER_FUNNEL_PAGE_SIZE = 1000;

/** Command tiles are all zero — RPC timeout, miss, or a false empty payload. */
export function isEmptyOwnerFunnelDeskCounts(
  counts: ReturnType<typeof parseOwnerFunnelDeskCounts>,
): boolean {
  if (!counts) return true;
  return (
    counts.visits === 0 &&
    counts.friendLandings === 0 &&
    counts.getLink === 0 &&
    counts.share === 0 &&
    counts.locked === 0
  );
}

export function ownerFunnelWindowHasRows(window: {
  events?: readonly unknown[];
  shares?: readonly unknown[];
  referrals?: readonly unknown[];
  referrerLinks?: readonly unknown[];
}): boolean {
  return Boolean(
    (window.events && window.events.length) ||
      (window.shares && window.shares.length) ||
      (window.referrals && window.referrals.length) ||
      (window.referrerLinks && window.referrerLinks.length),
  );
}

export function isOwnerFunnelRpcMissingError(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if (code === 'PGRST202' || code === 'PGRST204' || code === '42883') return true;
  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('could not find the function') ||
    msg.includes('schema cache')
  );
}

/** Page until exhausted. A full first page is not treated as the whole window. */
export async function pageAllOwnerFunnelRows(
  fetchPage: (
    offset: number,
    limit: number,
  ) => Promise<{ data: unknown[] | null; error?: { message?: string } | null }>,
  pageSize = OWNER_FUNNEL_PAGE_SIZE,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await fetchPage(offset, pageSize);
    if (error) {
      throw new Error(error.message || 'owner funnel page failed');
    }
    const batch = (data || []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

/**
 * RPC COUNT DISTINCT when the function exists. Otherwise DISTINCT over a
 * complete 7-day service-role window (not last-1000, not a truncated dump).
 */
export type OwnerFunnelDeskWindow = {
  events?: readonly OwnerFunnelEvent[];
  shares?: readonly OwnerFunnelShareRow[];
  referrals?: readonly OwnerFunnelReferralRow[];
  referrerLinks?: readonly OwnerFunnelLinkRow[];
  visits?: number;
  junkVisits?: number;
};

export async function resolveOwnerFunnelDeskMetrics(input: {
  rpcData?: unknown;
  rpcError?: { message?: string; code?: string } | null;
  loadCompleteWindow: () => Promise<OwnerFunnelDeskWindow>;
  loadFeedWindow?: () => Promise<OwnerFunnelDeskWindow>;
  now?: number;
}): Promise<OwnerFunnelDeskMetrics> {
  const counts = parseOwnerFunnelDeskCounts(input.rpcData);
  const rpcUsable = !!counts && !isEmptyOwnerFunnelDeskCounts(counts);
  if (rpcUsable && counts) {
    try {
      const feed = input.loadFeedWindow ? await input.loadFeedWindow() : {};
      const assembled = assembleOwnerFunnelDeskFromServer({
        counts: input.rpcData,
        events: feed.events,
        shares: feed.shares,
        referrals: feed.referrals,
        referrerLinks: feed.referrerLinks,
        now: input.now,
      });
      if (assembled) return assembled;
    } catch {
      return {
        windowDays: counts.windowDays,
        visits: counts.visits,
        junkVisits: counts.junkVisits,
        friendLandings: counts.friendLandings,
        landings: counts.landings,
        getLink: counts.getLink,
        share: counts.share,
        locked: counts.locked,
        getLinkRate: deskGetLinkRate(counts.getLink, counts.friendLandings, counts.visits),
        feed: [],
      };
    }
  }
  const window = await input.loadCompleteWindow();
  return computeOwnerFunnelDeskMetrics({
    events: window.events,
    shares: window.shares,
    referrals: window.referrals,
    referrerLinks: window.referrerLinks,
    visits: window.visits,
    junkVisits: window.junkVisits ?? counts?.junkVisits,
    now: input.now,
    windowDays: OWNER_FUNNEL_WINDOW_DAYS,
  });
}

export function stripOwnerFunnelPii(row: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...row };
  delete copy.referred_ip;
  delete copy.ip_address;
  delete copy.client_ip;
  delete copy.user_agent;
  if (copy.metadata && typeof copy.metadata === 'object' && !Array.isArray(copy.metadata)) {
    const meta = { ...(copy.metadata as Record<string, unknown>) };
    delete meta.client_ip;
    delete meta.user_agent;
    copy.metadata = meta;
  }
  return copy;
}


