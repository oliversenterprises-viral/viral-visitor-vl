/**
 * Dynamic Open Graph / social meta for referral links (/r/CODE).
 * Used by client-side updates and mirrored in api/og-referral.mjs for crawlers.
 */

const SITE_ORIGIN = 'https://www.viralrefer.app';
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/assets/hero.png`;
const REF_CODE_RE = /^VIRAL-[A-Z0-9]{4,12}$/;

export interface ReferralOgMeta {
  code: string;
  canonicalUrl: string;
  title: string;
  description: string;
  image: string;
  rank?: number | null;
  referrals?: number;
}

/** Normalize and validate a referral code for OG rendering. */
export function normalizeOgReferralCode(raw: string): string | null {
  const code = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  if (!code || !REF_CODE_RE.test(code)) return null;
  return code;
}

export function buildReferralCanonicalUrl(code: string, subpath = ''): string {
  const base = SITE_ORIGIN.replace(/\/$/, '');
  const prefix = subpath ? `/${subpath.replace(/^\/|\/$/g, '')}` : '';
  return `${base}${prefix}/r/${code}`;
}

/** Dynamic OG image URL (SVG card with QR — served by /api/og-image). */
export function buildReferralOgImageUrl(
  code: string,
  origin = SITE_ORIGIN,
  options: {
    rank?: number | null;
    referrals?: number;
    /** PNG raster for crawlers that reject SVG (wave 8). */
    format?: 'svg' | 'png';
  } = {},
): string {
  const base = origin.replace(/\/$/, '');
  const params = new URLSearchParams({ code });
  const rank = options.rank;
  const referrals = options.referrals;
  if (rank != null && rank >= 1) params.set('rank', String(Math.floor(rank)));
  if (referrals != null && referrals > 0) params.set('referrals', String(Math.floor(referrals)));
  if (options.format === 'png') params.set('format', 'png');
  return `${base}/api/og-image?${params.toString()}`;
}

/** Build OG/Twitter meta payload for a referral code. */
export function buildReferralOgMeta(
  rawCode: string,
  options: {
    subpath?: string;
    origin?: string;
    rank?: number | null;
    referrals?: number;
  } = {},
): ReferralOgMeta | null {
  const code = normalizeOgReferralCode(rawCode);
  if (!code) return null;

  const canonicalUrl = buildReferralCanonicalUrl(code, options.subpath);
  const origin = (options.origin || SITE_ORIGIN).replace(/\/$/, '');
  const rank = options.rank ?? null;
  const referrals = options.referrals ?? 0;

  let description = `${code} invited you — free link in ~30 sec. Scan the QR or tap to join. Climb the live leaderboard. #1 can claim a homepage feature.`;
  if (rank === 1) {
    description = `${code} is #1 on the live leaderboard — join via QR in ~30 sec. Climb the board. #1 can claim a homepage feature.`;
  } else if (rank != null && rank >= 2) {
    description = `${code} is #${rank} on the live leaderboard — join via QR in ~30 sec. #1 can claim a homepage feature.`;
  } else if (referrals > 0) {
    description = `${code} has ${referrals} referral${referrals === 1 ? '' : 's'} — join via QR in ~30 sec. Climb the live leaderboard.`;
  }

  return {
    code,
    canonicalUrl,
    title: `Join ViralRefer via ${code} — Live Referral Leaderboard`,
    description,
    image: buildReferralOgImageUrl(code, origin, { rank, referrals, format: 'png' }),
    rank,
    referrals,
  };
}

/** Branded 1200×630 SVG Open Graph card with embedded QR. */
export function buildReferralOgSvg(meta: ReferralOgMeta): string {
  const code = escapeHtmlAttr(meta.code);
  const qrData = encodeURIComponent(meta.canonicalUrl);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&amp;data=${qrData}`;
  const rank = meta.rank != null && meta.rank >= 1 ? Math.floor(meta.rank) : null;
  const referrals = meta.referrals != null && meta.referrals > 0 ? Math.floor(meta.referrals) : null;
  const isLeader = rank === 1;

  const barGradient = isLeader
    ? `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>`
    : `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#c026d3"/>
    </linearGradient>`;

  const rankBadge =
    rank != null
      ? `<rect x="64" y="168" width="${isLeader ? 280 : 220}" height="44" rx="10" fill="${isLeader ? '#f59e0b' : '#7c3aed'}" opacity="0.9"/>
  <text x="84" y="198" fill="#0a0a0a" font-family="system-ui,sans-serif" font-size="22" font-weight="800">${isLeader ? '#1 ON LEADERBOARD' : `#${rank} ON BOARD`}</text>`
      : '';

  const statsLine = referrals
    ? `${referrals} referral${referrals === 1 ? '' : 's'} and climbing`
    : 'Free link in ~30 sec — scan QR to join';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    ${barGradient}
  </defs>
  <rect width="1200" height="630" fill="#0a0a0a"/>
  <rect width="1200" height="12" fill="url(#g)"/>
  <text x="64" y="100" fill="#ffffff" font-family="system-ui,sans-serif" font-size="52" font-weight="700">ViralRefer</text>
  <text x="64" y="148" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="26">LIVE REFERRAL LEADERBOARD</text>
  ${rankBadge}
  <text x="64" y="${rank != null ? 260 : 230}" fill="#ffffff" font-family="system-ui,sans-serif" font-size="38" font-weight="600">Join via ${code}</text>
  <text x="64" y="${rank != null ? 320 : 290}" fill="#34d399" font-family="ui-monospace,monospace" font-size="32" font-weight="700">${code}</text>
  <text x="64" y="${rank != null ? 380 : 350}" fill="#e4e4e7" font-family="system-ui,sans-serif" font-size="28">${escapeHtmlAttr(statsLine)}</text>
  <text x="64" y="${rank != null ? 425 : 395}" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="24">#1 can claim a homepage feature</text>
  <rect x="856" y="155" width="280" height="280" rx="16" fill="#ffffff"/>
  <image href="${qrUrl}" x="876" y="175" width="240" height="240"/>
  <text x="64" y="580" fill="#71717a" font-family="system-ui,sans-serif" font-size="22">viralrefer.app</text>
</svg>`;
}

/** Escape text for safe HTML attribute / content insertion. */
export function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Minimal HTML document with OG tags (served to social crawlers). */
export function buildReferralOgHtml(meta: ReferralOgMeta): string {
  const t = escapeHtmlAttr(meta.title);
  const d = escapeHtmlAttr(meta.description);
  const u = escapeHtmlAttr(meta.canonicalUrl);
  const img = escapeHtmlAttr(meta.image || DEFAULT_OG_IMAGE);
  const code = escapeHtmlAttr(meta.code);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <link rel="canonical" href="${u}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ViralRefer">
  <meta property="og:url" content="${u}">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:image" content="${img}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${u}">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${img}">
  <meta name="referrer-code" content="${code}">
</head>
<body>
  <p>ViralRefer referral link for <strong>${code}</strong>.</p>
  <p><a href="${u}">Open ViralRefer</a></p>
</body>
</html>`;
}

/** Detect social preview crawlers (Facebook, X, Slack, Discord, etc.). */
export function isSocialCrawler(userAgent: string): boolean {
  return /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|googlebot|bingbot|applebot|pinterest|embedly|redditbot/i.test(
    userAgent,
  );
}

/** User-agent regex for vercel.json rewrite `has` header (PCRE). */
export const SOCIAL_CRAWLER_UA_REGEX =
  '(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Googlebot|bingbot|Applebot|Pinterest|Embedly|redditbot)';