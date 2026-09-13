import { wantsCompactTe } from '../src/lib/organic-seo';
import { html } from './_lib/http';
import { goLandingHtml } from './_lib/public-landings';
import { teSplashHtml, TE_FRAME_HEADERS } from './_lib/te-splash';

/** Compact splash when iframed; unique breakout copy for top-level /go. */
export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  if (wantsCompactTe(request, url)) {
    return html(teSplashHtml({ origin: url.origin, url }), { headers: TE_FRAME_HEADERS });
  }
  return html(goLandingHtml({ origin: url.origin, url }), {
    headers: {
      ...TE_FRAME_HEADERS,
      'cache-control': 'public, max-age=120, s-maxage=120, stale-while-revalidate=600',
    },
  });
};
