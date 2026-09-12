import { nextActionFor, type BoardSite, type Rung } from '../functions/_lib/engine';
import {
  buildAffiliateStyleLink,
  buildCleanReferralLink,
  buildRefQueryLink,
  parseRefFromLocation,
} from '../functions/_lib/referral-url';
import { fetchBoard, fetchMe, joinSite, probeHealth } from './api';
import { persistAttribution, previewHost, rememberCredits, rememberKitOpen, shouldRestoreKit, syncAttributionToUrl } from './attr';
import { celebrateHit, celebrateUnlock, pulseKit } from './celebrate';
import {
  bannerScarcity,
  boardProofLabel,
  bumpShareStreak,
  climbHeatPct,
  newestActivityText,
  nextClimbStep,
  prefersReducedMotion,
  raceGap,
  risingHook,
  setSoundEnabled,
  soundEnabled,
  weekClockLabel,
  weekRaceClock,
  yourClimbStep,
} from './game';
import { t } from './lib/i18n';
import { getMyReferralCode, setMyReferralCode } from './my-code';
import { copyText, intents, nativeShare, qrSvg } from './share';
import { track } from './track';
import type { BoardState, JoinOk, PublicPlayer } from './types';

function qs(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(message: string, hot = false): void {
  let host = document.querySelector('.toast-stack');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-stack';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = hot ? 'toast hot on' : 'toast on';
  el.textContent = message;
  host.appendChild(el);
  while (host.children.length > 3) host.firstElementChild?.remove();
  window.setTimeout(() => {
    el.classList.remove('on');
    window.setTimeout(() => el.remove(), 240);
  }, 2400);
}

function chipHtml(site: BoardSite, kicker: string, hot = false, yours = false): string {
  const href = escapeHtml(site.url || `https://${site.host}`);
  const cls = ['site-drop-chip', hot ? 'site-drop-chip--hot' : '', yours ? 'site-drop-chip--you' : ''].filter(Boolean).join(' ');
  return `<a class="${cls}" href="${href}" target="_blank" rel="noopener noreferrer">
    <span class="site-drop-chip__label">${escapeHtml(site.label)}</span>
    <span class="site-drop-chip__meta">${escapeHtml(kicker)}${yours ? ` · ${t('proof.you')}` : ''}</span>
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
  let lastActivityId: string | null = null;

  const mineAtBoot = getMyReferralCode();
  const landedRef = parseRefFromLocation(location);
  const friendRef = landedRef && landedRef !== mineAtBoot ? landedRef : '';
  const attr = persistAttribution(friendRef || undefined, qs('url'), qs('src') || qs('utm_source'), qs('camp') || qs('c'));
  syncAttributionToUrl(attr);
  const startRef = (friendRef || attr.ref || '').toUpperCase();
  const startUrl = qs('url') || attr.url || '';
  let myCode = mineAtBoot || '';

  const heroBtn = document.getElementById('hero-get-link-btn') as HTMLButtonElement | null;
  const navBtn = document.getElementById('nav-get-link-btn') as HTMLButtonElement | null;
  const attrBtn = document.getElementById('attribution-get-link-btn') as HTMLButtonElement | null;
  const siteInput = document.getElementById('post-link-site-drop-url') as HTMLInputElement | null;
  const siteSubmit = document.getElementById('post-link-site-drop-submit') as HTMLButtonElement | null;
  const siteStatus = document.getElementById('site-drop-status');
  const shareBox = document.getElementById('post-link-share');
  const siteDropBox = document.getElementById('post-link-site-drop');
  const copyBtn = document.getElementById('post-link-copy') as HTMLButtonElement | null;
  const copyCodeBtn = document.getElementById('post-link-copy-code') as HTMLButtonElement | null;
  const sendBtn = document.getElementById('post-link-primary') as HTMLButtonElement | null;
  const urlEl = document.getElementById('post-link-url');
  const codeEl = document.getElementById('post-link-code');
  const aliasEl = document.getElementById('post-link-aliases');
  const refLinkInput = document.getElementById('ref-link') as HTMLInputElement | null;
  const hud = document.getElementById('race-hud');

  if (siteInput && startUrl) siteInput.value = startUrl;

  function paintReferredHero(): void {
    if (!startRef) return;
    const banner = document.getElementById('referral-attribution');
    show(banner);
    const inline = document.getElementById('referrer-code-inline');
    const display = document.getElementById('referrer-code-display');
    if (inline) inline.textContent = startRef;
    if (display) display.textContent = startRef;
    const line = document.getElementById('hero-title-line1');
    if (line) {
      line.removeAttribute('data-i18n');
      line.textContent = t('ref.title', { code: startRef });
    }
    const sub = document.getElementById('hero-subtitle');
    if (sub) {
      sub.removeAttribute('data-i18n');
      sub.textContent = t('ref.sub');
    }
    const cta = heroBtn?.querySelector('span');
    if (cta) {
      cta.removeAttribute('data-i18n');
      cta.textContent = t('hero.cta_short');
    }
  }
  paintReferredHero();

  function paintWeekClock(): void {
    const el = document.getElementById('hero-week-clock');
    if (el) el.textContent = weekRaceClock();
    const sub = document.getElementById('week-text-sub');
    if (sub) sub.textContent = t('drops.week_sub_clock', { clock: weekClockLabel() });
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
      <p>${escapeHtml(t('hud.banner_open', { clock: weekClockLabel() }))}</p>`;
  }

  function revealKit(opts: { fresh?: boolean } = {}): void {
    document.documentElement.setAttribute('data-vr-has-link', '1');
    show(shareBox);
    show(siteDropBox);
    const code = myCode || shareUrl.split('/').pop() || '';
    if (code) {
      setMyReferralCode(code);
      myCode = code;
      shareUrl = buildCleanReferralLink(code, location.origin);
    }
    if (urlEl) {
      urlEl.hidden = false;
      urlEl.textContent = shareUrl;
    }
    if (codeEl && code) {
      codeEl.textContent = code;
      codeEl.classList.toggle('is-new', Boolean(opts.fresh));
    }
    if (refLinkInput) refLinkInput.value = shareUrl;
    if (aliasEl && code) {
      aliasEl.hidden = false;
      aliasEl.textContent = `${buildAffiliateStyleLink(code, location.origin)} · ${buildRefQueryLink(code, location.origin)}`;
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
    if (opts.fresh) pulseKit();
    paintHud();
  }

  function paintRungLive(id: string, count: number): void {
    const el = document.getElementById(id);
    const wrap = el?.closest('.site-drop-rung');
    if (el) el.textContent = count > 0 ? String(count) : t('rung.open');
    if (wrap instanceof HTMLElement) {
      if (count > 0) wrap.setAttribute('data-live', '1');
      else wrap.removeAttribute('data-live');
    }
  }

  function paintBoard(next: BoardState): void {
    board = next;
    paintRungLive('site-drop-rung-entered', next.entered.length);
    paintRungLive('site-drop-rung-rising', next.rising.length);
    paintRungLive('site-drop-rung-challenger', next.challenger.length);

    const slot = document.getElementById('hero-banner-mock');
    const siteEl = document.getElementById('hero-slot-site');
    const metaEl = document.getElementById('hero-slot-meta');
    const noteEl = document.getElementById('hero-ad-note');
    const raceEl = document.getElementById('hero-ad-race');
    const prizeSite = document.getElementById('prize-slot-site');
    const prizeMeta = document.getElementById('prize-slot-meta');
    const scarcity = bannerScarcity({
      held: Boolean(next.banner),
      weekLabel: weekClockLabel(),
      label: next.banner?.label,
    });
    if (next.banner) {
      slot?.setAttribute('data-vr-prize-slot', 'held');
      slot?.classList.remove('banner-open-glow');
      if (siteEl) siteEl.textContent = next.banner.label;
      if (metaEl) metaEl.textContent = t('proof.friends_week', { n: next.banner.weeklyCredits });
      if (noteEl) noteEl.textContent = t('proof.locks_all', { n: next.banner.credits });
      if (prizeSite) prizeSite.textContent = next.banner.label;
      if (prizeMeta) prizeMeta.textContent = `${next.banner.label} · ${weekClockLabel()}`;
    } else {
      slot?.setAttribute('data-vr-prize-slot', 'empty');
      slot?.classList.add('banner-open-glow');
      if (siteEl) siteEl.textContent = t('hero.slot_empty');
      if (metaEl) metaEl.textContent = t('proof.slot_open_days');
      if (noteEl) noteEl.textContent = t('hero.ad_note');
      if (prizeSite) prizeSite.textContent = t('hero.slot_empty');
      if (prizeMeta) prizeMeta.textContent = scarcity;
    }
    if (raceEl) {
      raceEl.hidden = true;
      raceEl.classList.add('hidden');
      raceEl.textContent = scarcity;
    }

    const proof = document.getElementById('hero-board-proof');
    if (proof) {
      proof.textContent = boardProofLabel({
        players: next.livePlayers,
        leaderWeekly: next.race[0]?.weeklyCredits,
      });
    }

    const textLine = next.race.some((s) => s.weeklyCredits >= 2);
    const heat = document.getElementById('site-drop-climb-heat');
    if (heat) {
      const pct = Math.max(
        18,
        climbHeatPct({
          entered: next.entered.length,
          rising: next.rising.length,
          textLine,
          challenger: next.challenger.length,
          banner: Boolean(next.banner),
        }),
      );
      heat.style.width = `${pct}%`;
    }
    const climbLit = [
      next.entered.length > 0,
      next.rising.length > 0,
      textLine,
      next.challenger.length > 0,
      Boolean(next.banner),
    ];
    const mine = yourClimbStep({
      hasSite: Boolean(siteHost),
      credits: me?.credits ?? 0,
      weekly: me?.weeklyCredits ?? 0,
      rung,
    });
    const nextStep = nextClimbStep(mine);
    document.querySelectorAll<HTMLElement>('.site-drop-climb__ladder li').forEach((li, i) => {
      const step = i + 1;
      if (climbLit[i]) li.setAttribute('data-lit', '1');
      else li.removeAttribute('data-lit');
      if (mine > 0 && step === mine) li.setAttribute('data-yours', '1');
      else li.removeAttribute('data-yours');
      if (nextStep && step === nextStep) li.setAttribute('data-next', '1');
      else li.removeAttribute('data-next');
    });

    paintList(
      'site-drops-entered-list',
      'site-drops-entered-empty',
      next.entered.map((s) => `<li>${chipHtml(s, t('rung.entered'), false, s.host === siteHost)}</li>`).join(''),
    );
    const risingLane = document.getElementById('site-drops-rising-list')?.closest('.site-drops-lane');
    risingLane?.classList.toggle('is-hot', next.rising.length > 0);
    paintList(
      'site-drops-rising-list',
      'site-drops-rising-empty',
      next.rising
        .map((s) =>
          `<li>${chipHtml(s, s.weeklyCredits === 1 ? t('proof.rising_one') : t('proof.rising_n', { n: s.weeklyCredits }), true, s.host === siteHost)}</li>`,
        )
        .join(''),
    );
    paintList(
      'site-drops-challenger-list',
      'site-drops-challenger-empty',
      next.challenger.map((s) => `<li>${chipHtml(s, t('proof.challenger_rung', { rung: s.rung }), false, s.host === siteHost)}</li>`).join(''),
    );

    const ticker = document.getElementById('site-entered-ticker');
    const chips = document.getElementById('site-entered-chips');
    const live = [...next.entered, ...next.rising];
    if (ticker && chips) {
      if (live.length) {
        show(ticker);
        chips.innerHTML = live
          .slice(0, 4)
          .map((s) => chipHtml(s, s.rung === 'rising' ? t('rung.rising') : t('rung.entered'), s.rung === 'rising'))
          .join('');
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
            .map((s, i) => `<div class="leaderboard-row flex justify-between items-center px-5 py-3 rounded-2xl ${i === 0 ? 'leaderboard-row--gold bg-gradient-to-r from-amber-500/15 to-yellow-500/5 border border-amber-400/35' : 'bg-zinc-900/70 border border-white/10'}"><span>#${i + 1} ${escapeHtml(s.label)}</span><span>${escapeHtml(t('lb.week_n', { n: s.weeklyCredits }))}</span></div>`)
            .join('')
        : `<p class="text-zinc-400">${escapeHtml(t('lb.need_two'))}</p>`;
    }

    const activity = document.getElementById('recent-activity');
    if (activity) {
      activity.innerHTML = next.activity.length
        ? next.activity
            .slice(0, 8)
            .map((e, i) => `<div class="activity-row flex justify-between gap-3 px-4 py-3 rounded-2xl bg-zinc-900/70 border ${i === 0 ? 'activity-row--hot border-emerald-400/40' : 'border-white/10'}"><span>${escapeHtml(e.text)}</span><span class="text-zinc-500 text-xs">${new Date(e.at).toLocaleTimeString()}</span></div>`)
            .join('')
        : `<p class="text-zinc-400">${escapeHtml(t('activity.empty'))}</p>`;
    }

    const lb = document.getElementById('leaderboard-container');
    if (lb) {
      if (!next.race.length) {
        lb.innerHTML = `<div class="text-center py-8 text-zinc-400"><p class="font-medium text-zinc-300 mb-1">${escapeHtml(t('lb.empty_title'))}</p><p class="text-sm">${escapeHtml(t('lb.empty_sub'))}</p></div>`;
      } else {
        lb.innerHTML = `<div class="space-y-2">${next.race
          .slice(0, 12)
          .map((s, i) => {
            const you = siteHost && s.host === siteHost;
            return `<div class="leaderboard-row flex justify-between items-center px-5 py-3 rounded-2xl ${i === 0 ? 'leaderboard-row--gold bg-gradient-to-r from-amber-500/15 to-yellow-500/5 border border-amber-400/35' : 'bg-zinc-900/70 border border-white/10'}${you ? ' ring-2 ring-emerald-400/40' : ''}" data-code="${escapeHtml(s.ownerCode)}">
              <div class="flex items-center gap-3"><div class="w-7 h-7 rounded-full ${i === 0 ? 'bg-amber-400 text-zinc-900' : 'bg-violet-600 text-white'} flex items-center justify-center text-xs font-bold">${i === 0 ? '👑' : i + 1}</div><div class="font-mono ${i === 0 ? 'text-amber-200' : 'text-emerald-400'}">${escapeHtml(s.ownerCode)}${you ? ` <span class="text-[10px] text-emerald-300/80">${escapeHtml(t('lb.you'))}</span>` : ''}</div></div>
              <div class="font-semibold ${i === 0 ? 'text-amber-300' : 'text-emerald-400'}">${s.weeklyCredits} <span class="text-xs text-zinc-400">${escapeHtml(t('lb.refs'))}</span></div>
            </div>`;
          })
          .join('')}</div>`;
      }
    }

    const liveN = document.getElementById('total-referrers');
    const suffix = document.getElementById('hero-stats-suffix');
    if (liveN) liveN.textContent = String(next.livePlayers || '');
    if (suffix) suffix.textContent = next.livePlayers ? t('hero.stats_racing') : t('hero.stats_open');
    const boardTotal = document.getElementById('leaderboard-total-label');
    if (boardTotal) {
      const n = next.livePlayers;
      boardTotal.textContent = n
        ? n === 1
          ? t('lb.verified_one')
          : t('lb.verified_n', { n })
        : t('lb.open');
    }
    const fomo = document.getElementById('hero-prize-fomo');
    if (fomo) {
      const action = me
        ? nextActionFor({ credits: me.credits, weeklyCredits: me.weeklyCredits, rung })
        : null;
      fomo.textContent = action
        ? `${action.nearMiss}. ${weekClockLabel()}.`
        : scarcity;
    }
    const coach = document.getElementById('funnel-guide-coach-text');
    if (coach) {
      coach.textContent = me
        ? siteHost
          ? nextActionFor({ credits: me.credits, weeklyCredits: me.weeklyCredits, rung }).label
          : t('funnel.coach_paste')
        : t('funnel.coach_get');
    }
    paintHud();
  }

  async function afterJoin(data: JoinOk): Promise<void> {
    me = data.player;
    myCode = setMyReferralCode(data.player.code) || data.player.code;
    shareUrl = buildCleanReferralLink(myCode, location.origin);
    rung = data.rung;
    siteHost = data.site?.host || data.player.siteHost || '';
    rememberCredits(data.player.credits);
    persistAttribution(startRef || qs('ref'), data.site?.url || siteInput?.value || '', attr.src, attr.camp);
    paintBoard(data.board);
    revealKit({ fresh: true });
    await copyText(shareUrl);
    const heading = document.getElementById('post-link-heading');
    if (heading) heading.textContent = data.site ? t('kit.heading_host', { host: data.site.host }) : t('kit.heading');
    if (data.selfJoin) toast(t('toast.self'));
    else if (data.teIgnored) toast(t('toast.te'));
    else if (data.alreadyCredited) toast(t('toast.already'));
    else if (data.credited) {
      toast(t('toast.credited'), true);
      celebrateHit({ host: data.site?.host || data.player.code, credits: data.player.credits });
    } else if (!data.site) {
      toast(t('toast.ready', { code: myCode }), true);
      celebrateHit({ host: data.player.code, credits: 0 });
    } else if (data.player.credits === 0) {
      celebrateHit({ host: data.site.host, credits: 0 });
    }
    if (data.unlock) {
      celebrateUnlock(data.unlock, () => {
        shareBox?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      });
    }
    if (data.kingmaker) toast(t('toast.kingmaker', { label: data.kingmaker.winnerLabel }));
    if (data.degraded) toast(t('toast.degraded'));
  }

  async function getMyLink(): Promise<void> {
    if (heroBtn) {
      heroBtn.disabled = true;
      const label = heroBtn.querySelector('span');
      if (label) label.textContent = t('hero.getting');
    }
    track('join', { host: previewHost(siteInput?.value || '') || undefined, src: attr.src, camp: attr.camp });
    try {
      const data = await joinSite(siteInput?.value || '', startRef || qs('ref') || attr.ref, { src: attr.src, camp: attr.camp });
      await afterJoin(data);
      shareBox?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.join_fail'));
    } finally {
      if (heroBtn) {
        heroBtn.disabled = false;
        const label = heroBtn.querySelector('span');
        if (label) label.textContent = startRef ? t('hero.cta_short') : t('hero.cta');
      }
    }
  }

  async function attachSite(): Promise<void> {
    const raw = siteInput?.value || '';
    if (!previewHost(raw)) {
      if (siteStatus) siteStatus.textContent = t('drop.need_url');
      toast(t('drop.need_url'));
      return;
    }
    if (siteStatus) siteStatus.textContent = t('drop.saving');
    try {
      const data = await joinSite(raw, startRef || qs('ref') || attr.ref, { src: attr.src, camp: attr.camp });
      await afterJoin(data);
      if (siteStatus) siteStatus.textContent = t('drop.entered');
      toast(t('toast.entered'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save';
      if (siteStatus) siteStatus.textContent = msg;
      toast(msg);
    }
  }

  document.getElementById('funnel-expand-btn')?.addEventListener('click', () => {
    document.documentElement.setAttribute('data-vr-kid-more', '1');
    document.documentElement.setAttribute('data-vr-funnel-expanded', '1');
    document.getElementById('site-drops')?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  });

  heroBtn?.addEventListener('click', () => void getMyLink());
  navBtn?.addEventListener('click', () => void getMyLink());
  attrBtn?.addEventListener('click', () => void getMyLink());
  siteSubmit?.addEventListener('click', () => void attachSite());
  copyBtn?.addEventListener('click', async () => {
    if (!shareUrl) return;
    await copyText(shareUrl);
    bumpShareStreak();
    toast(t('post_link.copy_toast'));
  });
  copyCodeBtn?.addEventListener('click', async () => {
    if (!myCode) return;
    await copyText(myCode);
    bumpShareStreak();
    toast(t('toast.copied_code', { code: myCode }));
  });
  sendBtn?.addEventListener('click', async () => {
    if (!shareUrl) return;
    const ok = await nativeShare(shareUrl, siteHost || 'ViralRefer', rung);
    if (ok) bumpShareStreak();
    else toast(t('toast.copy_instead'));
  });

  document.getElementById('post-link-intents')?.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (a) bumpShareStreak();
  });

  const soundBtn = document.getElementById('sound-toggle');
  function paintSound(): void {
    if (!soundBtn) return;
    const on = soundEnabled();
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.textContent = on ? t('kit.sound_on') : t('kit.sound_off');
  }
  paintSound();
  soundBtn?.addEventListener('click', () => {
    setSoundEnabled(!soundEnabled());
    paintSound();
    toast(soundEnabled() ? t('toast.sound_on') : t('toast.sound_off'));
  });

  void (async () => {
    const health = await probeHealth();
    if (health) {
      document.documentElement.setAttribute('data-vr-board', health.persisted || health.kv ? 'live' : 'memory');
      document.documentElement.removeAttribute('data-vr-demo');
    }
    const landHost = qs('url') ? previewHost(qs('url')!) : qs('helped') || siteHost;
    track(startRef ? 'friend_land' : 'land', { host: landHost || undefined, src: attr.src, camp: attr.camp, te: attr.te });
    try {
      const next = await fetchBoard();
      paintBoard(next);
      lastActivityId = next.activity[0]?.id ?? lastActivityId;
    } catch {
      /* board hydrates on join */
    }
    try {
      const mine = await fetchMe();
      if (mine.player) {
        me = mine.player;
        myCode = setMyReferralCode(mine.player.code) || mine.player.code;
        shareUrl = buildCleanReferralLink(myCode, location.origin);
        rung = mine.rung || 'entered';
        siteHost = mine.site?.host || mine.player.siteHost || '';
        if (!startRef && (shouldRestoreKit() || qs('kit') || myCode)) revealKit();
      } else if (!startRef && myCode) {
        shareUrl = buildCleanReferralLink(myCode, location.origin);
        if (shouldRestoreKit() || qs('kit')) revealKit();
      }
    } catch {
      /* first land */
    }
    if (!soundEnabled()) setSoundEnabled(false);
    paintSound();
    window.addEventListener('vr:locale-change', () => {
      paintReferredHero();
      paintWeekClock();
      paintSound();
      const heading = document.getElementById('post-link-heading');
      if (heading && myCode) {
        heading.textContent = siteHost ? t('kit.heading_host', { host: siteHost }) : t('kit.heading');
      }
      if (board) paintBoard(board);
      else if (heroBtn && !startRef) {
        const label = heroBtn.querySelector('span');
        if (label) {
          label.setAttribute('data-i18n', 'hero.cta');
          label.textContent = t('hero.cta');
        }
      }
    });
    window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void fetchBoard()
        .then((next) => {
          const fresh = newestActivityText(lastActivityId, next.activity);
          if (fresh && lastActivityId) toast(fresh, true);
          lastActivityId = next.activity[0]?.id || lastActivityId;
          paintBoard(next);
        })
        .catch(() => {
          /* keep last paint */
        });
    }, 10_000);
  })();
}
