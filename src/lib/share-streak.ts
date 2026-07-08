/**
 * Local share momentum counter — encourages repeat sharing without server round-trips.
 */

const STREAK_KEY = 'vr_share_streak';
const STREAK_DAY_KEY = 'vr_share_streak_day';

export function getShareStreakCount(): number {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    const n = parseInt(raw || '0', 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Increment streak; resets daily counter display but keeps total momentum. */
export function incrementShareStreak(): number {
  const today = new Date().toISOString().slice(0, 10);
  let count = getShareStreakCount() + 1;
  try {
    localStorage.setItem(STREAK_KEY, String(count));
    localStorage.setItem(STREAK_DAY_KEY, today);
  } catch {
    // non-fatal
  }
  return count;
}

export function shareStreakLabel(count: number): string {
  if (count <= 0) return '';
  if (count === 1) return '1 share logged — keep going!';
  if (count < 5) return `${count} shares — momentum building`;
  if (count < 15) return `${count} shares — you are on fire`;
  return `${count} shares — referral machine`;
}