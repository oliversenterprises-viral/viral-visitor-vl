import { teDestination, teIframeSnippet } from '../functions/_lib/campaign';
import { RUNG_COPY, RUNG_ORDER, faviconForHost, nextActionFor, type BoardSite, type Rung } from '../functions/_lib/engine';
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
import {
  lastKnownCredits,
  persistAttribution,
  previewHost,
  rememberCredits,
  rememberKitOpen,
  shouldRestoreKit,
  syncAttributionToUrl,
} from './attr';
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

function siteCard(site: BoardSite, mineHost: string): string {
  const you = mineHost && site.host === mineHost;
  return `<article class="site-card${you ? ' you' : ''}">
    ${you ? '<span class="you-chip">You’re here</span>' : ''}
    <b>${escapeHtml(site.label)}</b>
    <div class="stats">
      <span>${site.weeklyCredits} this week</span>
      <span>${site.credits} unique</span>
      ${site.heat ? `<span class="heat">${site.heat} heat</span>` : ''}
      ${site.streak ? `<span>${site.streak}d streak</span>` : ''}
    </div>
  </article>`;
}

function lane(title: string, sub: string, sites: BoardSite[], empty: string, mineHost: string): string {
  return `<section class="lane">
    <h3>${title}</h3>
    <div class="sub">${sub}</div>
    ${sites.length ? `<div class="row">${sites.map((s) => siteCard(s, mineHost)).join('')}</div>` : `<p class="empty-lane">${empty}</p>`}
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

  const attr = persistAttribution(qs('ref'), qs('url'), qs('src') || qs('utm_source'), qs('camp') || qs('c'));
  syncAttributionToUrl(attr);
  const startUrl = qs('url') || attr.url || '';
  const startRef = (qs('ref') || attr.ref || '').toUpperCase();
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
      <p class="lead">Paste any website. Get your link. A unique friend taps Get my link. The site climbs Just entered → Rising → Challenger → #1. Visits and copies never count.</p>
      <div class="ref-banner" data-ref-banner hidden></div>
    </section>
    <form class="paste" data-form>
      <div class="paste-box">
        <input data-url type="url" inputmode="url" autocomplete="url" required placeholder="https://yoursite.com" value="${escapeHtml(startUrl)}"/>
        <button class="btn volt" type="submit" data-submit>Get my link</button>
      </div>
      <div class="url-preview" data-preview hidden>
        <img data-favicon alt="" width="24" height="24"/>
        <div>
          <strong data-preview-host></strong>
          <span>Looks ready. Opening a page does not count — only a friend’s Get my link.</span>
        </div>
      </div>
      <p class="form-err" data-form-err hidden role="alert"></p>
      <p class="next-action" data-next hidden></p>
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
    <details class="lane embed">
      <summary>Free embed — Help us go viral</summary>
      <p class="sub">Secondary. The loop above is the product: paste → Get my link → share → friend Get my link.</p>
      <pre data-embed>&lt;script async src="/embed.js" data-site="yoursite.com"&gt;&lt;/script&gt;</pre>
      <button class="btn ghost" type="button" data-copy-embed>Copy snippet</button>
    </details>
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
      <p class="kit-status" data-kit-status hidden></p>
      <div class="og-card" data-og></div>
      <p class="next-action kit-next" data-kit-next></p>
      <div class="share-link">
        <input data-share-url readonly aria-label="Your share link"/>
        <button class="btn volt primary-cta" type="button" data-copy>Copy link</button>
      </div>
      <button class="btn volt primary-cta native-share" type="button" hidden data-native>Share</button>
      <details class="more-share">
        <summary>More ways to send</summary>
        <div class="intents" data-intents></div>
        <div class="qr-wrap" data-qr></div>
      </details>
      <div data-meter></div>
      <p class="fine" data-kit-note></p>
      <button class="btn ghost" type="button" data-te-copy>Promote on traffic exchanges</button>
      <button class="btn ghost" type="button" data-te-iframe>Copy TE iframe</button>
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
  const previewEl = root.querySelector('[data-preview]') as HTMLElement;
  const previewHostEl = root.querySelector('[data-preview-host]') as HTMLElement;
  const faviconEl = root.querySelector('[data-favicon]') as HTMLImageElement;
  const formErr = root.querySelector('[data-form-err]') as HTMLElement;
  const nextEl = root.querySelector('[data-next]') as HTMLElement;

  if (startRef) {
    const helped = qs('helped');
    refBanner.hidden = false;
    refBanner.textContent = helped
      ? `A friend sent you here to help ${helped}. Paste your site and tap Get my link — opening this page does not count.`
      : `A friend sent you here (${startRef}). Paste your site and tap Get my link to credit them. Opening this page does not count.`;
  }

  function setDemo(on: boolean): void {
    demoPill.hidden = !on;
    healthEl.textContent = currentHealthNote();
    const sim = kit.querySelector('[data-simulate]') as HTMLButtonElement;
    sim.hidden = !on || !me;
  }

  function renderBoard(next: BoardState): void {
    board = next;
    const mineHost = me?.siteHost || siteHost;
    if (next.banner) {
      const you = mineHost && next.banner.host === mineHost;
      bannerEl.classList.remove('empty');
      bannerEl.innerHTML = `<div class="pulse"></div>
        <p class="kicker">${you ? 'YOU HOLD #1' : '#1 BANNER ENERGY'}</p>
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
      lane('Just entered', '15 minutes after a site is pasted. No friend tap yet.', next.entered, 'Open. Paste a site to take a chip.', mineHost) +
      lane('Rising', '1 unique friend Get-my-link. Holds 1 hour after the last lock.', next.rising, 'Waiting on a real unique friend tap.', mineHost) +
      lane('Challenger', '#2 / #3 this week with 2+ unique locks.', next.challenger, 'Race is open. Two weekly locks put you on the strip.', mineHost);

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
          .map((s, i) => {
            const you = mineHost && s.host === mineHost;
            return `<li class="${you ? 'you' : ''}"><span>#${i + 1} ${escapeHtml(s.label)}${you ? ' · you’re here' : ''}</span><span>${s.weeklyCredits} · ${s.rung}</span></li>`;
          })
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

  function paintNext(player: PublicPlayer, current: Rung): void {
    const action = nextActionFor({ credits: player.credits, weeklyCredits: player.weeklyCredits, rung: current });
    nextEl.hidden = false;
    nextEl.textContent = action.label;
    const kitNext = kit.querySelector('[data-kit-next]') as HTMLElement;
    kitNext.textContent = action.label;
  }

  function openKit(data: { player: PublicPlayer; shareUrl: string; rung: Rung; siteHost: string; demoMode: boolean }): void {
    me = data.player;
    shareUrl = data.shareUrl;
    rung = data.rung;
    siteHost = data.siteHost;
    kitOpen = true;
    rememberKitOpen(true);
    rememberCredits(data.player.credits);
    kit.classList.add('open');
    const links = intents(shareUrl, siteHost, rung);
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const nativeBtn = kit.querySelector('[data-native]') as HTMLButtonElement;
    nativeBtn.hidden = !canShare;
    const copyBtn = kit.querySelector('[data-copy]') as HTMLButtonElement;
    copyBtn.classList.toggle('volt', !canShare);
    copyBtn.classList.toggle('ghost', canShare);
    (kit.querySelector('[data-share-url]') as HTMLInputElement).value = shareUrl;
    (kit.querySelector('[data-og]') as HTMLElement).innerHTML = `
      <p class="kicker">${escapeHtml(RUNG_COPY[rung].title)}</p>
      <div class="og-row">
        <img src="${escapeHtml(faviconForHost(siteHost))}" alt="" width="36" height="36"/>
        <div class="host">${escapeHtml(siteHost)}</div>
      </div>
      <p>${data.player.credits} unique friend locks · ${data.player.weeklyCredits} this week · ${data.player.streakDays}d streak</p>`;
    paintNext(data.player, rung);
    (kit.querySelector('[data-intents]') as HTMLElement).innerHTML = `
      <a class="btn" href="${links.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn" href="${links.x}" target="_blank" rel="noopener">X</a>
      <a class="btn" href="${links.telegram}" target="_blank" rel="noopener">Telegram</a>
      <a class="btn" href="${links.reddit}" target="_blank" rel="noopener">Reddit</a>
      <button class="btn ghost" type="button" data-copy-msg>Copy message</button>`;
    (kit.querySelector('[data-qr]') as HTMLElement).innerHTML = qrSvg(shareUrl);
    (kit.querySelector('[data-meter]') as HTMLElement).innerHTML = rungMeter(rung);
    (kit.querySelector('[data-kit-note]') as HTMLElement).textContent =
      data.demoMode
        ? 'Demo: simulate a unique friend or open this link in another browser. Visits still do not count.'
        : 'Send the link. Only a unique friend’s Get my link credits you.';
    const sim = kit.querySelector('[data-simulate]') as HTMLButtonElement;
    sim.hidden = !data.demoMode;
    nativeBtn.onclick = async () => {
      track('share', { platform: 'native', host: siteHost });
      const ok = await nativeShare(shareUrl, siteHost, rung);
      if (!ok) toast('Copy the link instead');
    };
    kit.querySelector('[data-copy-msg]')?.addEventListener('click', async () => {
      track('share', { platform: 'copy', host: siteHost });
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
        track('share', { platform, host: siteHost });
      });
    });
    kit.querySelector('[data-qr]')?.addEventListener('click', () => track('share', { platform: 'qr', host: siteHost }));
  }

  function closeKit(): void {
    kitOpen = false;
    rememberKitOpen(false);
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

  function showFormError(message: string): void {
    formErr.hidden = false;
    formErr.textContent = message;
  }

  function paintPreview(raw: string): void {
    const host = previewHost(raw);
    if (!host) {
      previewEl.hidden = true;
      return;
    }
    previewEl.hidden = false;
    previewHostEl.textContent = host;
    faviconEl.src = faviconForHost(host);
    faviconEl.alt = host;
  }

  async function afterJoin(data: JoinOk): Promise<void> {
    persistAttribution(startRef || qs('ref'), data.site.url, attr.src, attr.camp);
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
    const status = kit.querySelector('[data-kit-status]') as HTMLElement;
    status.hidden = false;
    if (data.selfJoin) {
      status.textContent = 'Your own tap does not count. Send this link to someone else.';
      toast('Your own tap does not count');
    } else if (data.teIgnored) {
      status.textContent = 'TE / rotator traffic does not count as a unique credit. Your link is still live — send it to a real friend.';
      toast('TE hit ignored — visits never climb the board');
    } else if (data.alreadyCredited) {
      status.textContent = 'That friend already counted. One unique Get my link per person.';
      toast('That friend already counted');
    } else if (data.credited) {
      const helped = qs('helped') || data.referrerCode || 'your friend';
      status.textContent = `You credited ${helped}. Here’s your kit — send it next.`;
      toast('Unique friend lock counted');
      burst();
    } else {
      status.textContent = 'Your link is live. Send it — visits do not count.';
    }
    if (data.unlock) {
      celebrateUnlock(data.unlock);
    } else if (data.player.credits === 0 && !data.selfJoin && !data.alreadyCredited) {
      burst(innerWidth / 2, 180);
    }
    if (data.kingmaker) toast(`Kingmaker: introduced ${data.kingmaker.winnerLabel}`);
    if (data.degraded) toast('Saved in this session — board sync is catching up');
  }

  urlInput.addEventListener('input', () => {
    formErr.hidden = true;
    paintPreview(urlInput.value);
  });
  paintPreview(urlInput.value);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formErr.hidden = true;
    const host = previewHost(urlInput.value);
    track('paste', { host: host || undefined });
    persistAttribution(startRef || qs('ref'), urlInput.value, attr.src, attr.camp);
    submit.disabled = true;
    submit.textContent = 'Getting your link…';
    try {
      const data = await joinSite(urlInput.value, startRef || qs('ref') || attr.ref, { src: attr.src, camp: attr.camp });
      submit.textContent = 'Get my link';
      await afterJoin(data);
    } catch (err) {
      submit.textContent = 'Try again — Get my link';
      showFormError(err instanceof Error ? err.message : 'Could not get your link. Try again.');
    } finally {
      submit.disabled = false;
    }
  });

  kit.querySelector('[data-close-kit]')?.addEventListener('click', closeKit);
  kit.querySelector('[data-te-copy]')?.addEventListener('click', async () => {
    const dest = teDestination(location.origin, { ref: me?.code || startRef, camp: attr.camp || 'share-kit' });
    await copyText(dest);
    toast('TE destination copied');
  });
  kit.querySelector('[data-te-iframe]')?.addEventListener('click', async () => {
    await copyText(teIframeSnippet(location.origin, { ref: me?.code || startRef, camp: attr.camp || 'share-kit' }));
    toast('TE iframe snippet copied');
  });
  kit.querySelector('[data-copy]')?.addEventListener('click', async () => {
    track('share', { platform: 'copy', host: siteHost });
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
    const landHost = qs('url') ? hostOf(qs('url')!) : qs('helped') || siteHost;
    const alreadyInKit = Boolean(qs('kit') || qs('credited') || qs('already'));
    track(startRef && !alreadyInKit ? 'friend_land' : 'land', {
      host: landHost || undefined,
      src: attr.src,
      camp: attr.camp,
      te: attr.te,
    });
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
        rememberCredits(mine.player.credits);
        paintNext(mine.player, mine.rung);
        if (startKit || qs('credited') || qs('unlock') || qs('already') || qs('self') || shouldRestoreKit()) {
          openKit({
            player: mine.player,
            shareUrl: mine.shareUrl,
            rung: mine.rung,
            siteHost: mine.site.host,
            demoMode: mine.demoMode,
          });
        }
        await refreshEmbed(mine.site.host);
        if (qs('credited') && qs('helped')) {
          const status = kit.querySelector('[data-kit-status]') as HTMLElement;
          status.hidden = false;
          status.textContent = `You credited ${qs('helped')}. Here’s your kit — send it next.`;
        }
        if (qs('already')) toast('That friend already counted');
        if (qs('self')) toast('Your own tap does not count');
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
        if (me) {
          const row = [next.banner, ...next.challenger, ...next.rising, ...next.entered, ...next.race].find(
            (s) => s && (s.ownerCode === me!.code || s.host === me!.siteHost),
          );
          if (row) {
            paintNext({ ...me, weeklyCredits: row.weeklyCredits, credits: row.credits }, row.rung);
            if (kitOpen) (kit.querySelector('[data-meter]') as HTMLElement).innerHTML = rungMeter(row.rung);
            const prev = lastKnownCredits();
            if (prev !== null && row.credits > prev) {
              rememberCredits(row.credits);
              burst();
              toast(`${row.label} just got a unique friend lock`);
            } else {
              rememberCredits(row.credits);
            }
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
