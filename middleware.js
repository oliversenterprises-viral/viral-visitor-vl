/**
 * Edge middleware: reliable social-crawler OG rewrite for /r/:code.
 * Complements vercel.json rewrites (UA matching has been flaky on SPA catch-all).
 * Humans pass through to the SPA; bots get personalized OG HTML via /api/og-referral.
 */

const BOT_UA =
  /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|googlebot|bingbot|applebot|pinterest|embedly|redditbot/i;

export const config = {
  matcher: ['/r/:code*', '/join/r/:code*'],
};

export default function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  if (!BOT_UA.test(ua)) {
    return; // continue to SPA
  }

  const url = new URL(request.url);
  const match = url.pathname.match(/^(?:\/join)?\/r\/([^/]+)\/?$/i);
  if (!match) {
    return;
  }

  const code = match[1];
  const isJoin = url.pathname.toLowerCase().startsWith('/join/');
  const dest = new URL('/api/og-referral', url.origin);
  dest.searchParams.set('code', code);
  if (isJoin) dest.searchParams.set('path', 'join');

  // Proxy the OG HTML response (works without @vercel/edge dependency)
  return fetch(dest.toString(), {
    headers: {
      accept: 'text/html',
      'user-agent': ua,
    },
  });
}
