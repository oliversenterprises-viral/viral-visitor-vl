import { wantsCompactTe } from '../src/lib/organic-seo';
import { html } from './_lib/http';
import { teLandingHtml } from './_lib/public-landings';
import { teSplashHtml, TE_FRAME_HEADERS } from './_lib/te-splash';

/** TE splash in iframes; unique indexable explainer for top-level / crawlers. */
export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  if (wantsCompactTe(request, url)) {
    return html(teSplashHtml({ origin: url.origin, url }), { headers: TE_FRAME_HEADERS });
  }
  return html(teLandingHtml({ origin: url.origin, url }), {
    headers: {
      ...TE_FRAME_HEADERS,
      'cache-control': 'public, max-age=120, s-maxage=120, stale-while-revalidate=600',
    },
  });
};
