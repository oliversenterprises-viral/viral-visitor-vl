import { CODE_RE } from './engine';
import { breakoutUrl, campaignFromSearch, type Campaign } from './campaign';

export function teSplashHtml(opts: { origin: string; url: URL; compact?: boolean }): string {
  const camp: Campaign = campaignFromSearch(opts.url.searchParams);
  const refRaw = (opts.url.searchParams.get('ref') || '').toUpperCase();
  const ref = CODE_RE.test(refRaw) ? refRaw : '';
  const open = breakoutUrl(opts.origin, camp, ref || null);
  const iframeSrc = `${opts.origin}/te?src=te${camp.camp ? `&camp=${encodeURIComponent(camp.camp)}` : ''}${ref ? `&ref=${ref}` : ''}`;
  const compact = opts.compact || opts.url.searchParams.get('size') === '300x250';
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
    html, body { height: 100%; margin: 0; font-family: Outfit, ui-sans-serif, system-ui, sans-serif; background: #050508; color: #f4f1ea; }
    .box { min-height: 100%; display: flex; flex-direction: column; justify-content: center; padding: ${compact ? '10px' : '18px'}; }
    .kicker { color: #d6ff3e; letter-spacing: .16em; font-size: 11px; font-weight: 800; margin: 0 0 8px; }
    h1 { font-family: Syne, Outfit, sans-serif; font-size: ${compact ? 'clamp(20px, 8vw, 28px)' : 'clamp(26px, 7vw, 40px)'}; line-height: 1.05; margin: 0 0 8px; }
    p { color: #9a9588; font-size: ${compact ? '12px' : '14px'}; line-height: 1.45; margin: 0 0 14px; }
    .cta {
      display: block; text-align: center; text-decoration: none; font-weight: 800;
      min-height: 48px; line-height: 48px; border-radius: 14px; background: #d6ff3e; color: #071000; font-size: 16px;
    }
    .fine { margin: 10px 0 0; font-size: 12px; }
    a.fine { color: #3ee8ff; }
  </style>
</head>
<body>
  <main class="box">
    <p class="kicker">VIRALREFER ULTRA${camp.camp ? ` · ${escapeText(camp.camp)}` : ''}</p>
    <h1>${ref ? 'A friend sent you' : 'Paste a site. Make it climb.'}</h1>
    <p>Visits do not count. Tap Get my link — no email. Traffic-exchange hits never unlock the #1 banner.</p>
    <a class="cta" id="go" href="${escapeText(open)}" target="_top" rel="noopener">Get my link</a>
    <p class="fine">Opens the real funnel. Rotator impressions are not written.</p>
  </main>
  <script>
    (function () {
      var framed = false;
      try { framed = window.self !== window.top; } catch (e) { framed = true; }
      var a = document.getElementById('go');
      if (!framed) { a.removeAttribute('target'); }
      a.addEventListener('click', function () {
        try {
          if (!framed && window.sessionStorage) {
            window.sessionStorage.setItem('vr-ultra-attr-v1', JSON.stringify({
              ref: ${JSON.stringify(ref)}, url: '', src: 'te', camp: ${JSON.stringify(camp.camp)}, te: true
            }));
          }
        } catch (e) {}
      });
    })();
  </script>
  <!-- iframe snippet: <iframe src="${escapeText(iframeSrc)}" width="468" height="60" style="border:0"></iframe> -->
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
