import {
  RUNG_COPY,
  escapeHtml,
  escapeXml,
  faviconForHost,
  nextActionFor,
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
      <stop offset="0%" stop-color="#3b1d86"/>
      <stop offset="55%" stop-color="#1b1038"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1080" cy="80" r="220" fill="#864cff" fill-opacity="0.28"/>
  <circle cx="80" cy="560" r="180" fill="#fbbf24" fill-opacity="0.16"/>
  <text x="72" y="92" fill="#c4b5fd" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28" font-weight="700" letter-spacing="4">VIRALREFER · SITE DROPS</text>
  <text x="72" y="250" fill="#f4f4f5" font-family="ui-sans-serif,system-ui,sans-serif" font-size="68" font-weight="800">${host}</text>
  <text x="72" y="330" fill="#fde68a" font-family="ui-sans-serif,system-ui,sans-serif" font-size="36" font-weight="700">${rung}</text>
  <text x="72" y="420" fill="#f4f4f5" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28">${opts.credits} unique friend locks · ${opts.weekly} this week</text>
  <text x="72" y="560" fill="#a1a1aa" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22">${demo}</text>
  <rect x="820" y="470" width="300" height="72" rx="16" fill="#864cff"/>
  <text x="970" y="516" text-anchor="middle" fill="#ffffff" font-family="ui-sans-serif,system-ui,sans-serif" font-size="26" font-weight="800">GET MY LINK</text>
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
  const title = `You’re in the same contest as ${label}`;
  const desc = `Get YOUR link in one tap — same leaderboard. Tap Get my link to credit ${label}. Visits do not count.`;
  const shareUrl = `${opts.origin}/r/${opts.code}`;
  const og = `${opts.origin}/api/og?code=${encodeURIComponent(opts.code)}`;
  const credits = opts.site?.creditTimes.length ?? 0;
  const weekly = opts.boardSite?.weeklyCredits ?? 0;
  const next = nextActionFor({ credits, weeklyCredits: weekly, rung });
  const fav = opts.site?.host ? faviconForHost(opts.site.host) : '';
  const demo = opts.demoMode
    ? `<p class="demo">Demo mode — KV is not bound. Unique locks still work in this isolate.</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
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
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #09090b; color: #f4f4f5; }
    .wrap { min-height: 100dvh; padding: 28px 18px calc(48px + env(safe-area-inset-bottom, 0px)); max-width: 560px; margin: 0 auto; }
    .kicker { color: #c4b5fd; letter-spacing: .14em; font-size: 12px; font-weight: 700; }
    h1 { font-family: 'Space Grotesk', Inter, sans-serif; font-size: clamp(28px, 8vw, 44px); line-height: 1.05; margin: 12px 0 8px; }
    .who { display: flex; gap: 12px; align-items: center; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 22px; padding: 16px; margin: 18px 0; }
    .who img { width: 40px; height: 40px; border-radius: 12px; background: #09090b; }
    .rung { color: #fde68a; font-weight: 700; }
    .next { margin: 0 0 16px; padding: 12px 14px; border-radius: 16px; background: rgba(134,76,255,.14); border: 1px solid rgba(196,181,253,.35); font-weight: 700; }
    label { display: block; font-size: 13px; color: #a1a1aa; margin-bottom: 8px; }
    input { width: 100%; min-height: 52px; padding: 14px 16px; border-radius: 14px; border: 1px solid #27272a; background: #09090b; color: #f4f4f5; font-size: 16px; }
    button { width: 100%; min-height: 52px; margin-top: 12px; padding: 16px; border: 0; border-radius: 16px; background: #864cff; color: #fff; font-weight: 800; font-size: 17px; }
    button:disabled { opacity: .55; }
    .preview { display: none; align-items: center; gap: 10px; margin-top: 10px; color: #9a9588; font-size: 13px; }
    .preview.on { display: flex; }
    .preview img { width: 22px; height: 22px; border-radius: 6px; }
    .err { display: none; color: #ff3d8a; font-size: 14px; font-weight: 700; margin-top: 10px; }
    .err.on { display: block; }
    .fine { color: #9a9588; font-size: 13px; line-height: 1.5; }
    .demo { color: #ffc857; font-size: 13px; }
    a { color: #c4b5fd; }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="kicker">YOU’RE IN THE SAME CONTEST</div>
    <h1>Get YOUR link in one tap</h1>
    <p class="fine"><strong>Opening this page does not count.</strong> Paste <em>your</em> website and tap <strong>Get my link</strong> — that one tap credits ${label}. Same leaderboard. Visits and copies never count. No email.</p>
    <section class="who">
      ${fav ? `<img src="${escapeHtml(fav)}" alt="" width="40" height="40"/>` : ''}
      <div>
        <div class="rung">${escapeHtml(RUNG_COPY[rung].title)}</div>
        <strong>${label}</strong>
        <p class="fine" style="margin:4px 0 0">${credits} unique friend locks · ${weekly} this week</p>
      </div>
    </section>
    <p class="next">${escapeHtml(next.label)}</p>
    ${demo}
    <form id="join">
      <label for="url">Your website — you get your own share kit</label>
      <input id="url" name="url" type="url" inputmode="url" autocomplete="url" required placeholder="https://yoursite.com"/>
      <div class="preview" id="preview"><img id="pfav" alt=""/><span id="phost"></span></div>
      <button type="submit" id="go">Get my link</button>
      <p class="err" id="err" role="alert"></p>
    </form>
    <p class="fine">Free · no cash prize · unique friend taps only.</p>
  </main>
  <script>
    try { sessionStorage.setItem('vr-ultra-attr-v1', JSON.stringify({ ref: ${JSON.stringify(opts.code)}, url: '' })); } catch (e) {}
    fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'friend_land',host:${JSON.stringify(opts.site?.host || '')}})}).catch(()=>{});
    const input = document.getElementById('url');
    const preview = document.getElementById('preview');
    const phost = document.getElementById('phost');
    const pfav = document.getElementById('pfav');
    const err = document.getElementById('err');
    const btn = document.getElementById('go');
    function hostOf(raw) {
      try {
        const u = new URL(raw.indexOf('://') >= 0 ? raw : 'https://' + raw);
        return u.hostname.replace(/^www\\./, '');
      } catch (e) { return ''; }
    }
    input.addEventListener('input', () => {
      const h = hostOf(input.value.trim());
      if (!h || h.indexOf('.') < 0) { preview.className = 'preview'; return; }
      phost.textContent = h + ' — looks ready';
      pfav.src = 'https://icons.duckduckgo.com/ip3/' + encodeURIComponent(h) + '.ico';
      preview.className = 'preview on';
    });
    document.getElementById('join').addEventListener('submit', async (e) => {
      e.preventDefault();
      err.className = 'err';
      const url = input.value;
      btn.disabled = true;
      btn.textContent = 'Getting your link…';
      let last = 'Could not get your link. Try again.';
      for (let i = 0; i < 3; i++) {
        try {
          const res = await fetch('/api/join', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url, ref: ${JSON.stringify(opts.code)} })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || 'Join failed');
          const q = new URLSearchParams({ kit: data.player.code, ref: ${JSON.stringify(opts.code)} });
          if (data.credited) q.set('credited', '1');
          if (data.alreadyCredited) q.set('already', '1');
          if (data.selfJoin) q.set('self', '1');
          if (data.unlock) q.set('unlock', data.unlock.rung);
          if (${JSON.stringify(opts.site?.host || '')}) q.set('helped', ${JSON.stringify(opts.site?.host || '')});
          location.href = '/?' + q.toString();
          return;
        } catch (ex) {
          last = (ex && ex.message) || last;
          if (last.indexOf('Paste a real') >= 0 || last.indexOf('paused') >= 0) break;
          await new Promise((r) => setTimeout(r, 350 * (i + 1)));
        }
      }
      btn.disabled = false;
      btn.textContent = 'Try again — Get my link';
      err.textContent = last;
      err.className = 'err on';
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
      <strong>Help ${label} go viral</strong>
      <small>${opts.credits} unique locks · ${escapeHtml(RUNG_COPY[opts.rung].title)}</small>
    </div>
    <span class="go">Get my link</span>
  </a>
  <script>
    fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'embed_load',platform:'embed'})}).catch(()=>{});
    document.getElementById('go')?.addEventListener('click',()=>{
      fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'embed_click',platform:'embed'})}).catch(()=>{});
    });
  </script>
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
