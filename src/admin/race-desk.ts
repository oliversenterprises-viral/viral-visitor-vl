/**
 * Owner HQ Race tab — this week's banner and text spots.
 * Reads/writes via get_site_content / update_site_content (same as live JS).
 */

import { invokeAdminAction } from '../lib/admin-action-client';
import { fetchAdminSiteContent } from '../lib/admin-site-content';
import { escapeHtml } from '../lib/escape-html';
import { formatWeekRaceClock, getUtcWeekEndMs, hostnameFromUrl, safeHttpUrl } from '../lib/prize-slot';
import { showToast } from '../ui';

export const LIVE_PRIZE_WINNER_KEY = 'live_prize_winner';
export const RACE_TEXT_SPOTS_KEY = 'race_text_spots';
export const RACE_TEXT_SPOT_CAP = 8;

export type LivePrizeWinner = {
  label: string;
  url: string;
  expiresAt: string;
  code?: string;
  hidden?: boolean;
};

export type RaceTextSpot = {
  code: string;
  label: string;
  url: string;
  locks: number;
  hidden?: boolean;
};

export type RaceTextSpotsState = {
  spots: RaceTextSpot[];
};

export type RaceDeskBanner =
  | { empty: true }
  | { empty?: false; label: string; url: string; expiresAt: string; code?: string; hidden?: boolean };

export type RaceDeskSnapshot = {
  banner: RaceDeskBanner;
  spots: RaceTextSpot[];
  spotsState: RaceTextSpotsState;
  expiryLine: string;
  countdown: string;
};

export function formatRaceExpiryLine(now: Date = new Date()): string {
  const end = new Date(getUtcWeekEndMs(now.getTime()));
  return `Clears ${end.toISOString().slice(0, 10)} 00:00 UTC`;
}

export function parseLivePrizeWinner(raw: unknown, now: Date = new Date()): LivePrizeWinner | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (rec.empty === true) return null;
  const label = String(rec.label || '').trim().slice(0, 80);
  const url = safeHttpUrl(String(rec.url || rec.redirectUrl || rec.redirect_url || '')) || '';
  const expiresAt = String(rec.expiresAt || rec.expires_at || '').trim();
  if (!label || !url) return null;
  const expMs = Date.parse(expiresAt);
  if (expiresAt && Number.isFinite(expMs) && expMs < now.getTime() && rec.hidden !== true) {
    return null;
  }
  return {
    label,
    url,
    expiresAt: expiresAt || new Date(now.getTime() + 7 * 86_400_000).toISOString(),
    code: String(rec.code || rec.referrer_code || '').trim() || undefined,
    hidden: rec.hidden === true,
  };
}

export function hideLivePrizeWinner(winner: LivePrizeWinner): LivePrizeWinner {
  return { ...winner, hidden: true };
}

function parseSpot(raw: unknown): RaceTextSpot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const url = safeHttpUrl(String(rec.url || rec.redirectUrl || rec.redirect_url || '')) || '';
  const code = String(rec.code || rec.referrer_code || '').trim();
  const label =
    String(rec.label || '').trim() || (url ? hostnameFromUrl(url) || 'Site' : '') || code;
  if (!code && !url) return null;
  const locksRaw = rec.locks ?? rec.friends ?? rec.friend_count;
  const locks = Math.max(0, Math.floor(Number(locksRaw) || 0));
  return {
    code: code || url,
    label: label.slice(0, 80),
    url,
    locks,
    hidden: rec.hidden === true,
  };
}

export function parseRaceTextSpots(raw: unknown): RaceTextSpotsState {
  if (!raw) return { spots: [] };
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { spots?: unknown }).spots)
      ? ((raw as { spots: unknown[] }).spots)
      : [];
  const spots: RaceTextSpot[] = [];
  for (const item of list) {
    const spot = parseSpot(item);
    if (spot) spots.push(spot);
  }
  return { spots };
}

export function hideRaceTextSpot(state: RaceTextSpotsState, code: string): RaceTextSpotsState {
  const target = String(code || '').trim();
  return {
    spots: state.spots.map((spot) =>
      spot.code === target ? { ...spot, hidden: true } : spot,
    ),
  };
}

export function unhideRaceTextSpot(state: RaceTextSpotsState, code: string): RaceTextSpotsState {
  const target = String(code || '').trim();
  return {
    spots: state.spots.map((spot) =>
      spot.code === target ? { ...spot, hidden: false } : spot,
    ),
  };
}

function toBanner(winner: LivePrizeWinner | null): RaceDeskBanner {
  if (!winner) return { empty: true };
  return {
    label: winner.label,
    url: winner.url,
    expiresAt: winner.expiresAt,
    code: winner.code,
    hidden: winner.hidden === true,
  };
}

export function emptyRaceDeskSnapshot(now: Date = new Date()): RaceDeskSnapshot {
  return {
    banner: { empty: true },
    spots: [],
    spotsState: { spots: [] },
    expiryLine: formatRaceExpiryLine(now),
    countdown: formatWeekRaceClock(now.getTime()),
  };
}

export function buildRaceDeskSnapshot(
  content: Record<string, unknown> | null | undefined,
  now: Date = new Date(),
): RaceDeskSnapshot {
  const rec = content || {};
  const winner = parseLivePrizeWinner(rec[LIVE_PRIZE_WINNER_KEY], now);
  const spotsState = parseRaceTextSpots(rec[RACE_TEXT_SPOTS_KEY]);
  return {
    banner: toBanner(winner),
    spots: spotsState.spots,
    spotsState,
    expiryLine: formatRaceExpiryLine(now),
    countdown: formatWeekRaceClock(now.getTime()),
  };
}

function bannerCard(banner: RaceDeskBanner): string {
  if (banner.empty === true) {
    return `
      <article data-race-banner="empty" class="hq-card p-5">
        <div class="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Live banner · 7 days</div>
        <div class="text-2xl font-bold text-zinc-500 mt-2">Empty</div>
        <p class="text-sm text-zinc-400 mt-2">Empty until this week’s #1 taps Claim in the app. If they don’t before Monday, the prize dies. You do not approve.</p>
      </article>`;
  }
  if (banner.hidden) {
    return `
      <article data-race-banner="hidden" class="hq-card p-5 space-y-3 border-amber-500/25">
        <div class="text-[10px] uppercase tracking-[0.14em] text-amber-300/80 font-semibold">Live banner · hidden</div>
        <div class="text-2xl font-semibold text-zinc-200 font-mono truncate">${escapeHtml(banner.label)}</div>
        <p class="text-sm text-zinc-400">Hidden · occupied until ${escapeHtml(banner.expiresAt.slice(0, 10))}. Public page is empty. Slot stays closed until it expires.</p>
      </article>`;
  }
  return `
    <article data-race-banner="live" class="hq-hero p-5 space-y-3">
      <div class="text-[10px] uppercase tracking-[0.14em] text-emerald-300/80 font-semibold">Live banner · 7 days</div>
      <div class="relative z-[1] text-2xl font-semibold text-emerald-200 font-mono truncate">${escapeHtml(banner.label)}</div>
      <a class="relative z-[1] text-sm text-zinc-200 hover:text-white break-all" href="${escapeHtml(banner.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(banner.url)}</a>
      <p class="relative z-[1] text-[11px] text-zinc-400">Expires ${escapeHtml(banner.expiresAt.slice(0, 10))} · Autopilot — they placed this.</p>
      <div data-race-hide-banner-confirm class="hidden relative z-[1] flex flex-wrap items-center gap-2 text-sm text-zinc-300">
        Hide this banner?
        <button type="button" data-race-hide-banner class="hq-btn hq-btn-ghost">Hide</button>
        <button type="button" data-race-keep-banner class="hq-btn hq-btn-primary">Keep</button>
      </div>
      <button type="button" data-race-ask-hide-banner class="hq-btn hq-btn-ghost relative z-[1]">Hide banner</button>
    </article>`;
}

function spotRow(spot: RaceTextSpot, expiryLine: string): string {
  const hidden = spot.hidden === true;
  const action = hidden
    ? `<button type="button" data-race-unhide="${escapeHtml(spot.code)}" class="hq-btn hq-btn-ghost">Unhide</button>`
    : `<button type="button" data-race-hide="${escapeHtml(spot.code)}" class="hq-btn hq-btn-ghost">Hide</button>`;
  const friends = `${spot.locks} friend${spot.locks === 1 ? '' : 's'}`;
  return `
    <li class="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-white/5 last:border-0" data-race-spot="${escapeHtml(spot.code)}">
      <div class="min-w-0">
        <div class="font-semibold text-white truncate">${escapeHtml(spot.label)}</div>
        <p class="text-[11px] text-zinc-500 font-mono truncate">${escapeHtml(spot.url)} · ${friends} · ${escapeHtml(expiryLine)}${hidden ? ' · Hidden' : ''}</p>
      </div>
      ${action}
    </li>`;
}

export function renderRaceDeskView(el: HTMLElement, snap: RaceDeskSnapshot): void {
  const visible = snap.spots.filter((s) => !s.hidden).length;
  const list = snap.spots.length
    ? `<ul data-race-spot-list>${snap.spots.map((s) => spotRow(s, snap.expiryLine)).join('')}</ul>`
    : `<p data-race-spots-empty class="text-sm text-zinc-500 py-2">No text lines this week.</p>`;
  el.innerHTML = `
    <div data-race-desk="1" class="hq-dash">
      <div>
        <div class="hq-page-title">Race</div>
        <p class="hq-page-sub">This week’s board. Unclaimed prizes die Monday. Hide abuse only. You do not approve.</p>
        <p data-race-desk-countdown class="text-[12px] text-amber-200 mt-3">${escapeHtml(snap.countdown)}</p>
        <p data-race-desk-expiry class="text-[11px] text-zinc-500 mt-1">${escapeHtml(snap.expiryLine)}. Claimed banner lasts 7 days from claim.</p>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        ${bannerCard(snap.banner)}
        <section class="hq-card p-5">
          <div class="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold mb-3">Text spots · ${visible} / ${RACE_TEXT_SPOT_CAP} · clear Monday 00:00 UTC</div>
          ${list}
        </section>
      </div>
    </div>
  `;
}

function bindRaceDesk(el: HTMLElement): void {
  if (el.dataset.raceDeskBound === '1') return;
  el.dataset.raceDeskBound = '1';
  el.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const ask = target.closest('[data-race-ask-hide-banner]');
    if (ask && el.contains(ask)) {
      event.preventDefault();
      el.querySelector('[data-race-hide-banner-confirm]')?.classList.remove('hidden');
      ask.classList.add('hidden');
      return;
    }
    const keep = target.closest('[data-race-keep-banner]');
    if (keep && el.contains(keep)) {
      event.preventDefault();
      el.querySelector('[data-race-hide-banner-confirm]')?.classList.add('hidden');
      el.querySelector('[data-race-ask-hide-banner]')?.classList.remove('hidden');
      return;
    }
    const hideBanner = target.closest('[data-race-hide-banner]') as HTMLButtonElement | null;
    if (hideBanner && el.contains(hideBanner)) {
      event.preventDefault();
      void hideBannerNow(el, hideBanner);
      return;
    }
    const hideSpot = target.closest('[data-race-hide]') as HTMLButtonElement | null;
    if (hideSpot && el.contains(hideSpot)) {
      event.preventDefault();
      const code = hideSpot.getAttribute('data-race-hide') || '';
      if (code) void updateTextSpot(el, hideSpot, code, true);
      return;
    }
    const unhideSpot = target.closest('[data-race-unhide]') as HTMLButtonElement | null;
    if (unhideSpot && el.contains(unhideSpot)) {
      event.preventDefault();
      const code = unhideSpot.getAttribute('data-race-unhide') || '';
      if (code) void updateTextSpot(el, unhideSpot, code, false);
    }
  });
}

async function updateTextSpot(
  el: HTMLElement,
  btn: HTMLButtonElement,
  code: string,
  hide: boolean,
): Promise<void> {
  const label = btn.textContent || (hide ? 'Hide' : 'Unhide');
  btn.disabled = true;
  btn.textContent = hide ? 'Hiding…' : 'Restoring…';
  try {
    const content = await fetchAdminSiteContent();
    const next = hide
      ? hideRaceTextSpot(parseRaceTextSpots(content[RACE_TEXT_SPOTS_KEY]), code)
      : unhideRaceTextSpot(parseRaceTextSpots(content[RACE_TEXT_SPOTS_KEY]), code);
    const result = await invokeAdminAction('update_site_content', {
      key: RACE_TEXT_SPOTS_KEY,
      value: next,
    });
    if (!result.success) {
      showToast(result.error || 'Could not update this text spot. Try again.', 'info');
      btn.disabled = false;
      btn.textContent = label;
      return;
    }
    showToast(hide ? 'Text spot hidden.' : 'Text spot restored.', 'success');
    await renderRaceDesk(el);
  } catch {
    showToast('Could not update this text spot. Try again.', 'info');
    btn.disabled = false;
    btn.textContent = label;
  }
}

async function hideBannerNow(el: HTMLElement, btn: HTMLButtonElement): Promise<void> {
  const label = btn.textContent || 'Hide';
  btn.disabled = true;
  btn.textContent = 'Hiding…';
  try {
    const winner = parseLivePrizeWinner((await fetchAdminSiteContent())[LIVE_PRIZE_WINNER_KEY]);
    if (!winner) {
      showToast('There is no live banner to hide.', 'info');
      btn.disabled = false;
      btn.textContent = label;
      return;
    }
    const result = await invokeAdminAction('update_site_content', {
      key: LIVE_PRIZE_WINNER_KEY,
      value: hideLivePrizeWinner(winner),
    });
    if (!result.success) {
      showToast(result.error || 'Could not hide the banner. Try again.', 'info');
      btn.disabled = false;
      btn.textContent = label;
      return;
    }
    showToast('Banner hidden.', 'success');
    await renderRaceDesk(el);
  } catch {
    showToast('Could not hide the banner. Try again.', 'info');
    btn.disabled = false;
    btn.textContent = label;
  }
}

export async function renderRaceDesk(el: HTMLElement): Promise<void> {
  bindRaceDesk(el);
  el.innerHTML = `
    <div class="space-y-3 py-2" data-race-desk="1">
      <div class="h-8 w-40 skeleton rounded-xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-32 skeleton rounded-2xl"></div>
    </div>`;
  try {
    renderRaceDeskView(el, buildRaceDeskSnapshot(await fetchAdminSiteContent()));
  } catch {
    renderRaceDeskView(el, emptyRaceDeskSnapshot());
  }
}
