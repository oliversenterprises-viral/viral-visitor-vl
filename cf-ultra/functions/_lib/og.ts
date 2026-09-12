import {
  RUNG_COPY,
  escapeHtml,
  escapeXml,
  type BoardSite,
  type Player,
  type Rung,
  type Site,
} from './engine';

export function ogImageSvg(opts: {
  host: string;
  rung: Rung;
  credits: number;
  weekly: number;
  demoMode: boolean;
}): string {
  const host = escapeXml(opts.host);
  const rung = escapeXml(RUNG_COPY[opts.rung].title);
  const demo = opts.demoMode ? 'DEMO MODE · KV not bound' : 'UNIQUE FRIEND LOCKS · VISITS DO NOT COUNT';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050508"/>
      <stop offset="55%" stop-color="#10131c"/>
      <stop offset="100%" stop-color="#1a1020"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1080" cy="80" r="220" fill="#d6ff3e" fill-opacity="0.12"/>
  <circle cx="80" cy="560" r="180" fill="#ff3d8a" fill-opacity="0.14"/>
  <text x="72" y="92" fill="#d6ff3e" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28" font-weight="700" letter-spacing="4">VIRALREFER ULTRA</text>
  <text x="72" y="250" fill="#f4f1ea" font-family="ui-sans-serif,system-ui,sans-serif" font-size="68" font-weight="800">${host}</text>
  <text x="72" y="330" fill="#3ee8ff" font-family="ui-sans-serif,system-ui,sans-serif" font-size="36" font-weight="700">${rung}</text>
  <text x="72" y="420" fill="#f4f1ea" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28">${opts.credits} unique friend locks · ${opts.weekly} this week</text>
  <text x="72" y="560" fill="#9a9588" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22">${demo}</text>
  <rect x="820" y="470" width="300" height="72" rx="16" fill="#d6ff3e"/>
  <text x="970" y="516" text-anchor="middle" fill="#050508" font-family="ui-sans-serif,system-ui,sans-serif" font-size="26" font-weight="800">GET MY LINK</text>
</svg>`;
}

export function landingHtml(opts: {
  origin: string;
  code: string;
  player: Player | null;
  site: Site | null;
  boardSite: BoardSite | null;
  demoMode: boolean;
}): string {
  const host = opts.site?.host ?? 'a site';
  const label = escapeHtml(opts.site?.label ?? host);
  const rung = opts.boardSite?.rung ?? 'entered';
  const title = `${label} is racing on ViralRefer Ultra`;
  const desc = `Tap Get my link to credit ${label}. Visits do not count. No email. No cash prize.`;
  const shareUrl = `${opts.origin}/r/${opts.code}`;
  const og = `${opts.origin}/api/og?code=${encodeURIComponent(opts.code)}`;
  const prefill = escapeHtml(opts.site?.url ?? '');
  const credits = opts.site?.creditTimes.length ?? 0;
  const weekly = opts.boardSite?.weeklyCredits ?? 0;
  const demo = opts.demoMode
    ? `<p class="demo">Demo mode — KV is not bound. Unique locks still work in this isolate.</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${escapeHtml(title)}"/>
  <meta property="og:description" content="${escapeHtml(desc)}"/>
  <meta property="og:url" content="${escapeHtml(shareUrl)}"/>
  <meta property="og:image" content="${escapeHtml(og)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escapeHtml(title)}"/>
  <meta name="twitter:description" content="${escapeHtml(desc)}"/>
  <meta name="twitter:image" content="${escapeHtml(og)}"/>
  <link rel="icon" href="/favicon.svg"/>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Outfit, ui-sans-serif, system-ui, sans-serif; background: #050508; color: #f4f1ea; }
    .wrap { min-height: 100vh; padding: 28px 18px 48px; max-width: 560px; margin: 0 auto; }
    .kicker { color: #d6ff3e; letter-spacing: .18em; font-size: 12px; font-weight: 700; }
    h1 { font-family: Syne, Outfit, sans-serif; font-size: clamp(28px, 8vw, 44px); line-height: 1.05; margin: 12px 0 8px; }
    .card { background: #10131c; border: 1px solid #2a2d3a; border-radius: 22px; padding: 20px; margin: 22px 0; }
    .rung { color: #3ee8ff; font-weight: 700; }
    label { display: block; font-size: 13px; color: #9a9588; margin-bottom: 8px; }
    input { width: 100%; padding: 14px 16px; border-radius: 14px; border: 1px solid #2a2d3a; background: #050508; color: #f4f1ea; font-size: 16px; }
    button { width: 100%; margin-top: 12px; padding: 16px; border: 0; border-radius: 14px; background: #d6ff3e; color: #050508; font-weight: 800; font-size: 16px; }
    .fine { color: #9a9588; font-size: 13px; line-height: 1.5; }
    .demo { color: #ffc857; font-size: 13px; }
    a { color: #3ee8ff; }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="kicker">VIRALREFER ULTRA</div>
    <h1>Help ${label} go viral</h1>
    <p class="fine">You landed on a personal share link. Tapping <strong>Get my link</strong> is the action that counts. Opening this page does not.</p>
    <section class="card">
      <div class="rung">${escapeHtml(RUNG_COPY[rung].title)}</div>
      <p>${credits} unique friend locks · ${weekly} this week</p>
      <p class="fine">${escapeHtml(RUNG_COPY[rung].next)}</p>
      ${demo}
    </section>
    <form id="join">
      <label for="url">Your website — same race, your own link</label>
      <input id="url" name="url" type="url" inputmode="url" autocomplete="url" required value="${prefill}" placeholder="https://yoursite.com"/>
      <button type="submit">Get my link</button>
    </form>
    <p class="fine">Free · no email · no cash prize · unique friend taps only. <a href="/">Live board</a></p>
  </main>
  <script>
    const form = document.getElementById('join');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('url').value;
      const btn = form.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Locking your link…';
      try {
        const res = await fetch('/api/join', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url, ref: ${JSON.stringify(opts.code)} })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Join failed');
        const q = new URLSearchParams({ kit: data.player.code });
        if (data.credited) q.set('credited', '1');
        if (data.unlock) q.set('unlock', data.unlock.rung);
        location.href = '/?' + q.toString();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Get my link';
        alert(err.message || 'Could not join');
      }
    });
  </script>
</body>
</html>`;
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
    body { margin: 0; font-family: Outfit, ui-sans-serif, system-ui, sans-serif; background: #050508; color: #f4f1ea; }
    a { display: flex; align-items: center; justify-content: space-between; gap: 12px; text-decoration: none; color: inherit; padding: 14px 16px; border: 1px solid #2a2d3a; border-radius: 16px; background: #10131c; }
    strong { color: #d6ff3e; }
    small { color: #9a9588; }
    .go { background: #d6ff3e; color: #050508; font-weight: 800; border-radius: 10px; padding: 8px 10px; font-size: 13px; }
  </style>
</head>
<body>
  <a href="${escapeHtml(join)}" target="_blank" rel="noopener">
    <div>
      <strong>Help ${label} go viral</strong>
      <small>${opts.credits} unique locks · ${escapeHtml(RUNG_COPY[opts.rung].title)}</small>
    </div>
    <span class="go">Get my link</span>
  </a>
</body>
</html>`;
}

export function embedScript(origin: string): string {
  return `(function(){
  var s=document.currentScript;
  var host=(s && s.getAttribute('data-site')) || '';
  var t=document.createElement('iframe');
  t.src=${JSON.stringify(origin)}+'/e/'+encodeURIComponent(host);
  t.title='ViralRefer Ultra';
  t.style.cssText='width:100%;max-width:420px;height:88px;border:0;border-radius:16px;overflow:hidden;';
  t.loading='lazy';
  if(s&&s.parentNode)s.parentNode.insertBefore(t,s.nextSibling);
})();`;
}
