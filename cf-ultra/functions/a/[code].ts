import { CODE_RE } from '../_lib/engine';

/** Attribution alias: /a/VR-XXXXXX → /?ref=VR-XXXXXX (never drop campaign tags). */
export const onRequestGet: PagesFunction = async ({ params, request }) => {
  const incoming = new URL(request.url);
  const dest = new URL('/', incoming);
  for (const [k, v] of incoming.searchParams) dest.searchParams.set(k, v);
  const code = String(params.code || '').toUpperCase();
  if (CODE_RE.test(code)) dest.searchParams.set('ref', code);
  return Response.redirect(dest.toString(), 302);
};
