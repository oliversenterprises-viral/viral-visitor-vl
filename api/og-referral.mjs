/**
 * Vercel serverless — dynamic OG HTML for /r/CODE (social crawlers only via vercel.json rewrite).
 */

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

function buildReferralCanonicalUrl(code, subpath = '') {
  const base = SITE_ORIGIN.replace(/\/$/, '');
  const prefix = subpath ? `/${subpath.replace(/^\/|\/$/g, '')}` : '';
  return `${base}${prefix}/r/${code}`;
}

function buildReferralOgMeta(rawCode, subpath = '') {
  const code = normalizeOgReferralCode(rawCode);
  if (!code) return null;
  const canonicalUrl = buildReferralCanonicalUrl(code, subpath);
  return {
    code,
    canonicalUrl,
    title: `Join ViralRefer via ${code} — Live Referral Leaderboard`,
    description: `${code} invited you — free link in ~30 sec. Climb the live leaderboard. #1 can claim a homepage feature.`,
    image: `${SITE_ORIGIN}/api/og-image?code=${encodeURIComponent(code)}&format=png`,
  };
}

function escapeHtmlAttr(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildReferralOgHtml(meta) {
  const t = escapeHtmlAttr(meta.title);
  const d = escapeHtmlAttr(meta.description);
  const u = escapeHtmlAttr(meta.canonicalUrl);
  const img = escapeHtmlAttr(meta.image);
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

export default function handler(req, res) {
  const code = String(req.query?.code || '');
  const subpath = String(req.query?.path || '');
  const meta = buildReferralOgMeta(code, subpath);

  if (!meta) {
    res.status(400).send('Invalid referral code');
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(buildReferralOgHtml(meta));
}