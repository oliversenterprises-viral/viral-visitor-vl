/**
 * Catch-up anxiety bar — gap to #1 + optional rank-slip notifications.
 */

import type { LeaderboardEntry } from './types';
import { getViralLoopsConfig } from './viral-loops-config';
import { trackViralLoopEvent } from './visitor-tracking';

const RANK_SNAPSHOT_KEY = 'vr_anxiety_last_rank';
const NOTIFY_OPT_IN_KEY = 'vr_anxiety_notify_opt_in';

export function referralsBehindLeader(
  myCount: number,
  board: readonly LeaderboardEntry[],
): number | null {
  const leader = board[0];
  if (!leader) return null;
  if (myCount >= leader.referral_count) return null;
  return leader.referral_count - myCount;
}

export function formatAnxietyBarLine(gap: number | null, leaderCount: number): string {
  if (gap == null || gap < 1) {
    return leaderCount > 0
      ? `You're tied with #1 at ${leaderCount} referral${leaderCount === 1 ? '' : 's'}`
      : 'Be first on the board this week';
  }
  if (gap === 1) return '1 referral behind #1 — one push could take the crown';
  return `${gap} referrals behind #1 — close the gap before someone else does`;
}

export function isAnxietyNotifyOptedIn(): boolean {
  try {
    return localStorage.getItem(NOTIFY_OPT_IN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAnxietyNotifyOptIn(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(NOTIFY_OPT_IN_KEY, '1');
      trackViralLoopEvent('AnxietyNotification', { action: 'opt_in' });
    } else {
      localStorage.removeItem(NOTIFY_OPT_IN_KEY);
      trackViralLoopEvent('AnxietyNotification', { action: 'opt_out' });
    }
  } catch {
    // non-fatal
  }
}

function readRankSnapshot(): number | null {
  try {
    const n = parseInt(localStorage.getItem(RANK_SNAPSHOT_KEY) || '', 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeRankSnapshot(rank: number | null): void {
  try {
    if (rank && rank > 0) {
      localStorage.setItem(RANK_SNAPSHOT_KEY, String(rank));
    }
  } catch {
    // non-fatal
  }
}

function tryRankSlipNotification(prevRank: number | null, newRank: number | null): void {
  if (!isAnxietyNotifyOptedIn()) return;
  if (!prevRank || !newRank || newRank <= prevRank) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  const body = `You slipped from #${prevRank} to #${newRank} — share now to climb back`;
  if (Notification.permission === 'granted') {
    new Notification('ViralRefer — rank update', { body, tag: 'vr-rank-slip' });
    trackViralLoopEvent('AnxietyNotification', { action: 'rank_slip', from: prevRank, to: newRank });
    return;
  }
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((p) => {
      if (p === 'granted') {
        new Notification('ViralRefer — rank update', { body, tag: 'vr-rank-slip' });
        trackViralLoopEvent('AnxietyNotification', { action: 'rank_slip', from: prevRank, to: newRank });
      }
    });
  }
}

let anxietyWired = false;
let anxietyShownTracked = false;

function wireAnxietyActions(): void {
  if (anxietyWired) return;
  anxietyWired = true;

  document.getElementById('anxiety-notify-toggle')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    setAnxietyNotifyOptIn(checked);
  });

  document.getElementById('anxiety-share-cta')?.addEventListener('click', () => {
    trackViralLoopEvent('AnxietyBarAction', { action: 'share_cta' });
    document.getElementById('share-buttons-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (window as unknown as { boostShareWhatsApp?: () => void }).boostShareWhatsApp?.();
  });
}

/** Sync catch-up anxiety bar (requires referral link + leaderboard data). */
export function syncCatchUpAnxietyBar(
  myCount: number,
  myRank: number | null,
  board: readonly LeaderboardEntry[],
  hasLink: boolean,
): void {
  const root = document.getElementById('catch-up-anxiety-bar');
  if (!root) return;

  wireAnxietyActions();

  if (!getViralLoopsConfig().anxiety_enabled || !hasLink) {
    root.classList.add('hidden');
    return;
  }

  const leaderCount = board[0]?.referral_count ?? 0;
  const gap = referralsBehindLeader(myCount, board);
  const line = formatAnxietyBarLine(gap, leaderCount);

  const lineEl = root.querySelector('[data-anxiety-line]');
  const gapEl = root.querySelector('[data-anxiety-gap]');
  const fillEl = root.querySelector('[data-anxiety-fill]') as HTMLElement | null;
  const toggle = document.getElementById('anxiety-notify-toggle') as HTMLInputElement | null;

  if (lineEl) lineEl.textContent = line;
  if (gapEl) {
    gapEl.textContent = gap != null && gap > 0 ? String(gap) : '0';
  }
  if (fillEl) {
    const pct = gap != null && gap > 0
      ? Math.max(8, Math.min(92, 100 - Math.round((gap / Math.max(gap + myCount, 1)) * 100)))
      : 100;
    fillEl.style.width = `${pct}%`;
  }
  if (toggle) toggle.checked = isAnxietyNotifyOptedIn();

  root.classList.remove('hidden');
  root.classList.toggle('catch-up-anxiety-bar--critical', gap != null && gap <= 3 && gap > 0);

  const prevRank = readRankSnapshot();
  if (myRank) {
    tryRankSlipNotification(prevRank, myRank);
    writeRankSnapshot(myRank);
  }

  if (!anxietyShownTracked) {
    anxietyShownTracked = true;
    trackViralLoopEvent('AnxietyBarShown', { gap, rank: myRank });
  }
}