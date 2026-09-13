import { isReferralCode } from './engine';
import { breakoutUrl, campaignFromSearch, type Campaign } from './campaign';
import { edgeI18nSnippet } from './i18n-edge';

export const CONVERSION_SPLASH_HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors *",
};

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/**
 * Full-viewport TE / human-breakout splash.
 * Site Drops DNA (dark zinc, violet/emerald CTA, hero energy, board tease) — not a homepage SPA clone.
 */
export function conversionSplashHtml(opts: { origin: string; url: URL }): string {
  const camp: Campaign = campaignFromSearch(opts.url.searchParams);
  const refRaw = (opts.url.searchParams.get('ref') || '').toUpperCase();
  const ref = isReferralCode(refRaw) ? refRaw : '';
  const open = breakoutUrl(opts.origin, camp, ref || null, opts.url.searchParams);
  const campLabel = camp.camp ? escapeText(camp.camp) : '';
  const src = camp.te ? 'te' : escapeText(camp.src || 'te');
  const size = escapeText((opts.url.searchParams.get('size') || '').slice(0, 16));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>Win the homepage — Get my link · ViralRefer Site Drops</title>
  <meta name="description" content="Get a free ViralRefer referral link. Opening this page does not count. Unique friends tapping Get my link climb the board. Recognition only. No cash prize."/>
  <meta name="robots" content="noindex, nofollow"/>
  <meta name="theme-color" content="#09090b"/>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; min-height: 100%;
      background: #09090b; color: #f4f4f5;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }
    body { min-height: 100dvh; }
    a { color: #c4b5fd; }
    .nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,.1);
      background: rgba(9,9,11,.82); backdrop-filter: blur(12px);
      position: sticky; top: 0; z-index: 4;
    }
    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: #fff; min-width: 0; }
    .mark {
      width: 36px; height: 36px; border-radius: 14px; background: #7c3aed;
      display: grid; place-items: center; font-weight: 800; font-size: 20px; flex: 0 0 auto;
    }
    .word { font-weight: 700; letter-spacing: -.04em; font-size: 22px; }
    .vr-lang-picker { margin: 0; }
    .vr-lang-select {
      appearance: none; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18);
      color: #e4e4e7; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 6px 20px 6px 10px;
    }
    .vr-lang-select option { background: #18181b; }
    .shell { max-width: 720px; margin: 0 auto; padding: 20px 16px 48px; }
    .hero {
      position: relative; overflow: hidden; text-align: center;
      border-radius: 28px; padding: 28px 20px 32px;
      background: linear-gradient(145deg, #0a0a12 0%, #151528 38%, #1e1b4b 72%, #312e81 100%);
      box-shadow: 0 24px 60px rgba(0,0,0,.45);
    }
    .hero::before {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(circle at 20% 30%, rgba(133,76,255,.28) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(5,150,105,.16) 0%, transparent 55%);
    }
    .hero > * { position: relative; }
    .badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2);
      color: #e0e7ff; font-size: 11px; font-weight: 700; letter-spacing: .04em;
      padding: 7px 14px; border-radius: 999px; margin-bottom: 16px;
    }
    .kicker { color: #c4b5fd; letter-spacing: .16em; font-size: 11px; font-weight: 800; margin: 0 0 8px; }
    h1 {
      margin: 0 0 12px; color: #fff; letter-spacing: -.05em; line-height: 1.05;
      font-size: clamp(2rem, 8vw, 3.6rem); font-weight: 800; text-shadow: 0 2px 10px rgba(0,0,0,.3);
    }
    .subline { display: block; font-size: .62em; font-weight: 700; }
    .accent { color: #c084fc; }
    .lead { margin: 0 auto 18px; max-width: 34rem; color: #e4e4e7; font-size: 17px; line-height: 1.5; }
    .slot {
      text-align: left; margin: 0 auto 16px; max-width: 22rem;
      border: 1px solid rgba(255,255,255,.15); border-radius: 16px; background: rgba(0,0,0,.4); overflow: hidden;
    }
    .slot-kicker {
      display: flex; justify-content: space-between; gap: 8px;
      padding: 6px 12px; background: rgba(255,255,255,.05); border-bottom: 1px solid rgba(255,255,255,.1);
      font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #a1a1aa;
    }
    .slot-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px 8px; }
    .slot-mark {
      width: 36px; height: 36px; border-radius: 10px; background: rgba(124,58,237,.35);
      display: grid; place-items: center; font-weight: 800; color: #ddd6fe;
    }
    .slot-host { font-weight: 700; color: #fff; }
    .slot-open { color: #86efac; font-size: 12px; font-weight: 700; margin-left: 6px; }
    .slot-note { margin: 0 16px 12px; color: #a1a1aa; font-size: 12px; line-height: 1.4; }
    .rungs { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 0 0 16px; }
    .rung {
      border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06);
      border-radius: 999px; padding: 6px 10px; font-size: 12px; color: #d4d4d8;
    }
    .rung b { color: #fff; font-weight: 700; }
    .rung[data-live="1"] { border-color: rgba(52,211,153,.45); color: #a7f3d0; }
    .urgency { margin: 0 0 6px; color: #fde68a; font-weight: 700; font-size: 15px; }
    .clock { margin: 0 0 8px; color: #fcd34d; font-weight: 700; font-size: 14px; }
    .proof { margin: 0 0 16px; color: #d4d4d8; font-size: 14px; }
    .cta {
      display: block; width: 100%; max-width: 400px; margin: 0 auto;
      text-align: center; text-decoration: none; font-weight: 800; color: #fff;
      min-height: 56px; line-height: 56px; border-radius: 18px; font-size: 18px;
      background: linear-gradient(90deg, #059669, #7c3aed);
      box-shadow: 0 12px 40px rgba(124,58,237,.45), 0 0 0 1px rgba(167,139,250,.25);
    }
    .cta:focus-visible { outline: 2px solid #c4b5fd; outline-offset: 3px; }
    .trust { margin: 14px 0 0; color: #d4d4d8; font-size: 14px; }
    .fine { margin: 6px 0 0; color: #a1a1aa; font-size: 12px; line-height: 1.45; }
    .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 16px 0 0; color: #a1a1aa; font-size: 12px; }
    .peek {
      margin-top: 18px; text-align: left; border-radius: 18px;
      border: 1px solid rgba(255,255,255,.1); background: rgba(0,0,0,.28); padding: 14px 16px;
    }
    .peek-kicker { color: #86efac; font-size: 11px; font-weight: 800; letter-spacing: .1em; }
    .peek h2 { margin: 6px 0 8px; font-size: 16px; }
    .peek ul { margin: 0; padding: 0; list-style: none; }
    .peek li { color: #d4d4d8; font-size: 13px; padding: 4px 0; border-top: 1px solid rgba(255,255,255,.06); }
    .peek .empty { color: #a1a1aa; font-size: 13px; margin: 0; }
    .legal { margin: 18px 8px 0; color: #71717a; font-size: 12px; line-height: 1.5; text-align: center; }
    @media (max-width: 420px) {
      .hero { padding: 22px 14px 26px; border-radius: 22px; }
      .cta { min-height: 52px; line-height: 52px; font-size: 17px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .cta { box-shadow: 0 8px 24px rgba(124,58,237,.35); }
    }
  </style>
</head>
<body>
  <header class="nav">
    <a class="brand" href="${escapeText(open)}" target="_top" rel="noopener">
      <span class="mark" aria-hidden="true">V</span>
      <span class="word">ViralRefer</span>
    </a>
    <div id="vr-embed-lang-slot"></div>
  </header>
  <main class="shell">
    <section class="hero">
      <p class="kicker"><span data-i18n="te.kicker">VIRALREFER · SITE DROPS</span>${campLabel ? ` · ${campLabel}` : ''}</p>
      <div class="badge">WORLDWIDE · FREE · NO SIGNUP</div>
      <h1>
        <span>Win the homepage.</span>
        <span class="subline">#1 puts their site on <span class="accent">this page.</span></span>
      </h1>
      <p class="lead">Get a link. Send it. When a friend taps Get my link, your site can go live here — Rising drop, text line, then the banner.</p>
      <div class="slot" aria-label="Homepage banner slot">
        <div class="slot-kicker"><span>This homepage</span><span>viralrefer.app</span><span>7 days</span></div>
        <div class="slot-row">
          <div class="slot-mark" aria-hidden="true">#</div>
          <div>
            <span class="slot-host" id="slot-host">Your site here</span>
            <span class="slot-open" id="slot-open">open</span>
          </div>
        </div>
        <p class="slot-note" id="slot-note">Empty right now. #1 this week puts their site here.</p>
      </div>
      <div class="rungs" aria-label="Site Drop ladder">
        <span class="rung" id="rung-entered"><b>Just entered</b> · open</span>
        <span class="rung" id="rung-rising"><b>Rising</b> · open</span>
        <span class="rung" id="rung-challenger"><b>Challenger</b> · open</span>
      </div>
      <p class="urgency">This week's #1 (not the owner) with 3 friends gets the 7-day banner.</p>
      <p class="clock" id="week-clock" aria-live="polite"></p>
      <p class="proof" id="board-proof">Board is open · #1 is open</p>
      <a class="cta" id="go" href="${escapeText(open)}" target="_top" rel="noopener" data-i18n="embed.go">Get my link</a>
      <p class="trust" data-i18n="te.lead">Visits do not count. Open Get my link — no email. TE hits never take #1.</p>
      <p class="fine" data-i18n="te.fine">Tags stay on the URL if cookies are blocked.</p>
      <p class="chips">Open worldwide · 18+ · No email · Recognition only · No cash prize</p>
      <aside class="peek" aria-live="polite">
        <div class="peek-kicker">LIVE · WEEK RACE</div>
        <h2>Board peek</h2>
        <p class="empty" id="peek-empty">Verified credits only. Visiting this splash does not count. Unique Get my link does.</p>
        <ul id="peek-list" hidden></ul>
      </aside>
    </section>
    <p class="legal">Opening /splash or /te never writes a referral credit. TE-tagged Get my link still issues a share kit but does not climb Rising, Challenger, or #1 by default. Same VIRAL- codes as www.viralrefer.app. Not a bank, wallet, or investment app.</p>
  </main>
  <script>
    (function () {
      var camp = ${JSON.stringify(camp.camp)};
      var ref = ${JSON.stringify(ref)};
      var src = ${JSON.stringify(src)};
      var size = ${JSON.stringify(size)};
      var te = true;
      function sessionId() {
        try {
          var k = 'vr-ultra-session';
          var s = sessionStorage.getItem(k);
          if (!s) {
            s = Math.random().toString(16).slice(2) + Date.now().toString(16);
            sessionStorage.setItem(k, s);
          }
          return s;
        } catch (e) { return ''; }
      }
      function beacon(kind) {
        var q = new URLSearchParams(location.search || '');
        var body = JSON.stringify({
          kind: kind,
          src: src || q.get('src') || 'te',
          camp: camp || q.get('camp') || q.get('c') || '',
          te: te,
          utm: q.get('utm_source') || q.get('utm') || '',
          host: size ? ('splash:' + size) : 'splash',
          session: sessionId(),
          referrer: document.referrer || ''
        });
        try {
          fetch('/api/track', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: body,
            keepalive: true
          }).catch(function () {});
        } catch (e) {}
      }
      beacon('te_splash_view');
      var a = document.getElementById('go');
      function remember() {
        try {
          if (window.sessionStorage) {
            window.sessionStorage.setItem('vr-ultra-attr-v1', JSON.stringify({
              ref: ref, url: '', src: src || 'te', camp: camp, te: true
            }));
          }
        } catch (e) {}
        beacon('te_splash_cta');
      }
      if (a) {
        a.addEventListener('click', remember);
        a.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') remember();
        });
      }

      function mondayUtc(now) {
        var d = new Date(now);
        var day = d.getUTCDay();
        var add = day === 0 ? -6 : 1 - day;
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add);
      }
      function paintClock() {
        var el = document.getElementById('week-clock');
        if (!el) return;
        var now = Date.now();
        var left = mondayUtc(now) + 7 * 86400000 - now;
        if (left < 0) left = 0;
        var d = Math.floor(left / 86400000);
        var h = Math.floor((left % 86400000) / 3600000);
        var m = Math.floor((left % 3600000) / 60000);
        el.textContent = d > 0
          ? ("This week's race ends in " + d + "d " + h + "h. Send a friend, not a visit.")
          : ("This week's race ends in " + h + "h " + m + "m. Send a friend, not a visit.");
      }
      paintClock();

      function hostOf(row) {
        if (!row) return '';
        return String(row.host || row.label || '').replace(/^www\\./, '');
      }
      fetch('/api/board', { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (data) {
        var board = data && data.board;
        if (!board) return;
        var banner = board.banner;
        var lead = banner || (board.race && board.race[0]);
        var slot = document.getElementById('slot-host');
        var openEl = document.getElementById('slot-open');
        var note = document.getElementById('slot-note');
        var proof = document.getElementById('board-proof');
        if (lead && hostOf(lead)) {
          if (slot) slot.textContent = hostOf(lead);
          if (openEl) openEl.textContent = banner ? 'live' : 'racing';
          if (note) {
            note.textContent = banner
              ? "This week's #1 — recognition only. No cash prize."
              : 'Week race is live. Banner still open.';
          }
        }
        function mark(id, rows, label) {
          var el = document.getElementById(id);
          if (!el) return;
          var n = Array.isArray(rows) ? rows.length : 0;
          if (n) {
            el.setAttribute('data-live', '1');
            el.innerHTML = '<b>' + label + '</b> · live';
          }
        }
        mark('rung-entered', board.entered, 'Just entered');
        mark('rung-rising', board.rising, 'Rising');
        mark('rung-challenger', board.challenger, 'Challenger');
        if (proof) {
          proof.textContent = banner && hostOf(banner)
            ? (hostOf(banner) + ' holds the banner · week still open')
            : 'Board is open · #1 is open';
        }
        var list = document.getElementById('peek-list');
        var empty = document.getElementById('peek-empty');
        var rows = [];
        if (banner && hostOf(banner)) rows.push('#1 banner · ' + hostOf(banner));
        (board.challenger || []).slice(0, 2).forEach(function (row) {
          if (hostOf(row)) rows.push('Challenger · ' + hostOf(row));
        });
        (board.rising || []).slice(0, 2).forEach(function (row) {
          if (hostOf(row)) rows.push('Rising · ' + hostOf(row));
        });
        if (rows.length && list && empty) {
          empty.hidden = true;
          list.hidden = false;
          list.innerHTML = rows.map(function (t) { return '<li>' + t.replace(/</g, '') + '</li>'; }).join('');
        }
      }).catch(function () {});
    })();
  </script>
  ${edgeI18nSnippet({ picker: true })}
</body>
</html>`;
}
