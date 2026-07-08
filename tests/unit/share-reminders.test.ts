import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  markReferralLinkReady,
  markShareCompleted,
  dismissShareReminder,
  snoozeShareReminder,
  shouldShowShareReminder,
  shareReminderMessage,
} from '../../src/lib/share-reminders';

describe('share-reminders', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('does not show reminder before delay', () => {
    markReferralLinkReady();
    expect(shouldShowShareReminder()).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(shouldShowShareReminder()).toBe(false);
  });

  it('shows reminder after 2 minutes if no share', () => {
    markReferralLinkReady();
    vi.advanceTimersByTime(2 * 60 * 1000 + 1);
    expect(shouldShowShareReminder()).toBe(true);
    expect(shareReminderMessage()).toContain('leaderboard');
  });

  it('snooze hides reminder for one hour', () => {
    markReferralLinkReady();
    vi.advanceTimersByTime(3 * 60 * 1000);
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
    vi.advanceTimersByTime(3 * 60 * 1000);
    markShareCompleted();
    expect(shouldShowShareReminder()).toBe(false);

    markReferralLinkReady();
    vi.advanceTimersByTime(3 * 60 * 1000);
    dismissShareReminder();
    expect(shouldShowShareReminder()).toBe(false);
  });
});