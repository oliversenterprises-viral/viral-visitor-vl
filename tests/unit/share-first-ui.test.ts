import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveShareFirstPrimary,
  markSharePending,
  markShareLocked,
  clearShareFirstFlags,
  isSharePendingLocal,
  shareFirstHeroLabel,
} from '../../src/lib/share-first-ui';
import {
  writeShareDeadlineState,
  clearShareDeadlineState,
  SHARE_DEADLINE_MS,
} from '../../src/lib/share-deadline';

describe('share-first-ui', () => {
  beforeEach(() => {
    localStorage.clear();
    clearShareFirstFlags();
    document.documentElement.removeAttribute('data-vr-has-link');
    document.body.innerHTML = '';
  });

  afterEach(() => {
    clearShareDeadlineState();
    clearShareFirstFlags();
    vi.restoreAllMocks();
  });

  it('prefers native share when supported', () => {
    expect(resolveShareFirstPrimary({ nativeSupported: true, mobile: true })).toBe('native');
    expect(resolveShareFirstPrimary({ nativeSupported: true, mobile: false })).toBe('native');
  });

  it('falls back to sms on mobile without native, whatsapp on desktop', () => {
    expect(resolveShareFirstPrimary({ nativeSupported: false, mobile: true })).toBe('sms');
    expect(resolveShareFirstPrimary({ nativeSupported: false, mobile: false })).toBe('whatsapp');
  });

  it('marks share pending / locked on documentElement', () => {
    markSharePending();
    expect(document.documentElement.getAttribute('data-vr-share-pending')).toBe('1');
    expect(document.documentElement.hasAttribute('data-vr-share-locked')).toBe(false);

    markShareLocked();
    expect(document.documentElement.hasAttribute('data-vr-share-pending')).toBe(false);
    expect(document.documentElement.getAttribute('data-vr-share-locked')).toBe('1');
  });

  it('isSharePendingLocal true for pending_share deadline', () => {
    writeShareDeadlineState({
      code: 'VIRAL-SF1',
      status: 'pending_share',
      createdAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + SHARE_DEADLINE_MS).toISOString(),
    });
    expect(isSharePendingLocal()).toBe(true);

    writeShareDeadlineState({
      code: 'VIRAL-SF1',
      status: 'active',
      createdAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + SHARE_DEADLINE_MS).toISOString(),
    });
    expect(isSharePendingLocal()).toBe(false);
  });

  it('hero labels are non-empty for each primary', () => {
    expect(shareFirstHeroLabel('native').length).toBeGreaterThan(4);
    expect(shareFirstHeroLabel('sms').length).toBeGreaterThan(3);
    expect(shareFirstHeroLabel('whatsapp').length).toBeGreaterThan(4);
  });
});
