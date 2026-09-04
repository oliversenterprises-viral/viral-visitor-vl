/**
 * Challenge links (?challenge=1) — rivalry duel landing + share copy.
 */

import { buildCleanReferralLink, parseRefFromLocation } from './referral-url';
import { fetchReferrerPublicStats, type ReferrerPublicStats } from './supabase';
import { getViralLoopsConfig } from './viral-loops-config';
import { trackViralLoopEvent } from './visitor-tracking';
import { t } from './i18n';

const CHALLENGE_SESSION_KEY = 'vr_challenge_mode';

export function parseChallengeFromLocation(loc: Location = location): boolean {
  const params = new URLSearchParams(loc.search);
  const raw = params.get('challenge');
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function captureChallengeMode(loc: Location = location): boolean {
  const active = parseChallengeFromLocation(loc);
  if (!active) return isChallengeMode();
  try {
    sessionStorage.setItem(CHALLENGE_SESSION_KEY, '1');
  } catch {
    // non-fatal
  }
  return true;
}

export function isChallengeMode(): boolean {
  if (!getViralLoopsConfig().challenge_enabled) return false;
  try {
    return sessionStorage.getItem(CHALLENGE_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/** Append ?challenge=1 for duel-style share links. */
export function appendChallengeParam(link: string): string {
  if (!getViralLoopsConfig().challenge_enabled) return link;
  try {
    const url = new URL(link);
    url.searchParams.set('challenge', '1');
    return url.toString();
  } catch {
    const sep = link.includes('?') ? '&' : '?';
    return `${link}${sep}challenge=1`;
  }
}

export function buildChallengeReferralLink(code: string, baseUrl?: string): string {
  return appendChallengeParam(buildCleanReferralLink(code, baseUrl));
}

export function formatRivalDuelLine(stats: ReferrerPublicStats): string {
  const code = stats.referrer_code || 'RIVAL';
  const count = stats.referral_count ?? 0;
  const s = count === 1 ? '' : 's';
  if (stats.rank && stats.rank > 0) {
    return t('challenge.duel_ranked', { code, n: count, s, rank: stats.rank });
  }
  if (count > 0) {
    return t('challenge.duel_count', { code, n: count, s });
  }
  return t('challenge.duel_invite', { code });
}

export function formatChallengeSharePrefix(rivalCode: string | null): string {
  if (!rivalCode || !getViralLoopsConfig().challenge_enabled) return '';
  return t('challenge.share_prefix', { code: rivalCode });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderDuelBanner(ref: string, stats: ReferrerPublicStats): void {
  const el = document.getElementById('challenge-duel-banner');
  if (!el) return;

  const line = formatRivalDuelLine(stats);
  el.innerHTML = `
    <div class="challenge-duel-banner rounded-2xl border border-rose-400/35 bg-gradient-to-r from-rose-500/10 to-amber-500/5 px-4 py-3">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 font-bold text-sm">VS</div>
        <div>
          <div class="text-xs font-bold uppercase tracking-wider text-rose-300/90">${escapeHtml(t('challenge.mode'))}</div>
          <p class="text-sm text-zinc-100 mt-0.5 leading-relaxed">${escapeHtml(line)}</p>
          <p class="text-[11px] text-zinc-400 mt-1">${escapeHtml(t('challenge.hint', { code: ref }))}</p>
        </div>
      </div>
    </div>`;
  el.classList.remove('hidden');
  document.documentElement.setAttribute('data-vr-challenge-landing', '1');
}

function tuneChallengeHero(ref: string, stats: ReferrerPublicStats): void {
  const subtitle = document.getElementById('hero-subtitle');
  if (subtitle) {
    subtitle.textContent = t('challenge.hero', {
      code: ref,
      n: stats.referral_count ?? 0,
      rank: stats.rank ? ` (#${stats.rank})` : '',
    });
  }
  const badge = document.getElementById('hero-badge');
  if (badge) badge.textContent = t('challenge.badge');
}

let duelInflight: Promise<void> | null = null;

/** Fetch rival stats and render duel UI on referred challenge landings. */
export function initChallengeLanding(loc: Location = location): void {
  if (!getViralLoopsConfig().challenge_enabled) return;
  if (!captureChallengeMode(loc)) return;

  const ref = parseRefFromLocation(loc);
  if (!ref) return;

  trackViralLoopEvent('ChallengeLanding', { rival_code: ref });

  if (duelInflight) return;
  duelInflight = (async () => {
    const stats = await fetchReferrerPublicStats(ref);
    renderDuelBanner(ref, stats);
    tuneChallengeHero(ref, stats);
  })().finally(() => {
    duelInflight = null;
  });
}

/** Call when visitor gets their own link during a challenge session. */
export function onChallengeLinkReady(): void {
  if (!isChallengeMode()) return;
  trackViralLoopEvent('ChallengeLinkReady');
}