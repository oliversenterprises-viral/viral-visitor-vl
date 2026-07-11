import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SHARE_DEADLINE_MS,
  formatDeadlineCountdown,
  isVerifiedSharePlatform,
  msUntilDeadline,
  readShareDeadlineState,
  writeShareDeadlineState,
  clearShareDeadlineState,
  markLocalVerifiedShare,
} from '../../src/lib/share-deadline';

describe('share-deadline', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T12:00:00.000Z'));
  });

  it('treats social platforms as verified, not clipboard', () => {
    expect(isVerifiedSharePlatform('whatsapp')).toBe(true);
    expect(isVerifiedSharePlatform('x')).toBe(true);
    expect(isVerifiedSharePlatform('twitter')).toBe(true);
    expect(isVerifiedSharePlatform('sms')).toBe(true);
    expect(isVerifiedSharePlatform('native')).toBe(true);
    expect(isVerifiedSharePlatform('copy')).toBe(false);
    expect(isVerifiedSharePlatform('copy-message')).toBe(false);
    expect(isVerifiedSharePlatform('embed')).toBe(false);
  });

  it('formats countdown', () => {
    expect(formatDeadlineCountdown(2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe('2h 15m');
    expect(formatDeadlineCountdown(0)).toBe('0h 0m');
  });

  it('tracks local pending → active on verified share', () => {
    const created = new Date().toISOString();
    writeShareDeadlineState({
      code: 'VIRAL-TEST01',
      status: 'pending_share',
      createdAt: created,
      deadlineAt: new Date(Date.now() + SHARE_DEADLINE_MS).toISOString(),
    });
    expect(readShareDeadlineState()?.status).toBe('pending_share');
    markLocalVerifiedShare('copy');
    expect(readShareDeadlineState()?.status).toBe('pending_share');
    markLocalVerifiedShare('whatsapp');
    expect(readShareDeadlineState()?.status).toBe('active');
  });

  it('msUntilDeadline decreases with time', () => {
    const created = Date.now();
    writeShareDeadlineState({
      code: 'VIRAL-TEST02',
      status: 'pending_share',
      createdAt: new Date(created).toISOString(),
      deadlineAt: new Date(created + SHARE_DEADLINE_MS).toISOString(),
    });
    const state = readShareDeadlineState()!;
    expect(msUntilDeadline(state)).toBeGreaterThan(SHARE_DEADLINE_MS - 1000);
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(msUntilDeadline(state)).toBeLessThanOrEqual(SHARE_DEADLINE_MS - 60 * 60 * 1000 + 50);
  });

  it('clearShareDeadlineState wipes storage', () => {
    writeShareDeadlineState({
      code: 'VIRAL-X',
      status: 'pending_share',
      createdAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + SHARE_DEADLINE_MS).toISOString(),
    });
    clearShareDeadlineState();
    expect(readShareDeadlineState()).toBeNull();
  });
});

describe('share-deadline i18n keys', () => {
  it('exposes deadline keys in every supported locale', async () => {
    const { MESSAGES, SUPPORTED_LOCALES } = await import('../../src/lib/i18n/messages');
    const keys = [
      'deadline.badge',
      'deadline.time_left',
      'deadline.pre_rule',
      'deadline.pending',
      'deadline.urgent',
      'deadline.expired',
      'deadline.countdown_expired',
      'deadline.toast_removed',
      'deadline.how_note',
    ] as const;
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of keys) {
        const value = MESSAGES[locale][key];
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(3);
      }
    }
  });
});

describe('referrer-share-deadline edge helpers', () => {
  it('isVerifiedSharePlatform matches edge module rules', async () => {
    // Mirror of edge NON_VERIFIED set — keep in sync with _shared/referrer-share-deadline.ts
    const { isVerifiedSharePlatform: client } = await import('../../src/lib/share-deadline');
    expect(client('boost-whatsapp')).toBe(true);
    expect(client('copy')).toBe(false);
  });
});
