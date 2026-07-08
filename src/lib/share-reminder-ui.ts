/**
 * In-page share reminder banner — wired from referral link ready + share events.
 */

import {
  dismissShareReminder,
  markReferralLinkReady,
  markShareCompleted,
  shareReminderMessage,
  shouldShowShareReminder,
  snoozeShareReminder,
  tryShareReminderNotification,
} from './share-reminders';

let reminderTimer: ReturnType<typeof window.setTimeout> | null = null;
let pollTimer: ReturnType<typeof window.setInterval> | null = null;

function getBanner(): HTMLElement | null {
  return document.getElementById('share-reminder-banner');
}

function showBanner(): void {
  const banner = getBanner();
  if (!banner) return;
  const msg = banner.querySelector('[data-share-reminder-text]');
  if (msg) msg.textContent = shareReminderMessage();
  banner.classList.remove('hidden');
}

function hideBanner(): void {
  getBanner()?.classList.add('hidden');
}

function evaluateReminder(): void {
  if (shouldShowShareReminder()) {
    showBanner();
    tryShareReminderNotification();
  } else {
    hideBanner();
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

  document.getElementById('share-reminder-action')?.addEventListener('click', () => {
    dismissShareReminder();
    hideBanner();
    document.getElementById('share-buttons-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  if (reminderTimer) window.clearTimeout(reminderTimer);
  if (pollTimer) window.clearInterval(pollTimer);

  reminderTimer = window.setTimeout(evaluateReminder, 2 * 60 * 1000);
  pollTimer = window.setInterval(evaluateReminder, 30_000);
}

/** Call when user completes any share action. */
export function onShareReminderCompleted(): void {
  markShareCompleted();
  hideBanner();
  if (reminderTimer) window.clearTimeout(reminderTimer);
  if (pollTimer) window.clearInterval(pollTimer);
  reminderTimer = null;
  pollTimer = null;
}