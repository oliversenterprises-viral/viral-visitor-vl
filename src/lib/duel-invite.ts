/**
 * Duel invite — explicit "beat them" share path for challenge/referred visitors.
 */

import { getStoredLandingRef } from './referral-url';
import { getViralLoopsConfig } from './viral-loops-config';
import { isChallengeMode } from './challenge-mode';
import { trackViralLoopEvent } from './visitor-tracking';

function hasReferralLink(): boolean {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return !!input?.value?.trim();
}

export function resolveDuelRivalCode(): string | null {
  return getStoredLandingRef();
}

export function shouldShowDuelInviteStrip(): boolean {
  if (!getViralLoopsConfig().challenge_enabled) return false;
  if (!hasReferralLink()) return false;
  return isChallengeMode() || !!getStoredLandingRef();
}

export function duelInviteHeadline(rivalCode: string | null): string {
  if (!rivalCode) return 'Send a duel invite';
  return `Challenge ${rivalCode} — share your duel link`;
}

export function duelInviteSubline(rivalCode: string | null): string {
  if (!rivalCode) {
    return 'Your link includes ?challenge=1 — friends see your stats and race you.';
  }
  return `Opens with your stats vs theirs. One tap to WhatsApp — fastest viral loop.`;
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

export function trackDuelInviteShared(platform: string): void {
  trackViralLoopEvent('ChallengeDuelShared', { platform, rival_code: resolveDuelRivalCode() || undefined });
}