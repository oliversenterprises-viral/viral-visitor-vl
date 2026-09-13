import { normalizeOrigin } from '../../src/lib/organic-seo';

export function originFromRequest(request: Request): string {
  return normalizeOrigin(new URL(request.url).origin);
}

export function textPublic(body: string, contentType: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', `${contentType}; charset=utf-8`);
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
  }
  return new Response(body, { ...init, headers });
}
