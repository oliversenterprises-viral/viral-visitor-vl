/**
 * Vercel serverless — dynamic OG image (SVG or PNG 1200×630 with QR) for /r/CODE previews.
 */

import sharp from 'sharp';

const SITE_ORIGIN = 'https://www.viralrefer.app';
const REF_CODE_RE = /^VIRAL-[A-Z0-9]{4,12}$/;

function normalizeOgReferralCode(raw) {
  const code = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  if (!code || !REF_CODE_RE.test(code)) return null;
  return code;
}

function parsePositiveInt(raw, max = 9999) {
  const n = parseInt(String(raw || ''), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, max);
}

function buildReferralCanonicalUrl(code, subpath = '') {
  const base = SITE_ORIGIN.replace(/\/$/, '');
  const prefix = subpath ? `/${subpath.replace(/^\/|\/$/g, '')}` : '';
  return `${base}${prefix}/r/${code}`;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildOgSvg(code, canonicalUrl, rank, referrals) {
  const safeCode = escapeXml(code);
  const qrData = encodeURIComponent(canonicalUrl);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&amp;data=${qrData}`;
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

  const yJoin = rank != null ? 260 : 230;
  const yCode = rank != null ? 320 : 290;
  const yStats = rank != null ? 380 : 350;
  const yPrize = rank != null ? 425 : 395;

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
  <text x="64" y="${yJoin}" fill="#ffffff" font-family="system-ui,sans-serif" font-size="38" font-weight="600">Join via ${safeCode}</text>
  <text x="64" y="${yCode}" fill="#34d399" font-family="ui-monospace,monospace" font-size="32" font-weight="700">${safeCode}</text>
  <text x="64" y="${yStats}" fill="#e4e4e7" font-family="system-ui,sans-serif" font-size="28">${escapeXml(statsLine)}</text>
  <text x="64" y="${yPrize}" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="24">#1 wins homepage feature + $10 Cash App</text>
  <rect x="856" y="155" width="280" height="280" rx="16" fill="#ffffff"/>
  <image href="${qrUrl}" x="876" y="175" width="240" height="240"/>
  <text x="64" y="580" fill="#71717a" font-family="system-ui,sans-serif" font-size="22">viralrefer.app</text>
</svg>`;
}

async function svgToPng(svg) {
  return sharp(Buffer.from(svg, 'utf-8'), { density: 144 })
    .resize(1200, 630)
    .png()
    .toBuffer();
}

export default async function handler(req, res) {
  const code = normalizeOgReferralCode(req.query?.code || '');
  const subpath = String(req.query?.path || '');
  const rank = parsePositiveInt(req.query?.rank, 99);
  const referrals = parsePositiveInt(req.query?.referrals, 99999);
  const format = String(req.query?.format || 'svg').toLowerCase();

  if (!code) {
    res.status(400).send('Invalid referral code');
    return;
  }

  const canonicalUrl = buildReferralCanonicalUrl(code, subpath);
  const svg = buildOgSvg(code, canonicalUrl, rank, referrals);

  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  if (format === 'png') {
    try {
      const png = await svgToPng(svg);
      res.setHeader('Content-Type', 'image/png');
      res.status(200).send(png);
      return;
    } catch (err) {
      console.error('[og-image] PNG render failed, falling back to SVG:', err);
    }
  }

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.status(200).send(svg);
}