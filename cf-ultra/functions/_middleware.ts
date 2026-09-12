/** Path-scoped framing: TE/embed allow iframes; Admin never; homepage same-origin. */
export const onRequest: PagesFunction = async (context) => {
  const res = await context.next();
  const path = new URL(context.request.url).pathname;
  const headers = new Headers(res.headers);
  const te =
    path === '/te' ||
    path === '/te.html' ||
    path === '/go' ||
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
  } else if (path === '/' || path === '/index.html') {
    headers.set('x-frame-options', 'SAMEORIGIN');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};
