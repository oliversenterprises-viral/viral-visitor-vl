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

export type SiteDropsState = {
  drops: SiteDrop[];
  pending_entered: PendingEntered[];
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
  return { drops: [], pending_entered: [] };
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

  return { drops, pending_entered };
}

/** Expire live drops and drop stale pending. Never promote expired pending into drops. */
export function expireSiteDrops(state: SiteDropsState, now: Date = new Date()): SiteDropsState {
  const week = utcWeekId(now);
  return {
    drops: state.drops.filter(
      (drop) =>
        !isExpiredDrop(drop, now) && !(drop.kind === 'challenger' && drop.week !== week),
    ),
    pending_entered: state.pending_entered.filter((row) => !isStalePending(row, now)),
  };
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
  return {
    drops: without,
    pending_entered: state.pending_entered.filter((row) => row.code !== drop.code),
  };
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
  const updated = upsertDrop(next, {
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
  return {
    drops: [...updated.drops.filter((d) => d.kind !== 'entered'), ...entered],
    pending_entered: updated.pending_entered,
  };
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
  const updated = upsertDrop(next, {
    kind: 'rising',
    code,
    url,
    label: labelFromUrl(input.label, url),
    locks: input.locks,
    rank: null,
    week: utcWeekId(now),
    expires_at: new Date(now.getTime() + RISING_TTL_MS).toISOString(),
    updated_at: now.toISOString(),
  });
  const rising = updated.drops
    .filter((d) => d.kind === 'rising')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, MAX_LIVE_RISING);
  return {
    drops: [...updated.drops.filter((d) => d.kind !== 'rising'), ...rising],
    pending_entered: updated.pending_entered,
  };
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
  const week = utcWeekId(now);
  const withoutRank = next.drops.filter(
    (d) => !(d.kind === 'challenger' && d.week === week && d.rank === rank),
  );
  return upsertDrop(
    { drops: withoutRank, pending_entered: next.pending_entered },
    {
      kind: 'challenger',
      code,
      url,
      label: labelFromUrl(input.label, url),
      locks: Math.max(0, Math.floor(Number(input.locks) || 0)),
      rank,
      week,
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now.toISOString(),
    },
  );
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
