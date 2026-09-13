import { isPublicAssetPath, notFoundHtml } from '../src/lib/organic-seo';
import { decorateHomepageHtml } from './_lib/homepage-seo';
import { html } from './_lib/http';

/** Path-scoped framing + origin-aware homepage SEO (static index.html still wins over functions/index.ts). */
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const res = await context.next();
  const headers = new Headers(res.headers);
  const te =
    path === '/te' ||
    path === '/te.html' ||
    path === '/go' ||
    path === '/splash' ||
    path.startsWith('/splash') ||
    path.startsWith('/embed/te') ||
    path.startsWith('/e/') ||
    path.startsWith('/promo/te');
  if (path.startsWith('/admin')) {
    headers.set('x-frame-options', 'DENY');
    headers.set('content-security-policy', "frame-ancestors 'none'");
  } else if (te) {
    headers.delete('x-frame-options');
    const csp = headers.get('content-security-policy') || "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'";
    if (!/frame-ancestors/.test(csp)) headers.set('content-security-policy', `${csp}; frame-ancestors *`);
  } else if (path === '/' || path === '/index.html' || /^\/(?:r|a)\/[A-Za-z0-9_-]+\/?$/i.test(path)) {
    headers.set('x-frame-options', 'SAMEORIGIN');
  }

  if (!isPublicAssetPath(path) && res.status === 200) {
    return html(notFoundHtml(url.origin), { status: 404, headers: { 'x-vr-seo': '404' } });
  }

  const homepage = path === '/' || path === '/index.html';
  const type = headers.get('content-type') || '';
  if (homepage && res.ok && type.includes('text/html')) {
    const html = decorateHomepageHtml(await res.text(), url);
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.set('x-vr-seo', '1');
    headers.delete('etag');
    return new Response(html, { status: res.status, statusText: res.statusText, headers });
  }

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};
