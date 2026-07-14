/**
 * In-page share reminder banner + progressive copy/share nudges
 * after the visitor gets a referral link.
 */

import { showToast } from '../ui';
import { playFunnelNudgeSound, unlockFunnelNudgeAudio } from './funnel-nudge-sound';
import {
  COPY_NUDGE_DELAY_MS,
  copyNudgeMessage,
  dismissShareReminder,
  hasLinkBeenCopied,
  markLinkCopied,
  markReferralLinkReady,
  markShareCompleted,
  REMINDER_DELAY_MS,
  SHARE_NUDGE_AFTER_COPY_MS,
  shareAfterCopyNudgeMessage,
  shareReminderMessage,
  shouldShowCopyNudge,
  shouldShowShareNudgeAfterCopy,
  shouldShowShareReminder,
  snoozeShareReminder,
  tryShareReminderNotification,
} from './share-reminders';

let reminderTimer: ReturnType<typeof window.setTimeout> | null = null;
let copyNudgeTimer: ReturnType<typeof window.setTimeout> | null = null;
let shareAfterCopyTimer: ReturnType<typeof window.setTimeout> | null = null;
let pollTimer: ReturnType<typeof window.setInterval> | null = null;
let copyNudgeToastShown = false;
let shareAfterCopyToastShown = false;

function getBanner(): HTMLElement | null {
  return document.getElementById('share-reminder-banner');
}

function scrollToCopy(): void {
  // Send-mode: copy is secondary — push primary send instead
  if (document.documentElement.getAttribute('data-vr-send-mode') === '1') {
    scrollToShare();
    return;
  }
  document.getElementById('copy-link-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('copy-link-btn')?.classList.add('copy-link-pulse');
  window.setTimeout(() => {
    document.getElementById('copy-link-btn')?.classList.remove('copy-link-pulse');
  }, 2800);
}

/** Scroll / pulse the live send path (share-first / sticky), never the hidden platform grid. */
function scrollToShare(): void {
  const primary =
    document.getElementById('native-share-btn') ||
    document.getElementById('share-first-sms') ||
    document.getElementById('share-first-whatsapp') ||
    document.getElementById('share-first-strip') ||
    document.getElementById('mobile-send-cta-btn') ||
    document.getElementById('share-whatsapp-primary') ||
    document.getElementById('share-buttons-panel');
  primary?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  primary?.classList.add('share-primary-pulse', 'share-first-pulse');
  window.setTimeout(() => {
    primary?.classList.remove('share-primary-pulse', 'share-first-pulse');
  }, 3200);
}

function invokePrimarySend(): void {
  const g = window as unknown as { invokeShareFirstPrimary?: () => void };
  if (typeof g.invokeShareFirstPrimary === 'function') {
    g.invokeShareFirstPrimary();
    return;
  }
  void import('./share-first-ui')
    .then((m) => m.invokeShareFirstPrimary())
    .catch(() => scrollToShare());
}

function showBanner(): void {
  const banner = getBanner();
  if (!banner) return;
  const wasHidden = banner.classList.contains('hidden');
  const msg = banner.querySelector('[data-share-reminder-text]');
  if (msg) msg.textContent = shareReminderMessage();
  const action = document.getElementById('share-reminder-action');
  if (action) {
    action.textContent = hasLinkBeenCopied() ? 'Share now' : 'Copy & share';
  }
  banner.classList.remove('hidden');
  // Audible only when the banner newly appears (not on every poll refresh)
  if (wasHidden) void playFunnelNudgeSound('banner');
}

function hideBanner(): void {
  getBanner()?.classList.add('hidden');
}

function clearProgressTimers(): void {
  if (reminderTimer) window.clearTimeout(reminderTimer);
  if (copyNudgeTimer) window.clearTimeout(copyNudgeTimer);
  if (shareAfterCopyTimer) window.clearTimeout(shareAfterCopyTimer);
  if (pollTimer) window.clearInterval(pollTimer);
  reminderTimer = null;
  copyNudgeTimer = null;
  shareAfterCopyTimer = null;
  pollTimer = null;
}

function evaluateReminder(): void {
  if (shouldShowShareReminder()) {
    showBanner();
    tryShareReminderNotification();
  } else {
    hideBanner();
  }

  // Soft toast if they still have not copied
  if (!copyNudgeToastShown && shouldShowCopyNudge()) {
    copyNudgeToastShown = true;
    showToast(copyNudgeMessage(), 'info');
    void playFunnelNudgeSound('copy-nudge');
    scrollToCopy();
  }

  // Soft toast if they copied but still have not shared
  if (!shareAfterCopyToastShown && shouldShowShareNudgeAfterCopy()) {
    shareAfterCopyToastShown = true;
    showToast(shareAfterCopyNudgeMessage(), 'info');
    void playFunnelNudgeSound('share-nudge');
    scrollToShare();
  }
}

function wireBannerActions(): void {
  if (document.documentElement.dataset.vrShareReminderBound === '1') return;
  document.documentElement.dataset.vrShareReminderBound = '1';

  document.getElementById('share-reminder-dismiss')?.addEventListener('click', () => {
    dismissShareReminder();
    hideBanner();
  });

  document.getElementById('share-reminder-snooze')?.addEventListener('click', () => {
    snoozeShareReminder();
    hideBanner();
  });

  document.getElementById('share-reminder-action')?.addEventListener('click', (e) => {
    e.preventDefault();
    dismissShareReminder();
    hideBanner();
    // Always open the real send path (copy alone never finishes the job)
    if (document.documentElement.hasAttribute('data-vr-has-link')) {
      invokePrimarySend();
    } else {
      scrollToCopy();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) evaluateReminder();
  });
}

/** Start reminder scheduling after user generates their link. */
export function initShareRemindersOnLinkReady(): void {
  wireBannerActions();
  markReferralLinkReady();
  hideBanner();
  copyNudgeToastShown = false;
  shareAfterCopyToastShown = false;

  // Unlock + soft success chime on the same user gesture as Get link
  void unlockFunnelNudgeAudio().then(() => playFunnelNudgeSound('link-ready'));

  clearProgressTimers();

  copyNudgeTimer = window.setTimeout(evaluateReminder, COPY_NUDGE_DELAY_MS);
  reminderTimer = window.setTimeout(evaluateReminder, REMINDER_DELAY_MS);
  pollTimer = window.setInterval(evaluateReminder, 15_000);
}

/** Call when visitor copies their link (Step 2) — keep share nudges alive. */
export function onShareReminderLinkCopied(): void {
  markLinkCopied();
  copyNudgeToastShown = true; // no more "please copy" toasts
  shareAfterCopyToastShown = false;

  // Gesture unlock + soft share-invite chime after copy
  void unlockFunnelNudgeAudio().then(() => playFunnelNudgeSound('share-nudge'));

  if (shareAfterCopyTimer) window.clearTimeout(shareAfterCopyTimer);
  shareAfterCopyTimer = window.setTimeout(evaluateReminder, SHARE_NUDGE_AFTER_COPY_MS);

  // Refresh banner copy if already visible
  const banner = getBanner();
  if (banner && !banner.classList.contains('hidden')) {
    const msg = banner.querySelector('[data-share-reminder-text]');
    if (msg) msg.textContent = shareReminderMessage();
    const action = document.getElementById('share-reminder-action');
    if (action) action.textContent = 'Share now';
  }
}

/** Call when user completes any real share action (not clipboard-only). */
export function onShareReminderCompleted(): void {
  markShareCompleted();
  hideBanner();
  clearProgressTimers();
}
