/**
 * Owner funnel desk — server-side loop metrics.
 * Unique people, not event spam. Copy is not a share. Claims are not conversion.
 */

import { isTestReferralRecord, isTestReferrerCode } from './test-referral.ts';
import { filterTestVisitorFunnelEvents } from './visitor-funnel-test.ts';
import { eventAffiliateCode, parseAffiliatesProgram } from './affiliate.ts';

export const OWNER_FUNNEL_LOCK_MS = 48 * 60 * 60 * 1000;

export type OwnerFunnelEvent = Record<string, unknown>;
export type OwnerFunnelShareRow = Record<string, unknown>;
export type OwnerFunnelReferralRow = Record<string, unknown>;
export type OwnerFunnelClaimRow = Record<string, unknown>;
export type OwnerFunnelLinkRow = Record<string, unknown>;
export type OwnerFunnelBannerEvent = Record<string, unknown>;

export type DeskBanner = {
  imageUrl: string;
  redirectUrl: string;
  label?: string;
  enabled?: boolean;
  weight?: number;
  [key: string]: unknown;
};

export type OwnerFunnelBannerCtr = {
  label: string;
  impressions: number;
  clicks: number;
  ctr: string;
};

export type OwnerFunnelDeskMetrics = {
  landings: number;
  getLink: number;
  getLinkRate: string;
  share: number;
  shareRate: string;
  lock: number;
  lockRate: string;
  diedWaiting: number;
  promoterLinks: number;
  creditedGetLinks: number;
  pendingClaims: number;
  liveBanner: boolean;
  liveBannerLabel: string;
  heroGetLinkRate: string;
  heroLockRate: string;
  bannerCtr: OwnerFunnelBannerCtr | null;
  staleJuneBanners: DeskBanner[];
};

function eventName(event: OwnerFunnelEvent): string {
  return String(event.event_name || event.eventName || '').trim();
}

function visitorKey(event: OwnerFunnelEvent): string {
  return (
    String(event.visitor_id || event.visitorId || '').trim() ||
    String(event.ip_hash || event.ipHash || '').trim()
  );
}

function createdMs(row: Record<string, unknown>): number {
  const raw = row.created_at || row.createdAt || row.timestamp;
  const t = raw ? Date.parse(String(raw)) : NaN;
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

function sharePlatform(row: Record<string, unknown>): string {
  const meta = metadataRecord(row);
  return String(meta.platform || row.platform || '').trim().toLowerCase();
}

function isCopyShare(row: Record<string, unknown>): boolean {
  return sharePlatform(row) === 'copy';
}

function eventCode(event: OwnerFunnelEvent): string {
  const meta = metadataRecord(event);
  return String(meta.referrer_code || meta.code || event.ref_code || event.refCode || '')
    .trim()
    .toUpperCase();
}

export function formatOwnerRate(num: number, den: number): string {
  if (!den || den <= 0) return '—';
  return `${((num / den) * 100).toFixed(1)}%`;
}

export function uniqueVisitorsForEvent(
  events: readonly OwnerFunnelEvent[],
  name: string,
  extra?: (event: OwnerFunnelEvent) => boolean,
): number {
  const ids = new Set<string>();
  for (const event of events) {
    if (eventName(event) !== name) continue;
    if (extra && !extra(event)) continue;
    const id = visitorKey(event);
    if (id) ids.add(id);
  }
  return ids.size;
}

export function filterOwnerFunnelEvents(
  events: readonly OwnerFunnelEvent[],
): OwnerFunnelEvent[] {
  return filterTestVisitorFunnelEvents(events);
}

export function parseDeskBanners(raw: unknown): DeskBanner[] {
  let value = raw;
  if (typeof value === 'string' && value.trim()) {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: DeskBanner[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const imageUrl = String(rec.imageUrl || rec.image_url || '').trim();
    const redirectUrl = String(rec.redirectUrl || rec.redirect_url || '').trim();
    out.push({
      ...rec,
      imageUrl,
      redirectUrl,
      label: rec.label != null ? String(rec.label).trim() : undefined,
      enabled: rec.enabled !== false,
      weight: typeof rec.weight === 'number' && rec.weight > 0 ? Math.floor(rec.weight) : 1,
    });
  }
  return out;
}

export function liveHomepageBanners(banners: readonly DeskBanner[]): DeskBanner[] {
  return banners.filter(
    (banner) =>
      banner.enabled !== false && banner.imageUrl.length > 0 && banner.redirectUrl.length > 0,
  );
}

export function isStaleJuneHomepageBanner(banner: DeskBanner): boolean {
  if (banner.enabled === false) return false;
  const blob = `${banner.label || ''} ${banner.redirectUrl || ''} ${banner.imageUrl || ''}`.toLowerCase();
  return /\bjune\b/.test(blob);
}

export function closeStaleJuneHomepageBanners(banners: readonly DeskBanner[]): {
  banners: DeskBanner[];
  closed: DeskBanner[];
} {
  const closed: DeskBanner[] = [];
  const next = banners.map((banner) => {
    if (!isStaleJuneHomepageBanner(banner)) return { ...banner };
    closed.push(banner);
    return { ...banner, enabled: false };
  });
  return { banners: next, closed };
}

export function computeDiedWaiting(input: {
  getLinkEvents: readonly OwnerFunnelEvent[];
  referrals: readonly OwnerFunnelReferralRow[];
  referrerLinks: readonly OwnerFunnelLinkRow[];
  now?: number;
}): number {
  const now = input.now ?? Date.now();
  const lockCodes = new Set<string>();
  for (const row of input.referrals) {
    const code = String(row.referrer_code || '').trim().toUpperCase();
    if (code) lockCodes.add(code);
  }

  const links = input.referrerLinks.filter((row) => {
    const code = String(row.referrer_code || '').trim();
    return !isTestReferrerCode(code);
  });

  if (links.length) {
    return links.filter((row) => {
      const status = String(row.status || '').toLowerCase();
      if (status === 'active') return false;
      if (status === 'expired') return true;
      const created = createdMs(row);
      return created > 0 && created + OWNER_FUNNEL_LOCK_MS <= now;
    }).length;
  }

  const agedKeys = new Set<string>();
  let lockedAged = 0;
  for (const event of input.getLinkEvents) {
    if (eventName(event) !== 'GetReferralLink') continue;
    const created = createdMs(event);
    if (!created || created + OWNER_FUNNEL_LOCK_MS > now) continue;
    const key = visitorKey(event);
    if (!key || agedKeys.has(key)) continue;
    agedKeys.add(key);
    const code = eventCode(event);
    if (code && lockCodes.has(code)) lockedAged += 1;
  }
  return Math.max(0, agedKeys.size - lockedAged);
}

function computeLiveBannerCtr(
  live: readonly DeskBanner[],
  bannerEvents: readonly OwnerFunnelBannerEvent[] | undefined,
): OwnerFunnelBannerCtr | null {
  if (!live.length || !bannerEvents?.length) return null;
  const liveKeys = new Set<string>();
  for (const banner of live) {
    const label = (banner.label || '').trim();
    const url = banner.redirectUrl;
    if (label && url) liveKeys.add(`${label}|${url}`);
    if (label) liveKeys.add(label);
    if (url) liveKeys.add(url);
  }
  let impressions = 0;
  let clicks = 0;
  for (const row of bannerEvents) {
    const label = String(row.label || row.banner_label || '').trim();
    const url = String(row.redirect_url || row.redirectUrl || '').trim();
    const key =
      String(row.key || '').trim() || (label && url ? `${label}|${url}` : url || label);
    if (liveKeys.size && !liveKeys.has(key) && !liveKeys.has(label) && !liveKeys.has(url)) {
      continue;
    }
    const type = String(row.type || row.event_type || '').toLowerCase();
    if (type === 'impression') impressions += 1;
    else if (type === 'click') clicks += 1;
  }
  return {
    label: live[0]?.label || 'Homepage banner',
    impressions,
    clicks,
    ctr: formatOwnerRate(clicks, impressions),
  };
}

export function computeOwnerFunnelDeskMetrics(input: {
  events?: readonly OwnerFunnelEvent[];
  shares?: readonly OwnerFunnelShareRow[];
  referrals?: readonly OwnerFunnelReferralRow[];
  claims?: readonly OwnerFunnelClaimRow[];
  referrerLinks?: readonly OwnerFunnelLinkRow[];
  banners?: unknown;
  affiliates?: unknown;
  bannerEvents?: readonly OwnerFunnelBannerEvent[];
  now?: number;
}): OwnerFunnelDeskMetrics {
  const events = filterOwnerFunnelEvents(input.events || []);
  const referrals = (input.referrals || []).filter((row) => !isTestReferralRecord(row));
  const shares = (input.shares || []).filter((row) => {
    if (isCopyShare(row)) return false;
    const code = String(row.referrer_code || row.referrerCode || '').trim();
    return !isTestReferrerCode(code);
  });
  const claims = input.claims || [];
  const banners = parseDeskBanners(input.banners);
  const staleJuneBanners = banners.filter(isStaleJuneHomepageBanner);
  const afterClose = closeStaleJuneHomepageBanners(banners).banners;
  const live = liveHomepageBanners(afterClose);
  const program = parseAffiliatesProgram(input.affiliates);

  const landings = uniqueVisitorsForEvent(events, 'SiteLanding');
  const getLink = uniqueVisitorsForEvent(events, 'GetReferralLink');
  const shareFromEvents = uniqueVisitorsForEvent(events, 'ShareReferral', (event) => !isCopyShare(event));
  const share = shareFromEvents > 0 ? shareFromEvents : shares.length;
  const lock = referrals.length;
  const diedWaiting = computeDiedWaiting({
    getLinkEvents: events.filter((event) => eventName(event) === 'GetReferralLink'),
    referrals,
    referrerLinks: input.referrerLinks || [],
    now: input.now,
  });

  const promoterCodes = new Set(program.affiliates.map((row) => row.code));
  const creditedIds = new Set<string>();
  for (const event of events) {
    if (eventName(event) !== 'GetReferralLink') continue;
    const aff = eventAffiliateCode(event);
    if (!aff || !promoterCodes.has(aff)) continue;
    const id = visitorKey(event);
    if (id) creditedIds.add(id);
  }

  const pendingClaims = claims.filter(
    (row) => String(row.status || 'pending').toLowerCase() === 'pending',
  ).length;
  const liveBanner = live.length > 0;
  const liveBannerLabel = live[0]?.label || (liveBanner ? 'Homepage banner' : '');

  return {
    landings,
    getLink,
    getLinkRate: formatOwnerRate(getLink, landings),
    share,
    shareRate: formatOwnerRate(share, getLink),
    lock,
    lockRate: formatOwnerRate(lock, getLink),
    diedWaiting,
    promoterLinks: program.affiliates.length,
    creditedGetLinks: creditedIds.size,
    pendingClaims,
    liveBanner,
    liveBannerLabel,
    heroGetLinkRate: formatOwnerRate(getLink, landings),
    heroLockRate: formatOwnerRate(lock, getLink),
    bannerCtr: liveBanner ? computeLiveBannerCtr(live, input.bannerEvents) : null,
    staleJuneBanners,
  };
}

export function parseOwnerFunnelDeskCounts(raw: unknown): {
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
  const landings = num('landings');
  const getLink = num('get_link', 'getLink');
  const share = num('share');
  const locked = num('locked');
  const windowDays = num('window_days', 'windowDays') ?? OWNER_FUNNEL_WINDOW_DAYS;
  if (landings == null || getLink == null || share == null || locked == null) return null;
  return { landings, getLink, share, locked, windowDays };
}

/** Tile counts come from the RPC only. The event page is feed-only. */
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
    landings: counts.landings,
    getLink: counts.getLink,
    share: counts.share,
    locked: counts.locked,
    getLinkRate: formatOwnerRate(counts.getLink, counts.landings),
    feed: feedOnly.feed,
  };
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
