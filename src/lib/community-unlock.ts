/**
 * Community unlock meter — together we hit a weekly referral goal.
 */

import { getViralLoopsConfig } from './viral-loops-config';
import { trackViralLoopEvent } from './visitor-tracking';

const CELEBRATED_KEY = 'vr_community_unlock_celebrated_week';

function weekBucket(): string {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

export function communityUnlockPercent(current: number, goal: number): number {
  if (goal < 1) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}

export function communityUnlockLabel(current: number, goal: number): string {
  return `Together: ${current.toLocaleString()} / ${goal.toLocaleString()} referrals this week`;
}

function alreadyCelebratedThisWeek(): boolean {
  try {
    return localStorage.getItem(CELEBRATED_KEY) === weekBucket();
  } catch {
    return false;
  }
}

function markCelebrated(): void {
  try {
    localStorage.setItem(CELEBRATED_KEY, weekBucket());
  } catch {
    // non-fatal
  }
}

function fireCelebration(): void {
  void import('canvas-confetti').then(({ default: confetti }) => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.55 },
      colors: ['#34d399', '#22d3ee', '#a78bfa', '#fbbf24'],
    });
  }).catch(() => {});
}

let communityTracked = false;

/** Render community unlock meter. */
export function renderCommunityUnlockMeter(weeklyCount: number): void {
  const root = document.getElementById('community-unlock-meter');
  if (!root) return;

  const config = getViralLoopsConfig();
  if (!config.community_enabled) {
    root.classList.add('hidden');
    return;
  }

  const goal = config.community_goal_weekly;
  const pct = communityUnlockPercent(weeklyCount, goal);
  const label = communityUnlockLabel(weeklyCount, goal);
  const unlocked = weeklyCount >= goal;

  const labelEl = root.querySelector('[data-community-label]');
  const fillEl = root.querySelector('[data-community-fill]') as HTMLElement | null;
  const pctEl = root.querySelector('[data-community-pct]');
  const statusEl = root.querySelector('[data-community-status]');

  if (labelEl) labelEl.textContent = label;
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (statusEl) {
    statusEl.textContent = unlocked
      ? 'Community goal unlocked — keep the momentum!'
      : `${(goal - weeklyCount).toLocaleString()} more to unlock this week`;
  }

  root.classList.remove('hidden');
  root.classList.toggle('community-unlock-meter--unlocked', unlocked);

  if (!communityTracked) {
    communityTracked = true;
    trackViralLoopEvent('CommunityUnlockView', { current: weeklyCount, goal });
  }

  if (unlocked && !alreadyCelebratedThisWeek()) {
    markCelebrated();
    fireCelebration();
    trackViralLoopEvent('CommunityUnlockCelebration', { current: weeklyCount, goal });
  }
}