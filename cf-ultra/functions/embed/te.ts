import { html } from '../_lib/http';
import { teSplashHtml, TE_FRAME_HEADERS } from '../_lib/te-splash';

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  url.searchParams.set('size', url.searchParams.get('size') || '300x250');
  return html(teSplashHtml({ origin: url.origin, url, compact: true }), { headers: TE_FRAME_HEADERS });
};
