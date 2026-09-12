import { parseCookies } from './http';
import type { UltraEnv } from './store';

export const HQ_COOKIE = 'vr_ultra_hq';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Local wrangler only — never shipped as VITE_. Disabled when CF-Ray is present. */
export const DEV_FALLBACK_PASSWORD = 'ultra-local-only';

const enc = new TextEncoder();

export function configuredSecret(env: UltraEnv): string | null {
  const a = env.ADMIN_OWNER_PASSWORD?.trim();
  const b = env.ADMIN_ACTION_SECRET?.trim();
  return a || b || null;
}

export function isCloudflareEdge(request: Request): boolean {
  return Boolean(request.headers.get('cf-ray'));
}

export function cfAccessEmail(request: Request): string | null {
  const email = request.headers.get('cf-access-authenticated-user-email');
  return email && email.includes('@') ? email : null;
}

export function verifySecret(env: UltraEnv, request: Request, password: string): { ok: boolean; mode: 'secret' | 'cf-access' | 'dev' | 'unset' } {
  if (cfAccessEmail(request)) return { ok: true, mode: 'cf-access' };
  const secret = configuredSecret(env);
  if (secret) {
    return { ok: timingSafeEqual(password, secret), mode: 'secret' };
  }
  if (!isCloudflareEdge(request) && password === DEV_FALLBACK_PASSWORD) {
    return { ok: true, mode: 'dev' };
  }
  return { ok: false, mode: secret ? 'secret' : 'unset' };
}

export function signingKey(env: UltraEnv, request: Request): string {
  return configuredSecret(env) || (!isCloudflareEdge(request) ? `dev:${DEV_FALLBACK_PASSWORD}` : '');
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function issueSession(env: UltraEnv, request: Request): Promise<string | null> {
  const secret = signingKey(env, request);
  if (!secret) return null;
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `v1.${exp}`;
  const sig = await hmacHex(secret, payload);
  return `${payload}.${sig}`;
}

export async function readSession(env: UltraEnv, request: Request): Promise<{ ok: boolean; exp?: number; via: string }> {
  if (cfAccessEmail(request)) return { ok: true, via: 'cf-access' };
  const token = parseCookies(request.headers.get('cookie'))[HQ_COOKIE];
  const secret = signingKey(env, request);
  if (!token || !secret) return { ok: false, via: 'none' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, via: 'none' };
  const payload = `${parts[0]}.${parts[1]}`;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return { ok: false, via: 'expired' };
  const sig = await hmacHex(secret, payload);
  if (!timingSafeEqual(sig, parts[2])) return { ok: false, via: 'none' };
  return { ok: true, exp, via: 'hmac' };
}

export function sessionCookie(token: string): string {
  return `${HQ_COOKIE}=${token}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; SameSite=Lax; HttpOnly`;
}

export function clearSessionCookie(): string {
  return `${HQ_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}

export async function requireAdmin(env: UltraEnv, request: Request): Promise<Response | null> {
  const session = await readSession(env, request);
  if (session.ok) return null;
  return new Response(JSON.stringify({ ok: false, error: 'Owner login required.' }), {
    status: 401,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
