/**
 * Duel invite — explicit "beat them" share path for challenge/referred visitors.
 */

import { getStoredLandingRef } from './referral-url';
import { getViralLoopsConfig } from './viral-loops-config';
import { trackViralLoopEvent } from './visitor-tracking';
import { t } from './i18n';

function hasReferralLink(): boolean {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return !!input?.value?.trim();
}

export function resolveDuelRivalCode(): string | null {
  return getStoredLandingRef();
}

/**
 * Challenge-first: show duel strip for every visitor with a ready link
 * (not only referred/challenge landings). Highest share-desire CTA.
 */
export function shouldShowDuelInviteStrip(): boolean {
  if (!getViralLoopsConfig().challenge_enabled) return false;
  return hasReferralLink();
}

export function duelInviteHeadline(rivalCode: string | null): string {
  if (!rivalCode) return t('duel.headline');
  return t('duel.headline_rival', { code: rivalCode });
}

export function duelInviteSubline(rivalCode: string | null): string {
  if (!rivalCode) return t('duel.sub');
  return t('duel.sub_rival');
}

let momentTracked = false;

/** Pulse duel strip after link ready or credit on referred/challenge sessions. */
export function triggerDuelInviteMoment(rivalCode?: string | null): void {
  if (!shouldShowDuelInviteStrip()) return;

  const ref = rivalCode ?? resolveDuelRivalCode();
  syncDuelInviteStrip();

  const strip = document.getElementById('duel-invite-strip');
  if (strip) {
    strip.classList.add('duel-invite-strip--pulse');
    window.setTimeout(() => strip.classList.remove('duel-invite-strip--pulse'), 3200);
  }

  if (!momentTracked) {
    momentTracked = true;
    trackViralLoopEvent('DuelInviteShown', { rival_code: ref || undefined });
  }
}

/** Render duel invite strip visibility + copy. */
export function syncDuelInviteStrip(): void {
  const strip = document.getElementById('duel-invite-strip');
  if (!strip) return;

  const show = shouldShowDuelInviteStrip();
  if (!show) {
    strip.classList.add('hidden');
    return;
  }

  const rival = resolveDuelRivalCode();
  const headline = strip.querySelector('[data-duel-headline]');
  const subline = strip.querySelector('[data-duel-subline]');
  if (headline) headline.textContent = duelInviteHeadline(rival);
  if (subline) subline.textContent = duelInviteSubline(rival);

  strip.classList.remove('hidden');
  document.documentElement.setAttribute('data-vr-duel-invite', '1');
}

if (typeof window !== 'undefined') {
  window.addEventListener('vr:locale-change', () => {
    syncDuelInviteStrip();
  });
}

export function trackDuelInviteShared(platform: string): void {
  trackViralLoopEvent('ChallengeDuelShared', { platform, rival_code: resolveDuelRivalCode() || undefined });
}