/**
 * Viral loops orchestrator — wires all 5 loops into app lifecycle.
 */

import { getMyReferralCode } from '../public/globals';
import { initChallengeLanding, onChallengeLinkReady } from './challenge-mode';
import { syncDuelInviteStrip, triggerDuelInviteMoment } from './duel-invite';
import { syncCatchUpAnxietyBar } from './catch-up-anxiety';
import { renderCommunityUnlockMeter } from './community-unlock';
import { shouldShowWeeklySideWidgets } from './prize-slot';
import {
  ensureCommunityUnlockMount,
  ensureDailyChampionStrip,
  ensureDailyCrownMount,
  ensureWeeklySprintMount,
  isShareLocked,
} from './side-loop-mounts';
import { offerRankReceipt } from './rank-receipt-card';
import { formatSprintHeroLine, renderWeeklySprintBoard } from './weekly-sprint';
import {
  fetchDailyCrownStatus,
  fetchWeeklyReferralCount,
  fetchWeeklySprintLeaderboard,
} from './supabase';
import {
  parseDailyCrownStatus,
  renderDailyCrown,
  getCachedDailyCrownStatus,
} from './daily-crown';
import type { LeaderboardEntry } from './types';

function hasReferralLink(): boolean {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return !!input?.value?.trim();
}

/** Call at bootstrap (after attribution capture). */
export function initViralLoops(): void {
  initChallengeLanding();
  if (typeof MutationObserver === 'undefined') return;
  const root = document.documentElement;
  const mo = new MutationObserver(() => {
    if (isShareLocked()) void loadPublicViralLoops();
  });
  mo.observe(root, { attributes: true, attributeFilter: ['data-vr-share-locked'] });
}

/** Load public sprint + community + Daily Crown widgets (no user code required). */
export async function loadPublicViralLoops(myCode?: string | null): Promise<void> {
  const code = myCode ?? getMyReferralCode();
  try {
    const [sprint, weeklyCount, crownRaw] = await Promise.all([
      fetchWeeklySprintLeaderboard(10),
      fetchWeeklyReferralCount(),
      fetchDailyCrownStatus(14),
    ]);
    if (shouldShowWeeklySideWidgets(weeklyCount)) {
      ensureWeeklySprintMount();
      ensureCommunityUnlockMount();
      renderWeeklySprintBoard(sprint, code);
      renderCommunityUnlockMeter(weeklyCount);
      paintSprintHeroLine(sprint);
    } else {
      document.getElementById('weekly-sprint-board')?.classList.add('hidden');
      document.getElementById('community-unlock-meter')?.classList.add('hidden');
      const sprintLine = document.getElementById('hero-sprint-line');
      if (sprintLine) {
        sprintLine.classList.add('hidden');
        sprintLine.textContent = '';
      }
    }
    if (isShareLocked()) {
      ensureDailyCrownMount();
      ensureDailyChampionStrip();
      const crown = parseDailyCrownStatus(crownRaw);
      renderDailyCrown(crown, code);
    }
  } catch {
    // non-fatal
  }
}

/** Latest Daily Crown cache for leaderboard flair (after loadPublicViralLoops). */
export { getCachedDailyCrownStatus };

/** Sync user-specific loops after stats refresh. */
export function syncUserViralLoops(
  myCode: string | null,
  count: number,
  rank: number | null,
  board: readonly LeaderboardEntry[],
  link?: string,
): void {
  syncCatchUpAnxietyBar(count, rank, board, hasReferralLink());
  syncDuelInviteStrip();

  if (myCode && link) {
    void offerRankReceipt({ code: myCode, link, rank, referrals: count });
  }
}

/** After referral link is populated. */
export function onViralLoopsLinkReady(
  myCode: string,
  link: string,
  count: number,
  rank: number | null,
  board: readonly LeaderboardEntry[],
): void {
  onChallengeLinkReady();
  syncUserViralLoops(myCode, count, rank, board, link);
  triggerDuelInviteMoment();
}

function paintSprintHeroLine(sprint: import('./types').LeaderboardEntry[]): void {
  const el = document.getElementById('hero-sprint-line');
  if (!el) return;
  const line = formatSprintHeroLine(sprint);
  if (!line) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = line;
  el.classList.remove('hidden');
}