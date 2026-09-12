/**
 * In-isolate sliding windows. No KV writes — a bot flood must not burn write quota.
 * Per-colo only; pair with Cache-Control on reads. Global cap catches same-isolate bursts.
 */

export type LimitOk = { ok: true; remaining: number };
export type LimitBlocked = { ok: false; retryAfterSec: number; reason: string };
export type LimitResult = LimitOk | LimitBlocked;

const MAX_KEYS = 20_000;

/** Test hook — not used in production paths. */
export const limitBuckets = new Map<string, number[]>();

export const JOIN_IP_MAX = 8;
export const JOIN_IP_WINDOW_MS = 60_000;
export const JOIN_ACTOR_MAX = 5;
export const JOIN_ACTOR_WINDOW_MS = 60_000;
export const JOIN_GLOBAL_MAX = 120;
export const JOIN_GLOBAL_WINDOW_MS = 10_000;

export function hitLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
  reason = 'rate_limited',
): LimitResult {
  const cut = now - windowMs;
  const prev = (limitBuckets.get(key) ?? []).filter((t) => t > cut);
  if (prev.length >= max) {
    limitBuckets.set(key, prev);
    const retryAfterSec = Math.max(1, Math.ceil((prev[0] + windowMs - now) / 1000));
    return { ok: false, retryAfterSec, reason };
  }
  prev.push(now);
  limitBuckets.set(key, prev);
  if (limitBuckets.size > MAX_KEYS) pruneBuckets(now);
  return { ok: true, remaining: max - prev.length };
}

function pruneBuckets(now: number): void {
  for (const [key, times] of limitBuckets) {
    const live = times.filter((t) => now - t < 120_000);
    if (live.length) limitBuckets.set(key, live);
    else limitBuckets.delete(key);
  }
}

export function allowJoin(ip: string, actorId: string, now: number = Date.now()): LimitResult {
  const globalHit = hitLimit('join:global', JOIN_GLOBAL_MAX, JOIN_GLOBAL_WINDOW_MS, now, 'global_join_spike');
  if (!globalHit.ok) return globalHit;
  const ipHit = hitLimit(`join:ip:${ip}`, JOIN_IP_MAX, JOIN_IP_WINDOW_MS, now, 'ip_join');
  if (!ipHit.ok) return ipHit;
  const actorHit = hitLimit(`join:actor:${actorId}`, JOIN_ACTOR_MAX, JOIN_ACTOR_WINDOW_MS, now, 'actor_join');
  if (!actorHit.ok) return actorHit;
  return { ok: true, remaining: Math.min(ipHit.remaining, actorHit.remaining, globalHit.remaining) };
}

export function resetLimits(): void {
  limitBuckets.clear();
}
