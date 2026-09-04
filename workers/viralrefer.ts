/**
 * Cloudflare Worker for viralrefer.app (parallel to Vercel).
 * Static homepage/assets stay on the CDN. This Worker only runs for
 * /r/, /join/r/, /api/, and /relay so a traffic spike does not burn
 * Worker invocations on CSS/JS.
 */
import {
  buildReferralOgHtml,
  buildReferralOgMeta,
  buildReferralOgSvg,
  isSocialCrawler,
  normalizeOgReferralCode,
} from '../src/lib/og-meta';

export type AssetEnv = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  CRON_SECRET?: string;
  OPTIMIZER_CRON_SECRET?: string;
};

const SITE_ORIGIN = 'https://www.viralrefer.app';

const HSTS = 'max-age=63072000; includeSubDomains; preload';
const PERMISSIONS = 'geolocation=(), microphone=(), camera=()';

const CSP_MAIN =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.challenges.cloudflare.com https://www.redditstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://wqbefjzpgsezzwdrvvua.supabase.co wss://wqbefjzpgsezzwdrvvua.supabase.co https://challenges.cloudflare.com https://*.challenges.cloudflare.com wss://challenges.cloudflare.com wss://*.challenges.cloudflare.com https://www.redditstatic.com https://alb.reddit.com https://pixel-config.reddit.com https://conversions-config.reddit.com https://www.reddit.com; frame-src https://challenges.cloudflare.com https://*.challenges.cloudflare.com; worker-src 'self' blob: https://challenges.cloudflare.com https://*.challenges.cloudflare.com; child-src 'self' blob: https://challenges.cloudflare.com https://*.challenges.cloudflare.com; frame-ancestors 'none'; upgrade-insecure-requests;";

const CSP_EMBED =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://wqbefjzpgsezzwdrvvua.supabase.co wss://wqbefjzpgsezzwdrvvua.supabase.co https://challenges.cloudflare.com https://*.challenges.cloudflare.com wss://challenges.cloudflare.com wss://*.challenges.cloudflare.com; frame-src https://challenges.cloudflare.com https://*.challenges.cloudflare.com; worker-src 'self' blob: https://challenges.cloudflare.com https://*.challenges.cloudflare.com; child-src 'self' blob: https://challenges.cloudflare.com https://*.challenges.cloudflare.com; frame-ancestors *; upgrade-insecure-requests;";

function applySecurityHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  const embed = pathname === '/embed' || pathname.startsWith('/embed/');
  headers.set('Content-Security-Policy', embed ? CSP_EMBED : CSP_MAIN);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Strict-Transport-Security', HSTS);
  headers.set('Permissions-Policy', PERMISSIONS);
  if (!embed) headers.set('X-Frame-Options', 'DENY');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function parsePositiveInt(raw: string | null, max: number): number | null {
  const n = parseInt(String(raw || ''), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, max);
}

function ogReferralResponse(url: URL): Response {
  const code = String(url.searchParams.get('code') || '');
  const subpath = String(url.searchParams.get('path') || '');
  const origin = url.origin.includes('workers.dev') ? url.origin : SITE_ORIGIN;
  const meta = buildReferralOgMeta(code, { subpath, origin });
  if (!meta) {
    return new Response('Invalid referral code', { status: 400 });
  }
  meta.image = meta.image.replace('format=png', 'format=svg');
  if (!meta.image.includes('format=')) {
    meta.image += (meta.image.includes('?') ? '&' : '?') + 'format=svg';
  }
  return new Response(buildReferralOgHtml(meta), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

function ogImageResponse(url: URL): Response {
  const code = normalizeOgReferralCode(String(url.searchParams.get('code') || ''));
  if (!code) return new Response('Invalid referral code', { status: 400 });
  const subpath = String(url.searchParams.get('path') || '');
  const rank = parsePositiveInt(url.searchParams.get('rank'), 99);
  const referrals = parsePositiveInt(url.searchParams.get('referrals'), 99999) || 0;
  const origin = url.origin.includes('workers.dev') ? url.origin : SITE_ORIGIN;
  const meta = buildReferralOgMeta(code, { subpath, origin, rank, referrals });
  if (!meta) return new Response('Invalid referral code', { status: 400 });
  const svg = buildReferralOgSvg(meta);
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

function referralPath(pathname: string): { code: string; join: boolean } | null {
  const match = pathname.match(/^(?:\/join)?\/r\/([^/]+)\/?$/i);
  if (!match) return null;
  return {
    code: match[1],
    join: pathname.toLowerCase().startsWith('/join/'),
  };
}

export async function handleViralreferRequest(
  request: Request,
  env: AssetEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === '/relay' || pathname === '/relay/') {
    return Response.redirect(new URL('/tools/traffic-refer-kit.html', url.origin), 301);
  }

  if (pathname === '/api/og-referral') return applySecurityHeaders(ogReferralResponse(url), pathname);
  if (pathname === '/api/og-image') return applySecurityHeaders(ogImageResponse(url), pathname);

  const ref = referralPath(pathname);
  const ua = request.headers.get('user-agent') || '';
  if (ref && isSocialCrawler(ua)) {
    const dest = new URL('/api/og-referral', url.origin);
    dest.searchParams.set('code', ref.code);
    if (ref.join) dest.searchParams.set('path', 'join');
    return applySecurityHeaders(ogReferralResponse(dest), pathname);
  }

  const asset = await env.ASSETS.fetch(request);
  return applySecurityHeaders(asset, pathname);
}

export default {
  async fetch(request: Request, env: AssetEnv): Promise<Response> {
    return handleViralreferRequest(request, env);
  },

  async scheduled(_event: unknown, env: AssetEnv): Promise<void> {
    const supabaseUrl = String(env.SUPABASE_URL || 'https://wqbefjzpgsezzwdrvvua.supabase.co').replace(
      /\/$/,
      '',
    );
    const secret = String(env.OPTIMIZER_CRON_SECRET || env.CRON_SECRET || '').trim();
    if (!secret) return;
    await fetch(`${supabaseUrl}/functions/v1/optimizer-cron`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  },
};
