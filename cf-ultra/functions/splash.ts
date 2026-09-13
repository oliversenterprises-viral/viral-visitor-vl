import { html } from './_lib/http';
import { conversionSplashHtml, CONVERSION_SPLASH_HEADERS } from './_lib/conversion-splash';

/** Full-viewport TE conversion splash. Compact iframe units stay on /te?size=. */
export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  return html(conversionSplashHtml({ origin: url.origin, url }), { headers: CONVERSION_SPLASH_HEADERS });
};
