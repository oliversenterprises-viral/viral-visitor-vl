/**
 * Gentle share reminders — nudge users who generated a link but haven't shared yet.
 * Also tracks copy so we can prompt "copy first" vs "share now".
 */

const LINK_READY_AT_KEY = 'vr_link_ready_at';
const LINK_COPIED_AT_KEY = 'vr_link_copied_at';
const LAST_SHARE_AT_KEY = 'vr_last_share_at';
const REMINDER_DISMISSED_KEY = 'vr_share_reminder_dismissed';
const REMINDER_SNOOZE_UNTIL_KEY = 'vr_share_reminder_snooze_until';

/** Banner after link ready with no share (was 2 min — too late for first-session drop-off). */
export const REMINDER_DELAY_MS = 45 * 1000;
/** Soft toast if they still have not copied. */
export const COPY_NUDGE_DELAY_MS = 12 * 1000;
/** Soft toast after copy if they still have not shared. */
export const SHARE_NUDGE_AFTER_COPY_MS = 18 * 1000;
const DEFAULT_SNOOZE_MS = 60 * 60 * 1000; // 1 hour

export function markReferralLinkReady(): void {
  try {
    localStorage.setItem(LINK_READY_AT_KEY, String(Date.now()));
    localStorage.removeItem(REMINDER_DISMISSED_KEY);
    localStorage.removeItem(LINK_COPIED_AT_KEY);
  } catch {
    // non-fatal
  }
}

/** Visitor copied the link (Step 2) — still need a real share for the board. */
export function markLinkCopied(now = Date.now()): void {
  try {
    localStorage.setItem(LINK_COPIED_AT_KEY, String(now));
  } catch {
    // non-fatal
  }
}

export function hasLinkBeenCopied(): boolean {
  try {
    const linkReady = parseTs(LINK_READY_AT_KEY);
    const copied = parseTs(LINK_COPIED_AT_KEY);
    if (!copied) return false;
    // Copied after (or at) this link-ready generation
    return !linkReady || copied >= linkReady;
  } catch {
    return false;
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

/** True when link is ready, not shared, and copy delay elapsed without a copy. */
export function shouldShowCopyNudge(now = Date.now()): boolean {
  try {
    if (localStorage.getItem(REMINDER_DISMISSED_KEY) === '1') return false;
    const linkReady = parseTs(LINK_READY_AT_KEY);
    if (!linkReady) return false;
    const lastShare = parseTs(LAST_SHARE_AT_KEY);
    if (lastShare >= linkReady) return false;
    if (hasLinkBeenCopied()) return false;
    return now - linkReady >= COPY_NUDGE_DELAY_MS;
  } catch {
    return false;
  }
}

/** True when copied but still not shared after SHARE_NUDGE_AFTER_COPY_MS. */
export function shouldShowShareNudgeAfterCopy(now = Date.now()): boolean {
  try {
    if (localStorage.getItem(REMINDER_DISMISSED_KEY) === '1') return false;
    const linkReady = parseTs(LINK_READY_AT_KEY);
    const copied = parseTs(LINK_COPIED_AT_KEY);
    if (!linkReady || !copied || copied < linkReady) return false;
    const lastShare = parseTs(LAST_SHARE_AT_KEY);
    if (lastShare >= linkReady) return false;
    return now - copied >= SHARE_NUDGE_AFTER_COPY_MS;
  } catch {
    return false;
  }
}

export function shareReminderMessage(): string {
  if (hasLinkBeenCopied()) {
    return 'You copied your link — now share it! WhatsApp is one tap below.';
  }
  return 'Your link is ready — tap COPY, then share to climb the leaderboard!';
}

export function copyNudgeMessage(): string {
  return 'Reminder: tap COPY under your link, then share it to climb the board.';
}

export function shareAfterCopyNudgeMessage(): string {
  return 'Link copied — next: share it (WhatsApp or any button below).';
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
