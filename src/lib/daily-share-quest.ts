/**
 * Daily share quest — 3 shares/day unlocks "boosted" momentum (local, no server).
 */

export const DAILY_SHARE_QUEST_GOAL = 3;

const DAY_KEY = 'vr_daily_share_day';
const COUNT_KEY = 'vr_daily_share_count';
const COMPLETE_KEY = 'vr_daily_quest_celebrated';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCount(): number {
  try {
    const day = localStorage.getItem(DAY_KEY);
    if (day !== todayKey()) return 0;
    const n = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeCount(count: number): void {
  try {
    localStorage.setItem(DAY_KEY, todayKey());
    localStorage.setItem(COUNT_KEY, String(count));
  } catch {
    /* non-fatal */
  }
}

export function getDailyShareCount(): number {
  return readCount();
}

export function dailyQuestProgress(): { current: number; goal: number; percent: number } {
  const current = readCount();
  const goal = DAILY_SHARE_QUEST_GOAL;
  const percent = Math.min(100, Math.round((current / goal) * 100));
  return { current, goal, percent };
}

export function isDailyQuestComplete(): boolean {
  return readCount() >= DAILY_SHARE_QUEST_GOAL;
}

/** Increment today's share count; returns new total. */
export function recordDailyShare(): number {
  const day = todayKey();
  let count = readCount();
  try {
    const storedDay = localStorage.getItem(DAY_KEY);
    if (storedDay !== day) {
      count = 0;
      localStorage.removeItem(COMPLETE_KEY);
    }
  } catch {
    count = 0;
  }
  count += 1;
  writeCount(count);
  return count;
}

/** True once per day when quest just completed (for celebration). */
export function consumeDailyQuestCelebration(): boolean {
  if (!isDailyQuestComplete()) return false;
  try {
    if (localStorage.getItem(COMPLETE_KEY) === todayKey()) return false;
    localStorage.setItem(COMPLETE_KEY, todayKey());
    return true;
  } catch {
    return false;
  }
}

export function dailyQuestLabel(): string {
  const { current, goal } = dailyQuestProgress();
  if (current >= goal) return `Daily quest complete — ${goal}/${goal} shares`;
  return `Daily quest: ${current}/${goal} shares for max boost`;
}