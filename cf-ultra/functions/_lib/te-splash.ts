import { CODE_RE } from './engine';
import { breakoutUrl, campaignFromSearch, type Campaign } from './campaign';

export type TeSize = '728x90' | '468x60' | '300x250' | 'auto';

export function teSizeFromSearch(url: URL, compact?: boolean): TeSize {
  const raw = (url.searchParams.get('size') || '').toLowerCase();
  if (raw === '728x90' || raw === '468x60' || raw === '300x250') return raw;
  if (compact) return '300x250';
  return 'auto';
}

export function teSplashHtml(opts: { origin: string; url: URL; compact?: boolean }): string {
  const camp: Campaign = campaignFromSearch(opts.url.searchParams);
  const refRaw = (opts.url.searchParams.get('ref') || '').toUpperCase();
  const ref = CODE_RE.test(refRaw) ? refRaw : '';
  const open = breakoutUrl(opts.origin, camp, ref || null);
  const size = teSizeFromSearch(opts.url, opts.compact);
  const strip = size === '728x90' || size === '468x60';
  const cta = strip ? 'Open' : 'Open — Get my link';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>ViralRefer Ultra — Get my link</title>
  <meta name="robots" content="noindex"/>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; overflow: hidden; font-family: ui-sans-serif, system-ui, sans-serif; background: #050508; color: #f4f1ea; }
    .box { height: 100%; display: flex; flex-direction: column; justify-content: center; padding: 12px 14px; }
    .kicker { color: #d6ff3e; letter-spacing: .14em; font-size: 10px; font-weight: 800; margin: 0 0 6px; }
    h1 { font-size: clamp(18px, 6vw, 28px); line-height: 1.05; margin: 0 0 8px; }
    .lead, .fine { color: #9a9588; font-size: 13px; line-height: 1.4; margin: 0 0 12px; }
    .fine { margin: 8px 0 0; font-size: 11px; }
    .cta {
      display: block; text-align: center; text-decoration: none; font-weight: 800;
      min-height: 48px; line-height: 48px; border-radius: 12px; background: #d6ff3e; color: #071000; font-size: 16px;
    }
    .sz-728x90 .box, .sz-468x60 .box {
      flex-direction: row; align-items: center; gap: 10px; padding: 6px 10px;
    }
    .sz-728x90 .copy, .sz-468x60 .copy { flex: 1; min-width: 0; }
    .sz-728x90 h1, .sz-468x60 h1 { font-size: 15px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sz-728x90 .lead, .sz-728x90 .fine, .sz-468x60 .lead, .sz-468x60 .fine { display: none; }
    .sz-728x90 .kicker, .sz-468x60 .kicker { margin: 0 0 2px; }
    .sz-728x90 .cta, .sz-468x60 .cta { min-height: 40px; line-height: 40px; padding: 0 16px; flex: 0 0 auto; font-size: 14px; }
    .sz-300x250 .box { padding: 14px; }
    @media (max-height: 80px) {
      .lead, .fine { display: none !important; }
      .box { flex-direction: row; align-items: center; gap: 10px; padding: 6px 10px; }
      h1 { font-size: 15px; margin: 0; }
      .cta { min-height: 40px; line-height: 40px; padding: 0 14px; flex: 0 0 auto; }
    }
  </style>
</head>
<body class="sz-${size}">
  <main class="box">
    <div class="copy">
      <p class="kicker">VIRALREFER ULTRA${camp.camp ? ` · ${escapeText(camp.camp)}` : ''}</p>
      <h1>${ref ? 'A friend sent you' : 'Paste a site. Climb.'}</h1>
      <p class="lead">Visits do not count. Open Get my link — no email. TE hits never take #1.</p>
    </div>
    <a class="cta" id="go" href="${escapeText(open)}" target="_top" rel="noopener">${cta}</a>
    <p class="fine">Tags stay on the URL if cookies are blocked.</p>
  </main>
  <script>
    (function () {
      var a = document.getElementById('go');
      a.addEventListener('click', function () {
        try {
          if (window.sessionStorage) {
            window.sessionStorage.setItem('vr-ultra-attr-v1', JSON.stringify({
              ref: ${JSON.stringify(ref)}, url: '', src: 'te', camp: ${JSON.stringify(camp.camp)}, te: true
            }));
          }
        } catch (e) {}
      });
    })();
  </script>
</body>
</html>`;
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export const TE_FRAME_HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors *",
};
