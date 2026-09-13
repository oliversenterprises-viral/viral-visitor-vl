import { GSC_HTML_BODY } from '../../src/lib/organic-seo';

/** Google Search Console HTML-file probe — 53 bytes, no trailing newline. */
export function googleSiteVerificationResponse(): Response {
  return new Response(GSC_HTML_BODY, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-robots-tag': 'noindex',
    },
  });
}
