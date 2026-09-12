import { html } from './_lib/http';
import { teSplashHtml, TE_FRAME_HEADERS } from './_lib/te-splash';

/** TE / rotator splash — cached, no KV, no track write. */
export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  return html(teSplashHtml({ origin: url.origin, url }), { headers: TE_FRAME_HEADERS });
};
