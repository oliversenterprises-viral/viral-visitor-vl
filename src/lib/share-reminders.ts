/**
 * Gentle share reminders — nudge users who generated a link but haven't shared yet.
 */

const LINK_READY_AT_KEY = 'vr_link_ready_at';
const LAST_SHARE_AT_KEY = 'vr_last_share_at';
const REMINDER_DISMISSED_KEY = 'vr_share_reminder_dismissed';
const REMINDER_SNOOZE_UNTIL_KEY = 'vr_share_reminder_snooze_until';
const REMINDER_DELAY_MS = 2 * 60 * 1000; // 2 minutes after link ready
const DEFAULT_SNOOZE_MS = 60 * 60 * 1000; // 1 hour

export function markReferralLinkReady(): void {
  try {
    localStorage.setItem(LINK_READY_AT_KEY, String(Date.now()));
    localStorage.removeItem(REMINDER_DISMISSED_KEY);
  } catch {
    // non-fatal
  }
}

export function markShareCompleted(): void {
  try {
    localStorage.setItem(LAST_SHARE_AT_KEY, String(Date.now()));
    localStorage.setItem(REMINDER_DISMISSED_KEY, '1');
  } catch {
    // non-fatal
  }
}

export function dismissShareReminder(): void {
  try {
    localStorage.setItem(REMINDER_DISMISSED_KEY, '1');
  } catch {
    // non-fatal
  }
}

/** Snooze reminder (default 1 hour) without marking as permanently dismissed. */
export function snoozeShareReminder(ms = DEFAULT_SNOOZE_MS, now = Date.now()): void {
  try {
    localStorage.setItem(REMINDER_SNOOZE_UNTIL_KEY, String(now + ms));
    localStorage.removeItem(REMINDER_DISMISSED_KEY);
  } catch {
    // non-fatal
  }
}

function parseTs(key: string): number {
  try {
    const n = parseInt(localStorage.getItem(key) || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function shouldShowShareReminder(now = Date.now()): boolean {
  try {
    const snoozeUntil = parseInt(localStorage.getItem(REMINDER_SNOOZE_UNTIL_KEY) || '0', 10);
    if (snoozeUntil > now) return false;
    if (localStorage.getItem(REMINDER_DISMISSED_KEY) === '1') return false;
    const linkReady = parseTs(LINK_READY_AT_KEY);
    if (!linkReady) return false;
    const lastShare = parseTs(LAST_SHARE_AT_KEY);
    if (lastShare >= linkReady) return false;
    return now - linkReady >= REMINDER_DELAY_MS;
  } catch {
    return false;
  }
}

export function shareReminderMessage(): string {
  return 'Your link is ready — one share could move you up the leaderboard. Tap a platform below!';
}

/** Optional browser notification when tab is in background (permission-gated). */
export function tryShareReminderNotification(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (!document.hidden) return;
  if (!shouldShowShareReminder()) return;

  const body = shareReminderMessage();
  if (Notification.permission === 'granted') {
    new Notification('ViralRefer — time to share', { body, tag: 'vr-share-reminder' });
    dismissShareReminder();
    return;
  }
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((p) => {
      if (p === 'granted') {
        new Notification('ViralRefer — time to share', { body, tag: 'vr-share-reminder' });
      }
      dismissShareReminder();
    });
  }
}