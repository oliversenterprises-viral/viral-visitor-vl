import { readSession } from './admin-auth';
import { clientIp } from './http';
import { kvBound, type UltraEnv } from './store';

export const EXCLUDE_IPS_KEY = 'ultra:exclude-ips';
export const MAX_EXCLUDE_IPS = 200;
const CACHE_MS = 15_000;

export type SkipReason = 'none' | 'ip' | 'owner';
export type SkipStats = { skip: boolean; reason: SkipReason; ip: string };

type Cache = { ips: string[]; at: number };
const g = globalThis as typeof globalThis & { __ULTRA_EXCLUDE_IPS__?: Cache };

export function resetExcludeRuntime(): void {
  g.__ULTRA_EXCLUDE_IPS__ = undefined;
}

export function normalizeIp(raw: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.length > 64) return null;
  const mapped = ipv4Mapped(trimmed);
  if (mapped) return mapped;
  if (isIPv4(trimmed)) return canonicalIPv4(trimmed);
  if (isIPv6(trimmed)) return trimmed.split('%')[0].toLowerCase();
  return null;
}

function canonicalIPv4(ip: string): string {
  return ip
    .split('.')
    .map((p) => String(Number(p)))
    .join('.');
}

function isIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

function ipv4Mapped(ip: string): string | null {
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (!m || !isIPv4(m[1])) return null;
  return canonicalIPv4(m[1]);
}

function isIPv6(ip: string): boolean {
  const bare = ip.split('%')[0];
  if (!bare.includes(':')) return false;
  if (bare.includes(':::')) return false;
  const sides = bare.split('::');
  if (sides.length > 2) return false;
  const groups = sides
    .join(':')
    .split(':')
    .filter((g) => g.length > 0);
  const emptySlots = sides.length === 2 ? 1 : 0;
  if (emptySlots === 0 && groups.length !== 8) return false;
  if (emptySlots === 1 && groups.length > 7) return false;
  return groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
}

export function statsIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) {
    const n = normalizeIp(cf);
    if (n) return n;
  }
  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (xff) {
    const n = normalizeIp(xff);
    if (n) return n;
  }
  return normalizeIp(clientIp(request)) || clientIp(request);
}

export function isExcludedIp(list: string[], ip: string): boolean {
  const want = normalizeIp(ip);
  if (!want) return false;
  return list.some((item) => normalizeIp(item) === want);
}

export async function loadExcludeIps(env: UltraEnv): Promise<string[]> {
  const cached = g.__ULTRA_EXCLUDE_IPS__;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.ips.slice();
  let ips: string[] = [];
  if (kvBound(env)) {
    try {
      const raw = (await env.BOARD!.get(EXCLUDE_IPS_KEY, 'json')) as { ips?: string[] } | string[] | null;
      const list = Array.isArray(raw) ? raw : raw?.ips;
      if (Array.isArray(list)) ips = list.map((x) => normalizeIp(String(x))).filter((x): x is string => Boolean(x));
    } catch {
      ips = cached?.ips.slice() || [];
    }
  } else if (cached) {
    ips = cached.ips.slice();
  }
  g.__ULTRA_EXCLUDE_IPS__ = { ips, at: Date.now() };
  return ips.slice();
}

export async function saveExcludeIps(env: UltraEnv, ips: string[]): Promise<string[]> {
  const next = [...new Set(ips.map((x) => normalizeIp(x)).filter((x): x is string => Boolean(x)))].slice(0, MAX_EXCLUDE_IPS);
  g.__ULTRA_EXCLUDE_IPS__ = { ips: next, at: Date.now() };
  if (kvBound(env)) {
    await env.BOARD!.put(EXCLUDE_IPS_KEY, JSON.stringify({ ips: next, at: Date.now() }));
  }
  return next;
}

export async function addExcludeIp(env: UltraEnv, raw: string): Promise<{ ips: string[]; added: string | null; error?: string }> {
  const ip = normalizeIp(raw);
  if (!ip) return { ips: await loadExcludeIps(env), added: null, error: 'Need a valid IPv4 or IPv6 address.' };
  const ips = await loadExcludeIps(env);
  if (ips.includes(ip)) return { ips, added: ip };
  if (ips.length >= MAX_EXCLUDE_IPS) return { ips, added: null, error: `Exclude list is full (${MAX_EXCLUDE_IPS}).` };
  const next = await saveExcludeIps(env, [...ips, ip]);
  return { ips: next, added: ip };
}

export async function removeExcludeIp(env: UltraEnv, raw: string): Promise<{ ips: string[]; removed: string | null }> {
  const ip = normalizeIp(raw);
  const ips = await loadExcludeIps(env);
  if (!ip) return { ips, removed: null };
  const next = ips.filter((x) => x !== ip);
  if (next.length === ips.length) return { ips, removed: null };
  return { ips: await saveExcludeIps(env, next), removed: ip };
}

export async function shouldSkipStats(env: UltraEnv, request: Request): Promise<SkipStats> {
  const ip = statsIp(request);
  const session = await readSession(env, request);
  if (session.ok) return { skip: true, reason: 'owner', ip };
  const ips = await loadExcludeIps(env);
  if (isExcludedIp(ips, ip)) return { skip: true, reason: 'ip', ip };
  return { skip: false, reason: 'none', ip };
}
