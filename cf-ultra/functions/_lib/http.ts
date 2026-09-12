import { ACTOR_RE, newActorId } from './engine';

export const ACTOR_COOKIE = 'vr_ultra_actor';

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function html(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(body, { ...init, headers });
}

export function svg(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'image/svg+xml; charset=utf-8');
  headers.set('cache-control', 'public, max-age=60');
  return new Response(body, { ...init, headers });
}

export function js(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/javascript; charset=utf-8');
  headers.set('cache-control', 'public, max-age=300');
  return new Response(body, { ...init, headers });
}

export function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function actorFromRequest(request: Request): { actorId: string; setCookie: boolean } {
  const cookies = parseCookies(request.headers.get('cookie'));
  const existing = cookies[ACTOR_COOKIE];
  if (existing && ACTOR_RE.test(existing)) return { actorId: existing, setCookie: false };
  return { actorId: newActorId(), setCookie: true };
}

export function actorCookieHeader(actorId: string): string {
  return `${ACTOR_COOKIE}=${actorId}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function withActor(response: Response, actorId: string, setCookie: boolean): Response {
  if (!setCookie) return response;
  const headers = new Headers(response.headers);
  headers.append('set-cookie', actorCookieHeader(actorId));
  return new Response(response.body, { status: response.status, headers });
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

export function originFromRequest(request: Request): string {
  const url = new URL(request.url);
  return url.origin;
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
