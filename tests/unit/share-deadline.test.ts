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

  it('treats social platforms as verified, not clipboard or downloads', () => {
    expect(isVerifiedSharePlatform('whatsapp')).toBe(true);
    expect(isVerifiedSharePlatform('x')).toBe(true);
    expect(isVerifiedSharePlatform('twitter')).toBe(true);
    expect(isVerifiedSharePlatform('sms')).toBe(true);
    expect(isVerifiedSharePlatform('native')).toBe(true);
    expect(isVerifiedSharePlatform('copy')).toBe(false);
    expect(isVerifiedSharePlatform('copy-message')).toBe(false);
    expect(isVerifiedSharePlatform('embed')).toBe(false);
    expect(isVerifiedSharePlatform('discord')).toBe(false);
    expect(isVerifiedSharePlatform('tiktok')).toBe(false);
    expect(isVerifiedSharePlatform('story-image')).toBe(false);
    expect(isVerifiedSharePlatform('share-pack')).toBe(false);
  });

  it('classifies intent vs native for lock rules', async () => {
    const { isIntentSharePlatform, isNativeSharePlatform } = await import(
      '../../src/lib/share-deadline'
    );
    expect(isIntentSharePlatform('whatsapp')).toBe(true);
    expect(isIntentSharePlatform('sms')).toBe(true);
    expect(isIntentSharePlatform('boost-whatsapp')).toBe(true);
    expect(isIntentSharePlatform('native')).toBe(false);
    expect(isIntentSharePlatform('copy')).toBe(false);
    expect(isNativeSharePlatform('native')).toBe(true);
    expect(isNativeSharePlatform('whatsapp')).toBe(false);
  });

  it('formats countdown', () => {
    expect(formatDeadlineCountdown(2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe('2h 15m');
    expect(formatDeadlineCountdown(0)).toBe('0h 0m');
  });

  it('tracks local pending → active on first_referral lock only', () => {
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
    // Self-report platforms no longer auto-lock UI in product flow; first_referral does
    markLocalVerifiedShare('first_referral');
    expect(readShareDeadlineState()?.status).toBe('active');
  });

  it('uses 48h base window', () => {
    expect(SHARE_DEADLINE_MS).toBe(48 * 60 * 60 * 1000);
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
      'deadline.locked',
      'deadline.locked_badge',
      'deadline.status_pending',
      'deadline.status_locked',
      'deadline.grace_extended',
      'share_first.status_pending',
      'share_first.status_locked',
      'share_first.next_step',
      'share_first.reminder',
      'share_first.cta_native',
      'share_first.cta_sms',
      'share_first.cta_whatsapp',
      'share_first.heading',
      'share_first.sub',
      'share_first.copy_only',
      'share_first.fomo',
      'post_share.title',
      'post_share.sub',
      'post_share.cta_challenge',
      'post_share.cta_receipt',
      'post_share.prize_nudge',
      'post_share.toast',
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
