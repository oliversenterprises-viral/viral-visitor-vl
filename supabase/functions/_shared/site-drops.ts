/**
 * Site Drop ladder — pending_entered → live drops.
 * Just entered = 15 minutes. Rising = 1 hour. Do not dump expired pending as live.
 */

import { isTestReferrerCode } from './test-referral.ts';
import { normalizeReferrerCode } from './referrer-code.ts';
import { isSafeHttpUrl } from './claim-leader.ts';

export const SITE_DROPS_KEY = 'site_drops';
export const ENTERED_TTL_MS = 15 * 60 * 1000;
export const RISING_TTL_MS = 60 * 60 * 1000;
export const MAX_LIVE_ENTERED = 8;
export const MAX_LIVE_RISING = 3;
export const MAX_PENDING = 24;
export const SITE_DROP_RISING_MIN_LOCKS = 1;
export const CHALLENGER_RANKS = [2, 3] as const;
/** Remembered websites survive the 15-minute Just entered TTL so a later friend credit can still climb. */
export const MAX_REMEMBERED_SITES = 400;

export type SiteDropKind = 'entered' | 'rising' | 'challenger';

export type PendingEntered = {
  code: string;
  earned_at: string;
};

export type SiteDrop = {
  kind: SiteDropKind;
  code: string;
  url: string;
  label: string;
  locks: number;
  rank: number | null;
  week: string;
  expires_at: string;
  updated_at: string;
  hidden?: boolean;
};

export type RememberedSite = {
  code: string;
  url: string;
  label: string;
  updated_at: string;
};

export type SiteDropsState = {
  drops: SiteDrop[];
  pending_entered: PendingEntered[];
  /** Per-code website. Not shown on the homepage. Survives live-drop expiry. */
  sites?: RememberedSite[];
};

export function utcWeekId(now: Date = new Date()): string {
  const day = now.getUTCDay();
  const add = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add));
  return monday.toISOString().slice(0, 10);
}

export function hostnameFromSafeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

export function normalizeWebsiteUrl(raw: unknown): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isSafeHttpUrl(withProto)) return null;
  try {
    return new URL(withProto).toString();
  } catch {
    return null;
  }
}

export function labelFromUrl(label: unknown, url: string): string {
  const raw = String(label || '').trim();
  if (raw) return raw.slice(0, 48);
  return hostnameFromSafeUrl(url) || 'Site';
}

export function isExpiredDrop(drop: SiteDrop, now: Date = new Date()): boolean {
  const ms = Date.parse(drop.expires_at);
  if (!Number.isFinite(ms)) return true;
  return ms <= now.getTime();
}

export function isStalePending(row: PendingEntered, now: Date = new Date()): boolean {
  const ms = Date.parse(row.earned_at);
  if (!Number.isFinite(ms)) return true;
  return now.getTime() - ms > ENTERED_TTL_MS;
}

function emptyState(): SiteDropsState {
  return { drops: [], pending_entered: [], sites: [] };
}

function sitesOf(state: SiteDropsState): RememberedSite[] {
  return Array.isArray(state.sites) ? state.sites : [];
}

function withSites(drops: SiteDrop[], pending_entered: PendingEntered[], sites: RememberedSite[]): SiteDropsState {
  return { drops, pending_entered, sites };
}

function normalizeCode(raw: unknown): string | null {
  const code = normalizeReferrerCode(raw);
  if (!/^VIRAL-[A-Z0-9_-]+$/.test(code)) return null;
  return code;
}

export function parseSiteDrops(raw: unknown): SiteDropsState {
  let value = raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      value = JSON.parse(raw);
    } catch {
      return emptyState();
    }
  }

  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const dropRows = Array.isArray(value)
    ? value
    : Array.isArray(source.drops)
      ? source.drops
      : [];
  const pendingRows = Array.isArray(source.pending_entered) ? source.pending_entered : [];

  const pending_entered: PendingEntered[] = [];
  for (const row of pendingRows) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const code = normalizeCode(rec.code || rec.referrer_code);
    if (!code || isTestReferrerCode(code)) continue;
    pending_entered.push({
      code,
      earned_at: String(rec.earned_at || rec.earnedAt || new Date().toISOString()),
    });
  }

  const drops: SiteDrop[] = [];
  for (const row of dropRows) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const kind = String(rec.kind || '').toLowerCase();
    if (kind !== 'entered' && kind !== 'rising' && kind !== 'challenger') continue;
    const code = normalizeCode(rec.code || rec.referrer_code);
    const url = normalizeWebsiteUrl(rec.url || rec.website || rec.href);
    if (!code || isTestReferrerCode(code) || !url) continue;
    const expires_at = String(rec.expires_at || rec.expiresAt || '').trim();
    if (!expires_at) continue;
    const rankRaw = rec.rank;
    const rank =
      rankRaw == null || rankRaw === ''
        ? null
        : Math.max(0, Math.floor(Number(rankRaw) || 0)) || null;
    drops.push({
      kind,
      code,
      url,
      label: labelFromUrl(rec.label || rec.name, url),
      locks: Math.max(0, Math.floor(Number(rec.locks ?? rec.referral_count) || 0)),
      rank,
      week: String(rec.week || '').trim() || utcWeekId(),
      expires_at,
      updated_at: String(rec.updated_at || rec.updatedAt || new Date().toISOString()),
      hidden: rec.hidden === true,
    });
  }

  const sites: RememberedSite[] = [];
  const siteRows = Array.isArray(source.sites) ? source.sites : [];
  for (const row of siteRows) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const code = normalizeCode(rec.code || rec.referrer_code);
    const url = normalizeWebsiteUrl(rec.url || rec.website || rec.href);
    if (!code || isTestReferrerCode(code) || !url) continue;
    sites.push({
      code,
      url,
      label: labelFromUrl(rec.label || rec.name, url),
      updated_at: String(rec.updated_at || rec.updatedAt || new Date().toISOString()),
    });
  }

  return { drops, pending_entered, sites };
}

export function rememberDropSite(
  state: SiteDropsState,
  input: { code: string; url: string; label?: string },
  now: Date = new Date(),
): SiteDropsState {
  const code = normalizeCode(input.code);
  const url = normalizeWebsiteUrl(input.url);
  if (!code || !url || isTestReferrerCode(code)) return state;
  const row: RememberedSite = {
    code,
    url,
    label: labelFromUrl(input.label, url),
    updated_at: now.toISOString(),
  };
  const rest = sitesOf(state).filter((site) => site.code !== code);
  rest.push(row);
  rest.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return withSites(state.drops, state.pending_entered, rest.slice(0, MAX_REMEMBERED_SITES));
}

export function siteForCode(state: SiteDropsState, codeRaw: string): RememberedSite | null {
  const code = normalizeCode(codeRaw);
  if (!code) return null;
  const remembered = sitesOf(state).find((site) => site.code === code);
  if (remembered) return remembered;
  const live = [...state.drops]
    .filter((drop) => drop.code === code && drop.url)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  if (!live) return null;
  return {
    code: live.code,
    url: live.url,
    label: live.label,
    updated_at: live.updated_at,
  };
}

/** Expire live drops and drop stale pending. Remembered websites stay. */
export function expireSiteDrops(state: SiteDropsState, now: Date = new Date()): SiteDropsState {
  const week = utcWeekId(now);
  return withSites(
    state.drops.filter(
      (drop) =>
        !isExpiredDrop(drop, now) && !(drop.kind === 'challenger' && drop.week !== week),
    ),
    state.pending_entered.filter((row) => !isStalePending(row, now)),
    sitesOf(state),
  );
}

export function enqueuePendingEntered(
  state: SiteDropsState,
  codeRaw: string,
  now: Date = new Date(),
): SiteDropsState {
  const next = expireSiteDrops(state, now);
  const code = normalizeCode(codeRaw);
  if (!code || isTestReferrerCode(code)) return next;
  if (next.pending_entered.some((row) => row.code === code)) return next;
  if (next.drops.some((drop) => drop.code === code && !isExpiredDrop(drop, now))) return next;
  next.pending_entered.push({ code, earned_at: now.toISOString() });
  if (next.pending_entered.length > MAX_PENDING) {
    next.pending_entered = next.pending_entered.slice(-MAX_PENDING);
  }
  return next;
}

function upsertDrop(state: SiteDropsState, drop: SiteDrop): SiteDropsState {
  const without = state.drops.filter((row) => !(row.kind === drop.kind && row.code === drop.code));
  without.push(drop);
  return withSites(
    without,
    state.pending_entered.filter((row) => row.code !== drop.code),
    sitesOf(state),
  );
}

function removeKindForCode(state: SiteDropsState, code: string, kind: SiteDropKind): SiteDropsState {
  return withSites(
    state.drops.filter((row) => !(row.code === code && row.kind === kind)),
    state.pending_entered,
    sitesOf(state),
  );
}

export function promoteEnteredDrop(
  state: SiteDropsState,
  input: { code: string; url: string; label?: string },
  now: Date = new Date(),
): SiteDropsState {
  const next = expireSiteDrops(state, now);
  const code = normalizeCode(input.code);
  const url = normalizeWebsiteUrl(input.url);
  if (!code || !url || isTestReferrerCode(code)) return next;
  const remembered = rememberDropSite(next, { code, url, label: input.label }, now);
  const updated = upsertDrop(remembered, {
    kind: 'entered',
    code,
    url,
    label: labelFromUrl(input.label, url),
    locks: 0,
    rank: null,
    week: utcWeekId(now),
    expires_at: new Date(now.getTime() + ENTERED_TTL_MS).toISOString(),
    updated_at: now.toISOString(),
  });
  const entered = updated.drops
    .filter((d) => d.kind === 'entered')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, MAX_LIVE_ENTERED);
  return withSites(
    [...updated.drops.filter((d) => d.kind !== 'entered'), ...entered],
    updated.pending_entered,
    sitesOf(updated),
  );
}

export function promoteRisingDrop(
  state: SiteDropsState,
  input: { code: string; url: string; label?: string; locks: number },
  now: Date = new Date(),
): SiteDropsState {
  const next = expireSiteDrops(state, now);
  const code = normalizeCode(input.code);
  const url = normalizeWebsiteUrl(input.url);
  if (!code || !url || isTestReferrerCode(code)) return next;
  if (input.locks < SITE_DROP_RISING_MIN_LOCKS) return next;
  const remembered = rememberDropSite(next, { code, url, label: input.label }, now);
  const existing = remembered.drops.find(
    (drop) => drop.kind === 'rising' && drop.code === code && !isExpiredDrop(drop, now),
  );
  const expires_at =
    existing && input.locks <= existing.locks
      ? existing.expires_at
      : new Date(now.getTime() + RISING_TTL_MS).toISOString();
  const updated = upsertDrop(remembered, {
    kind: 'rising',
    code,
    url,
    label: labelFromUrl(input.label, url),
    locks: input.locks,
    rank: null,
    week: utcWeekId(now),
    expires_at,
    updated_at: now.toISOString(),
  });
  const rising = updated.drops
    .filter((d) => d.kind === 'rising')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, MAX_LIVE_RISING);
  return withSites(
    [...updated.drops.filter((d) => d.kind !== 'rising'), ...rising],
    updated.pending_entered,
    sitesOf(updated),
  );
}

export function promoteChallengerDrop(
  state: SiteDropsState,
  input: { code: string; url: string; label?: string; rank: number; locks?: number },
  now: Date = new Date(),
): SiteDropsState {
  const next = expireSiteDrops(state, now);
  const code = normalizeCode(input.code);
  const url = normalizeWebsiteUrl(input.url);
  const rank = Math.floor(Number(input.rank) || 0);
  if (!code || !url || isTestReferrerCode(code)) return next;
  if (!CHALLENGER_RANKS.includes(rank as 2 | 3)) return next;
  const remembered = rememberDropSite(next, { code, url, label: input.label }, now);
  const week = utcWeekId(now);
  const existing = remembered.drops.find(
    (d) => d.kind === 'challenger' && d.code === code && d.week === week && d.rank === rank,
  );
  const withoutRank = remembered.drops.filter(
    (d) => !(d.kind === 'challenger' && d.week === week && d.rank === rank),
  );
  return upsertDrop(
    withSites(withoutRank, remembered.pending_entered, sitesOf(remembered)),
    {
      kind: 'challenger',
      code,
      url,
      label: labelFromUrl(input.label, url),
      locks: Math.max(0, Math.floor(Number(input.locks) || 0)),
      rank,
      week,
      expires_at: existing?.expires_at || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now.toISOString(),
    },
  );
}

/**
 * Paste or friend-credit climb: 0 friends → Just entered, 1+ → Rising,
 * board #2/#3 → Challenger. Needs a remembered URL. No URL = no chip.
 */
export function applySiteDropClimb(
  state: SiteDropsState,
  input: { code: string; url: string; label?: string; locks: number; rank?: number | null },
  now: Date = new Date(),
): SiteDropsState {
  const code = normalizeCode(input.code);
  const url = normalizeWebsiteUrl(input.url);
  if (!code || !url || isTestReferrerCode(code)) return expireSiteDrops(state, now);

  const locks = Math.max(0, Math.floor(Number(input.locks) || 0));
  const rank = Math.floor(Number(input.rank) || 0);
  let next = rememberDropSite(state, { code, url, label: input.label }, now);

  if (locks >= SITE_DROP_RISING_MIN_LOCKS) {
    next = promoteRisingDrop(next, { code, url, label: input.label, locks }, now);
    next = removeKindForCode(next, code, 'entered');
  } else {
    next = promoteEnteredDrop(next, { code, url, label: input.label }, now);
  }

  if (CHALLENGER_RANKS.includes(rank as 2 | 3)) {
    next = promoteChallengerDrop(next, { code, url, label: input.label, rank, locks }, now);
  }
  return next;
}

export function publicEnteredDrops(state: SiteDropsState, now: Date = new Date()): SiteDrop[] {
  return expireSiteDrops(state, now)
    .drops.filter((d) => d.kind === 'entered' && !d.hidden)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, MAX_LIVE_ENTERED);
}

export function publicRisingDrops(state: SiteDropsState, now: Date = new Date()): SiteDrop[] {
  return expireSiteDrops(state, now)
    .drops.filter((d) => d.kind === 'rising' && !d.hidden && d.locks >= SITE_DROP_RISING_MIN_LOCKS)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, MAX_LIVE_RISING);
}

export function publicChallengerDrops(state: SiteDropsState, now: Date = new Date()): SiteDrop[] {
  const week = utcWeekId(now);
  const rows = expireSiteDrops(state, now)
    .drops.filter(
      (d) =>
        d.kind === 'challenger' &&
        !d.hidden &&
        d.week === week &&
        d.rank != null &&
        CHALLENGER_RANKS.includes(d.rank as 2 | 3),
    )
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.updated_at.localeCompare(a.updated_at));
  const byRank = new Map<number, SiteDrop>();
  for (const row of rows) {
    if (row.rank != null && !byRank.has(row.rank)) byRank.set(row.rank, row);
  }
  return CHALLENGER_RANKS.map((rank) => byRank.get(rank)).filter((row): row is SiteDrop => !!row);
}

/** Pending without a URL never become homepage chips. */
export function publicPendingEntered(_state: SiteDropsState, _now: Date = new Date()): PendingEntered[] {
  return [];
}
