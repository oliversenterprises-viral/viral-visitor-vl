import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  markReferralLinkReady,
  markLinkCopied,
  markShareCompleted,
  dismissShareReminder,
  snoozeShareReminder,
  shouldShowShareReminder,
  shouldShowCopyNudge,
  shouldShowShareNudgeAfterCopy,
  shareReminderMessage,
  hasLinkBeenCopied,
  REMINDER_DELAY_MS,
  COPY_NUDGE_DELAY_MS,
  SHARE_NUDGE_AFTER_COPY_MS,
} from '../../src/lib/share-reminders';

describe('share-reminders', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('does not show reminder before delay', () => {
    markReferralLinkReady();
    expect(shouldShowShareReminder()).toBe(false);
    vi.advanceTimersByTime(20_000);
    expect(shouldShowShareReminder()).toBe(false);
  });

  it('shows reminder after REMINDER_DELAY_MS if no share', () => {
    markReferralLinkReady();
    vi.advanceTimersByTime(REMINDER_DELAY_MS + 1);
    expect(shouldShowShareReminder()).toBe(true);
    expect(shareReminderMessage()).toMatch(/COPY|share/i);
  });

  it('copy nudge appears after COPY_NUDGE_DELAY_MS without copy', () => {
    markReferralLinkReady();
    expect(shouldShowCopyNudge()).toBe(false);
    vi.advanceTimersByTime(COPY_NUDGE_DELAY_MS + 1);
    expect(shouldShowCopyNudge()).toBe(true);
    markLinkCopied();
    expect(shouldShowCopyNudge()).toBe(false);
    expect(hasLinkBeenCopied()).toBe(true);
  });

  it('after copy, message and share-after-copy nudge update', () => {
    markReferralLinkReady();
    markLinkCopied();
    expect(shareReminderMessage()).toMatch(/copied|share/i);
    expect(shouldShowShareNudgeAfterCopy()).toBe(false);
    vi.advanceTimersByTime(SHARE_NUDGE_AFTER_COPY_MS + 1);
    expect(shouldShowShareNudgeAfterCopy()).toBe(true);
  });

  it('snooze hides reminder for one hour', () => {
    markReferralLinkReady();
    vi.advanceTimersByTime(REMINDER_DELAY_MS + 1);
    expect(shouldShowShareReminder()).toBe(true);
    snoozeShareReminder(60 * 60 * 1000);
    expect(shouldShowShareReminder()).toBe(false);
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(shouldShowShareReminder()).toBe(false);
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(shouldShowShareReminder()).toBe(true);
  });

  it('hides reminder after share or dismiss', () => {
    markReferralLinkReady();
    vi.advanceTimersByTime(REMINDER_DELAY_MS + 1);
    markShareCompleted();
    expect(shouldShowShareReminder()).toBe(false);

    markReferralLinkReady();
    vi.advanceTimersByTime(REMINDER_DELAY_MS + 1);
    dismissShareReminder();
    expect(shouldShowShareReminder()).toBe(false);
  });
});
