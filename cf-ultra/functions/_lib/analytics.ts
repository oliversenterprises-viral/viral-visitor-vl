import {
  addCount,
  applyEvent,
  emptyBucket,
  eventText,
  hourId,
  mergeBuckets,
  type AdminEvent,
  type HourBucket,
  type RungMark,
  type TrackKind,
  type VisitorHints,
} from './stats';
import { alertOrigin, emitDigest, funnelDigestLine, rememberAlertOrigin } from './alerts';
import { normalizeIp, shouldSkipStats, statsIp } from './exclude';
import { kvBound, type UltraEnv } from './store';

const FLUSH_MS = 15_000;
const FLUSH_PAGEVIEWS = 20;
const LIVE_MS = 120_000;
const MAX_LIVE = 400;
const MAX_FEED = 50;
const MAX_RUNGS = 50;
const UNIQUE_CAP = 4_000;

type Buf = {
  hour: string;
  bucket: HourBucket;
  actors: Set<string>;
  sessions: Set<string>;
  live: Map<string, number>;
  feed: AdminEvent[];
  rungs: RungMark[];
  pageviewsSinceFlush: number;
  lastFlush: number;
  dirty: boolean;
};

const g = globalThis as typeof globalThis & { __ULTRA_ANALYTICS__?: Buf };

function buf(): Buf {
  if (!g.__ULTRA_ANALYTICS__) {
    const hour = hourId();
    g.__ULTRA_ANALYTICS__ = {
      hour,
      bucket: emptyBucket(hour),
      actors: new Set(),
      sessions: new Set(),
      live: new Map(),
      feed: [],
      rungs: [],
      pageviewsSinceFlush: 0,
      lastFlush: Date.now(),
      dirty: false,
    };
  }
  return g.__ULTRA_ANALYTICS__!;
}

function rollHour(now: number): void {
  const b = buf();
  const h = hourId(now);
  if (b.hour !== h) {
    b.hour = h;
    b.bucket = emptyBucket(h);
    b.actors.clear();
    b.sessions.clear();
    b.pageviewsSinceFlush = 0;
  }
}

export function liveVisitors(now = Date.now()): number {
  const b = buf();
  let n = 0;
  for (const [, seen] of b.live) if (now - seen < LIVE_MS) n += 1;
  return n;
}

export function recentFeed(): AdminEvent[] {
  return buf().feed.slice(0, MAX_FEED);
}

export function recentRungs(): RungMark[] {
  return buf().rungs.slice(0, MAX_RUNGS);
}

export function isolateBucket(): HourBucket {
  const b = buf();
  const copy = mergeBuckets(b.bucket);
  copy.uniques = Math.max(copy.uniques, b.actors.size);
  copy.sessions = Math.max(copy.sessions, b.sessions.size);
  return copy;
}

const CONVERSION: TrackKind[] = [
  'join',
  'credit',
  'share',
  'friend_land',
  'paste',
  'blocked',
  'self_ref',
  'te_ignored',
  'te_splash_cta',
];

export async function recordAnalytics(
  env: UltraEnv,
  input: {
    kind: TrackKind;
    actorId?: string;
    sessionId?: string;
    hints: VisitorHints;
    text?: string;
    flushNow?: boolean;
    rung?: RungMark;
    origin?: string;
    request?: Request;
    ip?: string;
  },
): Promise<{ skipped: boolean; reason?: string }> {
  if (input.request) {
    const gate = await shouldSkipStats(env, input.request);
    if (gate.skip) return { skipped: true, reason: gate.reason };
  }
  if (input.origin) rememberAlertOrigin(input.origin);
  const now = Date.now();
  rollHour(now);
  const b = buf();
  applyEvent(b.bucket, input.kind, input.hints);
  const ip = input.ip || (input.request ? statsIp(input.request) : undefined);
  if (input.actorId) {
    if (b.actors.size < UNIQUE_CAP) b.actors.add(input.actorId);
    b.live.set(input.actorId, now);
    if (b.live.size > MAX_LIVE) {
      for (const [id, seen] of b.live) {
        if (now - seen > LIVE_MS) b.live.delete(id);
      }
    }
  }
  if (input.sessionId && b.sessions.size < UNIQUE_CAP) b.sessions.add(input.sessionId);
  b.bucket.uniques = Math.max(b.bucket.uniques, b.actors.size);
  b.bucket.sessions = Math.max(b.bucket.sessions, b.sessions.size);
  b.dirty = true;
  if (input.kind !== 'pageview') {
    b.feed = [
      {
        id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        at: now,
        kind: input.kind,
        text: input.text || eventText(input.kind),
        platform: input.hints.platform,
        country: input.hints.country,
        ip,
      },
      ...b.feed,
    ].slice(0, MAX_FEED);
  }
  if (input.rung) b.rungs = [input.rung, ...b.rungs].slice(0, MAX_RUNGS);
  if (input.kind === 'pageview') b.pageviewsSinceFlush += 1;

  const shouldFlush =
    input.flushNow ||
    CONVERSION.includes(input.kind) ||
    now - b.lastFlush > FLUSH_MS ||
    b.pageviewsSinceFlush >= FLUSH_PAGEVIEWS;
  if (shouldFlush) await flushAnalytics(env);
  return { skipped: false };
}

export async function flushAnalytics(env: UltraEnv): Promise<void> {
  const b = buf();
  if (!b.dirty) return;
  b.dirty = false;
  b.lastFlush = Date.now();
  b.pageviewsSinceFlush = 0;
  const hour = { ...b.bucket, uniques: Math.max(b.bucket.uniques, b.actors.size), sessions: Math.max(b.bucket.sessions, b.sessions.size) };
  const day = hour.hour.slice(0, 10);

  if (!kvBound(env)) return;
  try {
    const [hourPrev, dayPrev, allPrev, feedPrev, rungPrev] = await Promise.all([
      env.BOARD!.get(`stats:hour:${hour.hour}`, 'json') as Promise<HourBucket | null>,
      env.BOARD!.get(`stats:day:${day}`, 'json') as Promise<HourBucket | null>,
      env.BOARD!.get('stats:all', 'json') as Promise<HourBucket | null>,
      env.BOARD!.get('stats:feed', 'json') as Promise<AdminEvent[] | null>,
      env.BOARD!.get('stats:rungs', 'json') as Promise<RungMark[] | null>,
    ]);
    const mergedHour = hourPrev ? mergeBuckets(hourPrev, hour) : hour;
    const mergedDay = dayPrev ? mergeBuckets({ ...dayPrev, hour: day }, { ...hour, hour: day }) : { ...hour, hour: day };
    const mergedAll = allPrev ? mergeBuckets({ ...allPrev, hour: 'all' }, { ...hour, hour: 'all' }) : { ...hour, hour: 'all' };
    const feed = [...b.feed, ...(Array.isArray(feedPrev) ? feedPrev : [])].slice(0, MAX_FEED);
    const rungs = [...b.rungs, ...(Array.isArray(rungPrev) ? rungPrev : [])].slice(0, MAX_RUNGS);
    await Promise.all([
      env.BOARD!.put(`stats:hour:${hour.hour}`, JSON.stringify(mergedHour), { expirationTtl: 60 * 60 * 24 * 8 }),
      env.BOARD!.put(`stats:day:${day}`, JSON.stringify(mergedDay), { expirationTtl: 60 * 60 * 24 * 120 }),
      env.BOARD!.put('stats:all', JSON.stringify(mergedAll)),
      env.BOARD!.put('stats:feed', JSON.stringify(feed)),
      env.BOARD!.put('stats:rungs', JSON.stringify(rungs)),
    ]);
    b.feed = feed;
    b.rungs = rungs;
    b.bucket = emptyBucket(b.hour);
    b.actors.clear();
    b.sessions.clear();
    const origin = alertOrigin();
    void emitDigest(env, origin, 'hourly', mergedHour.hour, funnelDigestLine(mergedHour));
    void emitDigest(env, origin, 'daily', day, funnelDigestLine(mergedDay));
  } catch {
    b.dirty = true;
  }
}

export async function readDays(env: UltraEnv, days: string[]): Promise<HourBucket[]> {
  const iso = isolateBucket();
  if (!kvBound(env)) {
    return days.map((d) => (iso.hour.startsWith(d) ? { ...iso, hour: d } : emptyBucket(d)));
  }
  const rows = await Promise.all(days.map((d) => env.BOARD!.get(`stats:day:${d}`, 'json') as Promise<HourBucket | null>));
  return days.map((d, i) => {
    const stored = rows[i];
    const extra = iso.hour.startsWith(d) ? iso : null;
    if (stored && extra) return mergeBuckets({ ...stored, hour: d }, { ...extra, hour: d });
    if (stored) return { ...stored, hour: d };
    if (extra) return { ...extra, hour: d };
    return emptyBucket(d);
  });
}

export async function readAllTime(env: UltraEnv): Promise<HourBucket> {
  const iso = isolateBucket();
  if (!kvBound(env)) return { ...iso, hour: 'all' };
  try {
    const all = (await env.BOARD!.get('stats:all', 'json')) as HourBucket | null;
    return all ? mergeBuckets({ ...all, hour: 'all' }, { ...iso, hour: 'all' }) : { ...iso, hour: 'all' };
  } catch {
    return { ...iso, hour: 'all' };
  }
}

export async function readFeed(env: UltraEnv): Promise<AdminEvent[]> {
  const local = recentFeed();
  if (!kvBound(env) || local.length >= 8) return local;
  try {
    const stored = (await env.BOARD!.get('stats:feed', 'json')) as AdminEvent[] | null;
    return [...local, ...(stored || [])].slice(0, MAX_FEED);
  } catch {
    return local;
  }
}

export async function readRungs(env: UltraEnv): Promise<RungMark[]> {
  const local = recentRungs();
  if (!kvBound(env) || local.length >= 8) return local;
  try {
    const stored = (await env.BOARD!.get('stats:rungs', 'json')) as RungMark[] | null;
    return [...local, ...(stored || [])].slice(0, MAX_RUNGS);
  } catch {
    return local;
  }
}

/** Wipe isolate + every `stats:*` KV key. Does not touch the live referral board. */
export async function resetAnalytics(env: UltraEnv): Promise<{ deleted: number }> {
  g.__ULTRA_ANALYTICS__ = undefined;
  if (!kvBound(env)) return { deleted: 0 };
  let deleted = 0;
  try {
    let cursor: string | undefined;
    do {
      const page = await env.BOARD!.list({ prefix: 'stats:', limit: 1000, cursor });
      await Promise.all(page.keys.map((k) => env.BOARD!.delete(k.name)));
      deleted += page.keys.length;
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch {
    deleted += await deleteKnownStatsKeys(env);
  }
  return { deleted };
}

async function deleteKnownStatsKeys(env: UltraEnv): Promise<number> {
  const keys = ['stats:all', 'stats:feed', 'stats:rungs'];
  const now = Date.now();
  for (let i = 0; i < 120; i++) {
    keys.push(`stats:day:${new Date(now - i * 86_400_000).toISOString().slice(0, 10)}`);
  }
  for (let i = 0; i < 8 * 24; i++) {
    keys.push(`stats:hour:${new Date(now - i * 3_600_000).toISOString().slice(0, 13)}`);
  }
  await Promise.all(keys.map((k) => env.BOARD!.delete(k)));
  return keys.length;
}

/** Drop HQ feed rows recorded for an excluded IP. Rollup counters stay (sampled history). */
export async function purgeFeedByIp(env: UltraEnv, rawIp: string): Promise<number> {
  const want = normalizeIp(rawIp);
  if (!want) return 0;
  let n = 0;
  const b = g.__ULTRA_ANALYTICS__;
  if (b) {
    const before = b.feed.length;
    b.feed = b.feed.filter((e) => e.ip !== want);
    n += before - b.feed.length;
  }
  if (!kvBound(env)) return n;
  try {
    const stored = (await env.BOARD!.get('stats:feed', 'json')) as AdminEvent[] | null;
    if (!Array.isArray(stored)) return n;
    const next = stored.filter((e) => e.ip !== want);
    n += stored.length - next.length;
    if (next.length !== stored.length) await env.BOARD!.put('stats:feed', JSON.stringify(next));
  } catch {
    /* keep isolate-only purge */
  }
  return n;
}

export function samplePageview(actorId: string): boolean {
  let n = 0;
  for (let i = 0; i < actorId.length; i++) n = (n + actorId.charCodeAt(i)) % 5;
  return n === 0;
}

export { addCount };
