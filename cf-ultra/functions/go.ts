import { wantsCompactTe } from '../src/lib/organic-seo';
import { html } from './_lib/http';
import { conversionSplashHtml, CONVERSION_SPLASH_HEADERS } from './_lib/conversion-splash';
import { teSplashHtml, TE_FRAME_HEADERS } from './_lib/te-splash';

/** Compact iframe unit when sized/framed; full conversion splash for human breakouts. */
export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  if (wantsCompactTe(request, url)) {
    return html(teSplashHtml({ origin: url.origin, url }), { headers: TE_FRAME_HEADERS });
  }
  return html(conversionSplashHtml({ origin: url.origin, url }), { headers: CONVERSION_SPLASH_HEADERS });
};
