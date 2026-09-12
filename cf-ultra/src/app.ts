import { nextActionFor, type BoardSite, type Rung } from '../functions/_lib/engine';
import { fetchBoard, fetchMe, joinSite, probeHealth } from './api';
import { persistAttribution, previewHost, rememberCredits, rememberKitOpen, shouldRestoreKit, syncAttributionToUrl } from './attr';
import { celebrateHit, celebrateUnlock } from './celebrate';
import {
  bumpShareStreak,
  prefersReducedMotion,
  raceGap,
  risingHook,
  setSoundEnabled,
  soundEnabled,
  weekClockLabel,
} from './game';
import { copyText, intents, nativeShare, qrSvg } from './share';
import { track } from './track';
import type { BoardState, JoinOk, PublicPlayer } from './types';

function qs(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  setTimeout(() => el.classList.remove('on'), 2200);
}

function chipHtml(site: BoardSite, kicker: string): string {
  const href = escapeHtml(site.url || `https://${site.host}`);
  return `<a class="site-drop-chip" href="${href}" target="_blank" rel="noopener noreferrer">
    <span class="site-drop-chip__label">${escapeHtml(site.label)}</span>
    <span class="site-drop-chip__meta">${escapeHtml(kicker)}</span>
    <span class="site-drop-chip__host">${escapeHtml(site.host)}</span>
  </a>`;
}

function paintList(listId: string, emptyId: string, html: string): void {
  const list = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  if (list) list.innerHTML = html;
  if (empty) {
    const has = Boolean(html);
    empty.hidden = has;
    empty.classList.toggle('hidden', has);
  }
}

function show(el: HTMLElement | null): void {
  if (!el) return;
  el.hidden = false;
  el.classList.remove('hidden');
}

export function boot(_root?: HTMLElement): void {
  let board: BoardState | null = null;
  let me: PublicPlayer | null = null;
  let shareUrl = '';
  let rung: Rung = 'entered';
  let siteHost = '';

  const attr = persistAttribution(qs('ref'), qs('url'), qs('src') || qs('utm_source'), qs('camp') || qs('c'));
  syncAttributionToUrl(attr);
  const startRef = (qs('ref') || attr.ref || '').toUpperCase();
  const startUrl = qs('url') || attr.url || '';

  const heroBtn = document.getElementById('hero-get-link-btn') as HTMLButtonElement | null;
  const navBtn = document.getElementById('nav-get-link-btn') as HTMLButtonElement | null;
  const attrBtn = document.getElementById('attribution-get-link-btn') as HTMLButtonElement | null;
  const siteInput = document.getElementById('post-link-site-drop-url') as HTMLInputElement | null;
  const siteSubmit = document.getElementById('post-link-site-drop-submit') as HTMLButtonElement | null;
  const siteStatus = document.getElementById('site-drop-status');
  const shareBox = document.getElementById('post-link-share');
  const siteDropBox = document.getElementById('post-link-site-drop');
  const copyBtn = document.getElementById('post-link-copy') as HTMLButtonElement | null;
  const sendBtn = document.getElementById('post-link-primary') as HTMLButtonElement | null;
  const urlEl = document.getElementById('post-link-url');
  const hud = document.getElementById('race-hud');

  if (siteInput && startUrl) siteInput.value = startUrl;

  if (startRef) {
    const banner = document.getElementById('referral-attribution');
    show(banner);
    const codeEl = document.getElementById('referrer-code-inline');
    if (codeEl) codeEl.textContent = startRef;
    const line = document.getElementById('hero-title-line1');
    if (line) line.textContent = `You're in the same race as ${startRef}.`;
    const sub = document.getElementById('hero-subtitle');
    if (sub) sub.textContent = 'Tap Get my link so they get credit — then send yours and try to beat them.';
    const cta = heroBtn?.querySelector('span');
    if (cta) cta.textContent = 'Get my link';
  }

  function paintWeekClock(): void {
    const el = document.getElementById('hero-week-clock');
    if (el) el.textContent = `${weekClockLabel()}. Send now.`;
    const sub = document.getElementById('week-text-sub');
    if (sub) sub.textContent = `${weekClockLabel()}. Unique friend taps only — not raw visits.`;
  }
  paintWeekClock();
  window.setInterval(paintWeekClock, 30_000);

  function paintHud(): void {
    if (!hud) return;
    if (!me) {
      hud.hidden = true;
      hud.classList.add('hidden');
      return;
    }
    const action = nextActionFor({ credits: me.credits, weeklyCredits: me.weeklyCredits, rung });
    const gap = board && siteHost ? raceGap({ host: siteHost, race: board.race, bannerWeekly: board.banner?.weeklyCredits }) : null;
    const hook = risingHook(board?.rising.find((s) => s.host === siteHost)?.expiresAt);
    hud.hidden = false;
    hud.classList.remove('hidden');
    hud.innerHTML = `<p class="near-miss">${escapeHtml(action.nearMiss)}</p>
      <p>${escapeHtml(action.label)}</p>
      ${gap ? `<p>${escapeHtml(gap)}</p>` : ''}
      ${hook ? `<p>${escapeHtml(hook)}</p>` : ''}
      <p>Banner still open · ${escapeHtml(weekClockLabel())}</p>`;
  }

  function revealKit(): void {
    document.documentElement.setAttribute('data-vr-has-link', '1');
    show(shareBox);
    show(siteDropBox);
    if (urlEl) {
      urlEl.hidden = false;
      urlEl.textContent = shareUrl;
    }
    if (sendBtn) {
      const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
      sendBtn.hidden = !canShare;
    }
    const intentsEl = document.getElementById('post-link-intents');
    if (intentsEl && shareUrl) {
      const links = intents(shareUrl, siteHost || 'your site', rung);
      intentsEl.innerHTML = `
        <a class="btn ghost" href="${links.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn ghost" href="${links.x}" target="_blank" rel="noopener">X</a>
        <a class="btn ghost" href="${links.telegram}" target="_blank" rel="noopener">Telegram</a>
        <a class="btn ghost" href="${links.reddit}" target="_blank" rel="noopener">Reddit</a>`;
    }
    const qr = document.getElementById('post-link-qr');
    if (qr && shareUrl) qr.innerHTML = qrSvg(shareUrl);
    rememberKitOpen(true);
    paintHud();
  }

  function paintBoard(next: BoardState): void {
    board = next;
    const entered = document.getElementById('ladder-entered');
    const rising = document.getElementById('ladder-rising');
    const chall = document.getElementById('ladder-challenger');
    if (entered) entered.textContent = next.entered.length ? `Just entered · ${next.entered.length}` : 'Just entered · open';
    if (rising) rising.textContent = next.rising.length ? `Rising · ${next.rising.length}` : 'Rising · open';
    if (chall) chall.textContent = next.challenger.length ? `Challenger · ${next.challenger.length}` : 'Challenger · open';

    const slot = document.getElementById('hero-banner-mock');
    const siteEl = document.getElementById('hero-slot-site');
    const metaEl = document.getElementById('hero-slot-meta');
    const noteEl = document.getElementById('hero-ad-note');
    const prizeSite = document.getElementById('prize-slot-site');
    const prizeMeta = document.getElementById('prize-slot-meta');
    if (next.banner) {
      slot?.setAttribute('data-vr-prize-slot', 'held');
      slot?.classList.remove('banner-open-glow');
      if (siteEl) siteEl.textContent = next.banner.label;
      if (metaEl) metaEl.textContent = `${next.banner.weeklyCredits} unique friends this week · 7 days`;
      if (noteEl) noteEl.textContent = `${next.banner.credits} all-time locks`;
      if (prizeSite) prizeSite.textContent = next.banner.label;
      if (prizeMeta) prizeMeta.textContent = `${next.banner.label} · 7 days`;
    } else {
      slot?.setAttribute('data-vr-prize-slot', 'empty');
      slot?.classList.add('banner-open-glow');
      if (siteEl) siteEl.textContent = 'Your site here';
      if (metaEl) metaEl.textContent = 'still open · 7 days';
      if (noteEl) noteEl.textContent = 'Empty right now. #1 this week puts their site here.';
      if (prizeSite) prizeSite.textContent = 'Your site here';
      if (prizeMeta) prizeMeta.textContent = 'Banner still open · 7 days';
    }

    paintList(
      'site-drops-entered-list',
      'site-drops-entered-empty',
      next.entered.map((s) => `<li>${chipHtml(s, 'Just entered')}</li>`).join(''),
    );
    paintList(
      'site-drops-rising-list',
      'site-drops-rising-empty',
      next.rising.map((s) => `<li>${chipHtml(s, `Rising · ${s.weeklyCredits} friend${s.weeklyCredits === 1 ? '' : 's'}`)}</li>`).join(''),
    );
    paintList(
      'site-drops-challenger-list',
      'site-drops-challenger-empty',
      next.challenger.map((s) => `<li>${chipHtml(s, `Challenger · ${s.rung}`)}</li>`).join(''),
    );

    const ticker = document.getElementById('site-entered-ticker');
    const chips = document.getElementById('site-entered-chips');
    const live = [...next.entered, ...next.rising];
    if (ticker && chips) {
      if (live.length) {
        show(ticker);
        chips.innerHTML = live.slice(0, 4).map((s) => chipHtml(s, s.rung === 'rising' ? 'Rising' : 'Just entered')).join('');
      } else {
        ticker.hidden = true;
        ticker.classList.add('hidden');
      }
    }

    const weekLine = document.getElementById('week-text-line');
    if (weekLine) {
      weekLine.innerHTML = next.race.length
        ? next.race
            .slice(0, 8)
            .map((s, i) => `<div class="leaderboard-row flex justify-between items-center px-5 py-3 rounded-2xl ${i === 0 ? 'leaderboard-row--gold bg-gradient-to-r from-amber-500/15 to-yellow-500/5 border border-amber-400/35' : 'bg-zinc-900/70 border border-white/10'}"><span>#${i + 1} ${escapeHtml(s.label)}</span><span>${s.weeklyCredits} this week</span></div>`)
            .join('')
        : `<p class="text-zinc-400">Need two sites in the weekly race to spark a text line.</p>`;
    }

    const activity = document.getElementById('recent-activity');
    if (activity) {
      activity.innerHTML = next.activity.length
        ? next.activity
            .slice(0, 8)
            .map((e, i) => `<div class="flex justify-between gap-3 px-4 py-3 rounded-2xl bg-zinc-900/70 border ${i === 0 ? 'border-emerald-400/40' : 'border-white/10'}"><span>${escapeHtml(e.text)}</span><span class="text-zinc-500 text-xs">${new Date(e.at).toLocaleTimeString()}</span></div>`)
            .join('')
        : `<p class="text-zinc-400">No live events yet. First unique tap writes the feed.</p>`;
    }

    const lb = document.getElementById('leaderboard-container');
    if (lb) {
      if (!next.race.length) {
        lb.innerHTML = `<div class="text-center py-8 text-zinc-400"><p class="font-medium text-zinc-300 mb-1">The board is wide open</p><p class="text-sm">Be the first referrer on the live leaderboard.</p></div>`;
      } else {
        lb.innerHTML = `<div class="space-y-2">${next.race
          .slice(0, 12)
          .map((s, i) => {
            const you = siteHost && s.host === siteHost;
            return `<div class="leaderboard-row flex justify-between items-center px-5 py-3 rounded-2xl ${i === 0 ? 'leaderboard-row--gold bg-gradient-to-r from-amber-500/15 to-yellow-500/5 border border-amber-400/35' : 'bg-zinc-900/70 border border-white/10'}${you ? ' ring-2 ring-emerald-400/40' : ''}" data-code="${escapeHtml(s.ownerCode)}">
              <div class="flex items-center gap-3"><div class="w-7 h-7 rounded-full ${i === 0 ? 'bg-amber-400 text-zinc-900' : 'bg-violet-600 text-white'} flex items-center justify-center text-xs font-bold">${i === 0 ? '👑' : i + 1}</div><div class="font-mono ${i === 0 ? 'text-amber-200' : 'text-emerald-400'}">${escapeHtml(s.ownerCode)}${you ? ' <span class="text-[10px] text-emerald-300/80">(you)</span>' : ''}</div></div>
              <div class="font-semibold ${i === 0 ? 'text-amber-300' : 'text-emerald-400'}">${s.weeklyCredits} <span class="text-xs text-zinc-400">refs</span></div>
            </div>`;
          })
          .join('')}</div>`;
      }
    }

    const liveN = document.getElementById('total-referrers');
    const suffix = document.getElementById('hero-stats-suffix');
    if (liveN) liveN.textContent = String(next.livePlayers || '');
    if (suffix) suffix.textContent = next.livePlayers ? 'people racing' : 'Board is open';
    const coach = document.getElementById('funnel-guide-coach-text');
    if (coach) {
      coach.textContent = me
        ? siteHost
          ? nextActionFor({ credits: me.credits, weeklyCredits: me.weeklyCredits, rung }).label
          : 'Paste your website in the Site Drop slot for a 15-minute chip.'
        : 'Step 1: tap Get my referral link.';
    }
    paintHud();
  }

  async function afterJoin(data: JoinOk): Promise<void> {
    me = data.player;
    shareUrl = data.shareUrl;
    rung = data.rung;
    siteHost = data.site?.host || data.player.siteHost || '';
    rememberCredits(data.player.credits);
    persistAttribution(startRef || qs('ref'), data.site?.url || siteInput?.value || '', attr.src, attr.camp);
    paintBoard(data.board);
    revealKit();
    const heading = document.getElementById('post-link-heading');
    if (heading) heading.textContent = data.site ? `You're racing — ${data.site.host}` : "You're racing.";
    if (data.selfJoin) toast('Your own tap does not count');
    else if (data.teIgnored) toast('TE hit ignored — visits never climb the board');
    else if (data.alreadyCredited) toast('That friend already counted');
    else if (data.credited) {
      toast('Unique friend lock counted');
      celebrateHit({ host: data.site?.host || data.player.code, credits: data.player.credits });
    } else if (data.player.credits === 0) {
      celebrateHit({ host: data.site?.host || data.player.code, credits: 0 });
    }
    if (data.unlock) {
      celebrateUnlock(data.unlock, () => {
        shareBox?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      });
    }
    if (data.kingmaker) toast(`Kingmaker: introduced ${data.kingmaker.winnerLabel}`);
    if (data.degraded) toast('Saved in this session — board sync is catching up');
  }

  async function getMyLink(): Promise<void> {
    if (heroBtn) {
      heroBtn.disabled = true;
      const label = heroBtn.querySelector('span');
      if (label) label.textContent = 'Getting your referral link…';
    }
    track('join', { host: previewHost(siteInput?.value || '') || undefined, src: attr.src, camp: attr.camp });
    try {
      const data = await joinSite(siteInput?.value || '', startRef || qs('ref') || attr.ref, { src: attr.src, camp: attr.camp });
      await afterJoin(data);
      shareBox?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not get your link. Try again.');
    } finally {
      if (heroBtn) {
        heroBtn.disabled = false;
        const label = heroBtn.querySelector('span');
        if (label) label.textContent = startRef ? 'Get my link' : 'Get my referral link';
      }
    }
  }

  async function attachSite(): Promise<void> {
    const raw = siteInput?.value || '';
    if (!previewHost(raw)) {
      if (siteStatus) siteStatus.textContent = 'Paste your website.';
      toast('Paste your website.');
      return;
    }
    if (siteStatus) siteStatus.textContent = 'Saving…';
    try {
      const data = await joinSite(raw, startRef || qs('ref') || attr.ref, { src: attr.src, camp: attr.camp });
      await afterJoin(data);
      if (siteStatus) siteStatus.textContent = 'Just entered — your site is on this homepage for 15 minutes.';
      toast('Just entered — 15 minutes on this homepage.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save';
      if (siteStatus) siteStatus.textContent = msg;
      toast(msg);
    }
  }

  heroBtn?.addEventListener('click', () => void getMyLink());
  navBtn?.addEventListener('click', () => void getMyLink());
  attrBtn?.addEventListener('click', () => void getMyLink());
  siteSubmit?.addEventListener('click', () => void attachSite());
  copyBtn?.addEventListener('click', async () => {
    if (!shareUrl) return;
    await copyText(shareUrl);
    bumpShareStreak();
    toast('Link copied. Send it — visits do not count.');
  });
  sendBtn?.addEventListener('click', async () => {
    if (!shareUrl) return;
    const ok = await nativeShare(shareUrl, siteHost || 'ViralRefer', rung);
    if (ok) bumpShareStreak();
    else toast('Copy the link instead');
  });

  document.getElementById('post-link-intents')?.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (a) bumpShareStreak();
  });

  void (async () => {
    await probeHealth();
    const landHost = qs('url') ? previewHost(qs('url')!) : qs('helped') || siteHost;
    track(startRef ? 'friend_land' : 'land', { host: landHost || undefined, src: attr.src, camp: attr.camp, te: attr.te });
    try {
      const next = await fetchBoard();
      paintBoard(next);
    } catch {
      /* board hydrates on join */
    }
    try {
      const mine = await fetchMe();
      if (mine.player) {
        me = mine.player;
        shareUrl = mine.shareUrl || `${location.origin}/r/${mine.player.code}`;
        rung = mine.rung || 'entered';
        siteHost = mine.site?.host || mine.player.siteHost || '';
        if (shouldRestoreKit() || qs('kit')) revealKit();
      }
    } catch {
      /* first land */
    }
    if (!soundEnabled()) setSoundEnabled(false);
  })();
}
