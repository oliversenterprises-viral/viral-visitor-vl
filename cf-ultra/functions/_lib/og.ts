import { RUNG_COPY, escapeHtml, escapeXml, type BoardSite, type Player, type Rung, type Site } from './engine';
import { edgeI18nSnippet } from './i18n-edge';

export function ogImageSvg(opts: {
  code: string;
  host: string;
  rung: Rung;
  credits: number;
  weekly: number;
  rank?: number | null;
  demoMode: boolean;
  origin?: string;
}): string {
  const code = escapeXml(opts.code);
  const host = escapeXml(opts.host || 'ViralRefer');
  const rung = escapeXml(RUNG_COPY[opts.rung].title);
  const rank = opts.rank != null && opts.rank >= 1 ? Math.floor(opts.rank) : null;
  const isLeader = rank === 1;
  const share = `${(opts.origin || '').replace(/\/$/, '')}/r/${opts.code}`;
  const qrData = encodeURIComponent(share.startsWith('http') ? share : `/r/${opts.code}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&amp;data=${qrData}`;
  const stats = opts.credits
    ? `${opts.credits} unique friend lock${opts.credits === 1 ? '' : 's'} · ${opts.weekly} this week`
    : 'Tap Get my link. Visiting does not count.';
  const footer = opts.demoMode
    ? 'BOARD KV not bound on this isolate · unique locks still work here'
    : 'UNIQUE FRIEND LOCKS · VISITS DO NOT COUNT';
  const rankBadge =
    rank != null
      ? `<rect x="64" y="168" width="${isLeader ? 280 : 220}" height="44" rx="10" fill="${isLeader ? '#f59e0b' : '#7c3aed'}" opacity="0.9"/>
  <text x="84" y="198" fill="${isLeader ? '#0a0a0a' : '#ffffff'}" font-family="system-ui,sans-serif" font-size="22" font-weight="800">${isLeader ? '#1 ON LEADERBOARD' : `#${rank} ON BOARD`}</text>`
      : '';
  const y0 = rank != null ? 260 : 230;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${isLeader ? '#f59e0b' : '#7c3aed'}"/>
      <stop offset="100%" stop-color="${isLeader ? '#fbbf24' : '#c026d3'}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0a0a0a"/>
  <rect width="1200" height="12" fill="url(#g)"/>
  <text x="64" y="100" fill="#ffffff" font-family="system-ui,sans-serif" font-size="52" font-weight="700">ViralRefer</text>
  <text x="64" y="148" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="26">LIVE REFERRAL LEADERBOARD</text>
  ${rankBadge}
  <text x="64" y="${y0}" fill="#ffffff" font-family="system-ui,sans-serif" font-size="38" font-weight="600">Join via ${code}</text>
  <text x="64" y="${y0 + 60}" fill="#34d399" font-family="ui-monospace,monospace" font-size="32" font-weight="700">${code}</text>
  <text x="64" y="${y0 + 120}" fill="#e4e4e7" font-family="system-ui,sans-serif" font-size="26">${escapeXml(stats)}</text>
  <text x="64" y="${y0 + 165}" fill="#fde68a" font-family="system-ui,sans-serif" font-size="22">${rung} · ${host}</text>
  <rect x="856" y="155" width="280" height="280" rx="16" fill="#ffffff"/>
  <image href="${qrUrl}" x="876" y="175" width="240" height="240"/>
  <text x="64" y="560" fill="#71717a" font-family="system-ui,sans-serif" font-size="20">${escapeXml(footer)}</text>
  <rect x="820" y="470" width="300" height="72" rx="16" fill="#7c3aed"/>
  <text x="970" y="516" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="26" font-weight="800">GET MY LINK</text>
</svg>`;
}

export function crawlerOgHtml(opts: {
  origin: string;
  code: string;
  canonicalUrl: string;
  ogUrl: string;
  host?: string;
  label?: string;
  credits: number;
  weekly: number;
  rank?: number | null;
  demoMode: boolean;
}): string {
  const who = opts.label || opts.host || opts.code;
  const title = 'Win the homepage. #1 gets a banner — tap Get my link';
  const desc = `Join via ${opts.code}. Tap Get my link to credit ${who}. Visiting does not count.`;
  const og = `${opts.origin}/api/og?code=${encodeURIComponent(opts.code)}`;
  const href = `${opts.origin}/?ref=${encodeURIComponent(opts.code)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${escapeHtml(opts.canonicalUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ViralRefer">
  <meta property="og:url" content="${escapeHtml(opts.ogUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${escapeHtml(og)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(opts.ogUrl)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${escapeHtml(og)}">
  <meta name="referrer-code" content="${escapeHtml(opts.code)}">
</head>
<body>
  <p>ViralRefer referral link for <strong>${escapeHtml(opts.code)}</strong>.</p>
  <p>A friend must tap Get my link. Visiting does not count.</p>
  <p><a href="${escapeHtml(href)}">Get my link</a></p>
</body>
</html>`;
}

export function landingHtml(opts: {
  origin: string;
  code: string;
  player: Player | null;
  site: Site | null;
  boardSite: BoardSite | null;
  demoMode: boolean;
}): string {
  const host = opts.site?.host ?? '';
  const label = opts.site?.label ?? host;
  const credits = opts.site?.creditTimes.length ?? 0;
  const weekly = opts.boardSite?.weeklyCredits ?? 0;
  const canonical = `${opts.origin}/r/${opts.code}`;
  return crawlerOgHtml({
    origin: opts.origin,
    code: opts.code,
    canonicalUrl: canonical,
    ogUrl: canonical,
    host,
    label,
    credits,
    weekly,
    demoMode: opts.demoMode,
  });
}

export function embedWidgetHtml(opts: {
  origin: string;
  host: string;
  site: Site | null;
  credits: number;
  weekly: number;
  rung: Rung;
}): string {
  const label = escapeHtml(opts.site?.label ?? opts.host);
  const join = `${opts.origin}/?url=${encodeURIComponent(opts.site?.url ?? `https://${opts.host}`)}&ref=${encodeURIComponent(opts.site?.ownerCode ?? '')}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Help ${label} go viral</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #09090b; color: #f4f4f5; }
    a { display: flex; align-items: center; justify-content: space-between; gap: 12px; text-decoration: none; color: inherit; padding: 14px 16px; border: 1px solid rgba(255,255,255,.12); border-radius: 16px; background: rgba(255,255,255,.06); }
    strong { color: #c4b5fd; }
    small { color: #a1a1aa; }
    .go { background: linear-gradient(90deg, #059669, #7c3aed); color: #fff; font-weight: 800; border-radius: 10px; padding: 8px 10px; font-size: 13px; }
  </style>
</head>
<body>
  <a href="${escapeHtml(join)}" target="_blank" rel="noopener" id="go">
    <div>
      <strong data-i18n="embed.help" data-i18n-label="${label}">Help ${label} go viral</strong>
      <small>${opts.credits} unique locks · ${escapeHtml(RUNG_COPY[opts.rung].title)}</small>
    </div>
    <span class="go" data-i18n="embed.go">Get my link</span>
  </a>
  <script>
    fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'embed_load',platform:'embed'})}).catch(()=>{});
    document.getElementById('go')?.addEventListener('click',()=>{
      fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'embed_click',platform:'embed'})}).catch(()=>{});
    });
  </script>
  ${edgeI18nSnippet()}
</body>
</html>`;
}

export function embedScript(origin: string): string {
  return `(function(){
  var s=document.currentScript;
  var host=(s && s.getAttribute('data-site')) || '';
  var t=document.createElement('iframe');
  t.src=${JSON.stringify(origin)}+'/e/'+encodeURIComponent(host);
  t.title='ViralRefer';
  t.style.cssText='width:100%;max-width:420px;height:88px;border:0;border-radius:16px;overflow:hidden;';
  t.loading='lazy';
  if(s&&s.parentNode)s.parentNode.insertBefore(t,s.nextSibling);
})();`;
}
