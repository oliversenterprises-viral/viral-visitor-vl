import { RUNG_COPY, RUNG_ORDER, type BoardSite, type Rung } from '../functions/_lib/engine';
import {
  currentHealthNote,
  currentTransport,
  fetchBoard,
  fetchEmbed,
  fetchMe,
  isDegraded,
  joinSite,
  probeHealth,
  simulateFriend,
} from './api';
import { burst, celebrateUnlock } from './celebrate';
import { copyText, intents, nativeShare, qrSvg } from './share';
import { track } from './track';
import type { BoardState, JoinOk, PublicPlayer } from './types';

const RUNG_HINT: Record<Rung, string> = {
  entered: 'Just entered · 15 min chip after you paste a site',
  rising: 'Rising · 1 unique friend tap',
  challenger: 'Challenger · 2 unique friends this week',
  banner: '#1 banner · 3 unique friends this week + top of the race',
};

function qs(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hostOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function toast(message: string): void {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('on');
  setTimeout(() => el?.classList.remove('on'), 2200);
}

function siteCard(site: BoardSite): string {
  return `<article class="site-card">
    <b>${escapeHtml(site.label)}</b>
    <div class="stats">
      <span>${site.weeklyCredits} this week</span>
      <span>${site.credits} unique</span>
      ${site.heat ? `<span class="heat">${site.heat} heat</span>` : ''}
      ${site.streak ? `<span>${site.streak}d streak</span>` : ''}
    </div>
  </article>`;
}

function lane(title: string, sub: string, sites: BoardSite[], empty: string): string {
  return `<section class="lane">
    <h3>${title}</h3>
    <div class="sub">${sub}</div>
    ${sites.length ? `<div class="row">${sites.map(siteCard).join('')}</div>` : `<p class="empty-lane">${empty}</p>`}
  </section>`;
}

function rungMeter(current: Rung): string {
  return `<div class="rungs">${RUNG_ORDER.map((rung) => {
    const on = RUNG_ORDER.indexOf(current) >= RUNG_ORDER.indexOf(rung);
    const now = current === rung;
    return `<div class="rung${on ? ' on' : ''}${now ? ' now' : ''}"><span>${RUNG_COPY[rung].title}</span><span>${RUNG_HINT[rung]}</span></div>`;
  }).join('')}</div>`;
}

export function boot(root: HTMLElement): void {
  let board: BoardState | null = null;
  let me: PublicPlayer | null = null;
  let shareUrl = '';
  let rung: Rung = 'entered';
  let siteHost = '';
  let kitOpen = false;

  const startUrl = qs('url') || '';
  const startRef = (qs('ref') || '').toUpperCase();
  const startKit = (qs('kit') || '').toUpperCase();

  root.innerHTML = `
    <header class="top">
      <div class="word">ViralRefer <span>Ultra</span></div>
      <div class="pills">
        <span class="pill live" data-live>LIVE</span>
        <span class="pill warn" hidden data-demo>DEMO</span>
      </div>
    </header>
    <section class="hero">
      <p class="kicker">CLOUDFLARE · ANY SITE · NO EMAIL</p>
      <h1>Paste a site.<br>Make it <em>feel</em> viral.</h1>
      <p class="lead">Instant personal share link. Friends tap Get my link. The site climbs Just entered → Rising → Challenger → #1. Visits never count.</p>
      <div class="ref-banner" data-ref-banner hidden></div>
    </section>
    <form class="paste" data-form>
      <div class="paste-box">
        <input data-url type="url" inputmode="url" autocomplete="url" required placeholder="https://yoursite.com" value="${escapeHtml(startUrl)}"/>
        <button class="btn volt" type="submit" data-submit>Get my link</button>
      </div>
      <p class="fine" data-health>Free core. No cash prizes. Unique friend actions only.</p>
    </form>
    <section class="banner-stage empty" data-banner></section>
    <div class="lanes" data-lanes></div>
    <div class="grid-2">
      <section class="lane">
        <h3>Weekly race</h3>
        <div class="sub">UTC week. Unique friend taps only — not raw visits.</div>
        <div data-duel></div>
        <ol class="race-row" data-race></ol>
      </section>
      <section class="lane">
        <h3>Live heat</h3>
        <div class="sub">Realtime-ish · polls every 8s · no fake counts</div>
        <ol class="activity" data-activity></ol>
      </section>
    </div>
    <section class="lane">
      <h3>Kingmakers</h3>
      <div class="sub">Non-cash. If someone you referred hits #1, you get the intro.</div>
      <div data-kings></div>
    </section>
    <section class="lane embed">
      <h3>Free embed — Help us go viral</h3>
      <p class="sub">Drop this on any site. One tap opens the join path.</p>
      <pre data-embed>&lt;script async src="/embed.js" data-site="yoursite.com"&gt;&lt;/script&gt;</pre>
      <button class="btn ghost" type="button" data-copy-embed>Copy snippet</button>
    </section>
    <section class="lane faq">
      <h3>How the loop works</h3>
      <details open><summary>What counts?</summary><p>A unique friend opening your link and tapping Get my link. Refreshing, copying, or visiting does not count.</p></details>
      <details><summary>Is it free / are there cash prizes?</summary><p>The core is free. Recognition only — #1 banner energy, rungs, streaks, kingmaker. No cash, no fake testimonials, no invented MRR.</p></details>
      <details><summary>Do I need email?</summary><p>No. Public join is cookie + your site URL.</p></details>
    </section>
    <footer class="foot">
      ViralRefer Ultra is a Cloudflare Pages + KV demo in <code>cf-ultra/</code>. It does not replace the live Vercel Site Drops app.
      <a href="/admin/">Owner HQ</a>
      Deploy only after you create a separate Pages project and bind <code>BOARD</code> KV. Production custom-domain cutover needs explicit approval.
    </footer>
    <aside class="kit" data-kit>
      <div class="kit-head">
        <div>
          <p class="kicker">YOUR SHARE KIT</p>
          <h2 style="margin:4px 0 0;font-family:var(--display)">One tap. Real climb.</h2>
        </div>
        <button class="btn ghost" type="button" data-close-kit>Close</button>
      </div>
      <div class="og-card" data-og></div>
      <div class="share-link">
        <input data-share-url readonly />
        <button class="btn volt" type="button" data-copy>Copy</button>
      </div>
      <div class="intents" data-intents></div>
      <div class="qr-wrap" data-qr></div>
      <div data-meter></div>
      <p class="fine" data-kit-note></p>
      <button class="btn ice" type="button" hidden data-simulate>Simulate a unique friend (demo)</button>
    </aside>
  `;

  const form = root.querySelector('[data-form]') as HTMLFormElement;
  const urlInput = root.querySelector('[data-url]') as HTMLInputElement;
  const submit = root.querySelector('[data-submit]') as HTMLButtonElement;
  const demoPill = root.querySelector('[data-demo]') as HTMLElement;
  const healthEl = root.querySelector('[data-health]') as HTMLElement;
  const refBanner = root.querySelector('[data-ref-banner]') as HTMLElement;
  const bannerEl = root.querySelector('[data-banner]') as HTMLElement;
  const lanesEl = root.querySelector('[data-lanes]') as HTMLElement;
  const duelEl = root.querySelector('[data-duel]') as HTMLElement;
  const raceEl = root.querySelector('[data-race]') as HTMLElement;
  const activityEl = root.querySelector('[data-activity]') as HTMLElement;
  const kingsEl = root.querySelector('[data-kings]') as HTMLElement;
  const embedEl = root.querySelector('[data-embed]') as HTMLElement;
  const kit = root.querySelector('[data-kit]') as HTMLElement;

  if (startRef) {
    refBanner.hidden = false;
    refBanner.textContent = `You landed via ${startRef}. Get your link to credit them — opening this page does not count.`;
  }

  function setDemo(on: boolean): void {
    demoPill.hidden = !on;
    healthEl.textContent = currentHealthNote();
    const sim = kit.querySelector('[data-simulate]') as HTMLButtonElement;
    sim.hidden = !on || !me;
  }

  function renderBoard(next: BoardState): void {
    board = next;
    if (next.banner) {
      bannerEl.classList.remove('empty');
      bannerEl.innerHTML = `<div class="pulse"></div>
        <p class="kicker">#1 BANNER ENERGY</p>
        <h2>${escapeHtml(next.banner.label)}</h2>
        <div class="meta">
          <span>${next.banner.weeklyCredits} unique friends this week</span>
          <span>${next.banner.credits} all-time locks</span>
          ${next.banner.heat ? `<span class="heat">${next.banner.heat} heat / 24h</span>` : ''}
        </div>`;
    } else {
      bannerEl.classList.add('empty');
      bannerEl.innerHTML = `<p class="kicker">BANNER OPEN</p><h2>Nobody owns #1 this week.</h2><p class="lead">3 unique friend taps + the weekly lead takes the banner. Recognition only.</p>`;
    }

    lanesEl.innerHTML =
      lane('Just entered', '15 minutes after a site is pasted. No friend tap yet.', next.entered, 'Open. Paste a site to take a chip.') +
      lane('Rising', '1 unique friend Get-my-link. Holds 1 hour after the last lock.', next.rising, 'Waiting on a real unique friend tap.') +
      lane('Challenger', '#2 / #3 this week with 2+ unique locks.', next.challenger, 'Race is open. Two weekly locks put you on the strip.');

    if (next.duel) {
      duelEl.innerHTML = `<div class="duel">
        <div><strong>${escapeHtml(next.duel.a.label)}</strong><small>${next.duel.a.weeklyCredits} this week</small></div>
        <div class="vs">VS</div>
        <div style="text-align:right"><strong>${escapeHtml(next.duel.b.label)}</strong><small>${next.duel.gap} behind</small></div>
      </div>`;
    } else {
      duelEl.innerHTML = `<p class="empty-lane">Need two sites in the weekly race to spark a duel.</p>`;
    }

    raceEl.innerHTML = next.race.length
      ? next.race
          .map(
            (s, i) =>
              `<li><span>#${i + 1} ${escapeHtml(s.label)}</span><span>${s.weeklyCredits} · ${s.rung}</span></li>`,
          )
          .join('')
      : `<li><span>Board is empty and honest.</span><span>0</span></li>`;

    activityEl.innerHTML = next.activity.length
      ? next.activity
          .slice(0, 8)
          .map((e) => `<li><span>${escapeHtml(e.text)}</span><span>${new Date(e.at).toLocaleTimeString()}</span></li>`)
          .join('')
      : `<li><span>No live events yet. First unique tap writes the feed.</span><span></span></li>`;

    kingsEl.innerHTML = next.kingmakers.length
      ? `<ol class="activity">${next.kingmakers
          .map((k) => `<li><span>${escapeHtml(k.host)} introduced #1 ${escapeHtml(k.winnerLabel)}</span><span>Kingmaker</span></li>`)
          .join('')}</ol>`
      : `<p class="empty-lane">Kingmaker unlocks when a person you referred hits the banner.</p>`;
  }

  function openKit(data: { player: PublicPlayer; shareUrl: string; rung: Rung; siteHost: string; demoMode: boolean }): void {
    me = data.player;
    shareUrl = data.shareUrl;
    rung = data.rung;
    siteHost = data.siteHost;
    kitOpen = true;
    kit.classList.add('open');
    const links = intents(shareUrl, siteHost, rung);
    (kit.querySelector('[data-share-url]') as HTMLInputElement).value = shareUrl;
    (kit.querySelector('[data-og]') as HTMLElement).innerHTML = `
      <p class="kicker">${escapeHtml(RUNG_COPY[rung].title)}</p>
      <div class="host">${escapeHtml(siteHost)}</div>
      <p>${data.player.credits} unique friend locks · ${data.player.weeklyCredits} this week · ${data.player.streakDays}d streak</p>
      <p class="fine">${escapeHtml(RUNG_COPY[rung].next)}</p>`;
    (kit.querySelector('[data-intents]') as HTMLElement).innerHTML = `
      <button class="btn" type="button" data-native>Device share</button>
      <a class="btn" href="${links.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn" href="${links.x}" target="_blank" rel="noopener">X</a>
      <a class="btn" href="${links.telegram}" target="_blank" rel="noopener">Telegram</a>
      <a class="btn" href="${links.reddit}" target="_blank" rel="noopener">Reddit</a>
      <button class="btn ghost" type="button" data-copy-msg>Copy message</button>`;
    (kit.querySelector('[data-qr]') as HTMLElement).innerHTML = qrSvg(shareUrl);
    (kit.querySelector('[data-meter]') as HTMLElement).innerHTML = rungMeter(rung);
    (kit.querySelector('[data-kit-note]') as HTMLElement).textContent =
      data.demoMode
        ? 'Demo: simulate a unique friend or open this link in another browser profile.'
        : 'Send the link. Only a unique Get my link credits you.';
    const sim = kit.querySelector('[data-simulate]') as HTMLButtonElement;
    sim.hidden = !data.demoMode;
    kit.querySelector('[data-native]')?.addEventListener('click', async () => {
      track('share', { platform: 'native' });
      const ok = await nativeShare(shareUrl, siteHost, rung);
      if (!ok) toast('Use a share button or copy the link');
    });
    kit.querySelector('[data-copy-msg]')?.addEventListener('click', async () => {
      track('share', { platform: 'copy' });
      await copyText(links.text);
      toast('Message copied');
    });
    kit.querySelectorAll('a.btn').forEach((a) => {
      a.addEventListener('click', () => {
        const href = (a as HTMLAnchorElement).href;
        const platform = href.includes('wa.me')
          ? 'whatsapp'
          : href.includes('twitter')
            ? 'x'
            : href.includes('t.me')
              ? 'telegram'
              : href.includes('reddit')
                ? 'reddit'
                : 'other';
        track('share', { platform });
      });
    });
    kit.querySelector('[data-qr]')?.addEventListener('click', () => track('share', { platform: 'qr' }));
  }

  function closeKit(): void {
    kitOpen = false;
    kit.classList.remove('open');
  }

  async function refreshEmbed(host: string): Promise<void> {
    try {
      const snip = await fetchEmbed(host);
      embedEl.textContent = snip.script;
    } catch {
      /* keep default */
    }
  }

  async function afterJoin(data: JoinOk): Promise<void> {
    renderBoard(data.board);
    setDemo(data.demoMode || currentTransport() === 'demo');
    openKit({
      player: data.player,
      shareUrl: data.shareUrl,
      rung: data.rung,
      siteHost: data.site.host,
      demoMode: data.demoMode || currentTransport() === 'demo',
    });
    await refreshEmbed(data.site.host);
    if (data.credited) toast('Unique friend lock counted');
    if (data.selfJoin) toast('Your own tap does not count');
    if (data.alreadyCredited) toast('That friend already counted');
    if (data.unlock) {
      celebrateUnlock(data.unlock);
    } else if (data.player.credits === 0) {
      burst(innerWidth / 2, 180);
    }
    if (data.kingmaker) toast(`Kingmaker: introduced ${data.kingmaker.winnerLabel}`);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    track('paste');
    submit.disabled = true;
    try {
      const data = await joinSite(urlInput.value, startRef || qs('ref'));
      await afterJoin(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not join');
    } finally {
      submit.disabled = false;
    }
  });

  kit.querySelector('[data-close-kit]')?.addEventListener('click', closeKit);
  kit.querySelector('[data-copy]')?.addEventListener('click', async () => {
    track('share', { platform: 'copy' });
    await copyText(shareUrl);
    toast('Link copied');
  });
  kit.querySelector('[data-simulate]')?.addEventListener('click', async () => {
    if (!me) return;
    try {
      const data = await simulateFriend(me.code);
      await afterJoin(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Simulate failed');
    }
  });
  root.querySelector('[data-copy-embed]')?.addEventListener('click', async () => {
    await copyText(embedEl.textContent || '');
    toast('Embed copied');
  });

  async function hydrate(): Promise<void> {
    track(startRef ? 'friend_land' : 'land');
    void fetch('/api/content')
      .then((r) => r.json())
      .then((c: { hero?: string; lead?: string }) => {
        if (c.hero) {
          const h = root.querySelector('.hero h1');
          if (h) h.innerHTML = escapeHtml(c.hero).replace(/\n/g, '<br>');
        }
        if (c.lead) {
          const p = root.querySelector('.hero .lead');
          if (p) p.textContent = c.lead;
        }
      })
      .catch(() => {});
    const health = await probeHealth();
    setDemo(!health || health.demoMode || currentTransport() === 'demo');
    try {
      const mine = await fetchMe();
      renderBoard(mine.board);
      setDemo(mine.demoMode || currentTransport() === 'demo');
      if (mine.player && mine.shareUrl && mine.site && mine.rung) {
        me = mine.player;
        if (startKit || qs('credited') || qs('unlock')) {
          openKit({
            player: mine.player,
            shareUrl: mine.shareUrl,
            rung: mine.rung,
            siteHost: mine.site.host,
            demoMode: mine.demoMode,
          });
        }
        await refreshEmbed(mine.site.host);
      } else {
        renderBoard(await fetchBoard());
      }
    } catch {
      renderBoard({
        weekId: '',
        banner: null,
        entered: [],
        rising: [],
        challenger: [],
        race: [],
        duel: null,
        kingmakers: [],
        activity: [],
        demoMode: true,
        livePlayers: 0,
        liveSites: 0,
      });
    }
    const unlock = qs('unlock') as Rung | null;
    if (unlock && RUNG_ORDER.includes(unlock) && siteHost) {
      celebrateUnlock({ rung: unlock, title: RUNG_COPY[unlock].title, shareText: RUNG_COPY[unlock].share, host: siteHost });
    }
  }

  void hydrate();

  let pollMs = 8000;
  const tickBoard = async (): Promise<void> => {
    if (!document.hidden) {
      try {
        const next = await fetchBoard();
        const prevBanner = board?.banner?.host;
        renderBoard(next);
        if (kitOpen && me) {
          const row = [next.banner, ...next.challenger, ...next.rising, ...next.entered, ...next.race].find(
            (s) => s && s.ownerCode === me!.code,
          );
          if (row) {
            (kit.querySelector('[data-meter]') as HTMLElement).innerHTML = rungMeter(row.rung);
          }
        }
        if (next.banner?.host && next.banner.host !== prevBanner && prevBanner !== undefined) {
          burst();
          toast(`${next.banner.label} took #1`);
        }
        pollMs = isDegraded() ? 16_000 : 8_000;
      } catch {
        pollMs = Math.min(30_000, pollMs + 4_000);
      }
    }
    window.setTimeout(tickBoard, pollMs);
  };
  window.setTimeout(tickBoard, pollMs);

  void kitOpen;
}
