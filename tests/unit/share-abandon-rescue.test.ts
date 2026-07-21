import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  shouldShowShareAbandon,
  buildShareAbandonMessage,
  softSnoozeShareAbandon,
  SOFT_SNOOZE_MS,
  MIN_DWELL_MS,
  MOBILE_DWELL_MS,
  MAX_SESSION_SHOWS,
  resetShareAbandonSessionForTest,
  forceShareAbandonForTest,
} from '../../src/lib/share-abandon-rescue';
import { markSharePending, clearShareFirstFlags } from '../../src/lib/share-first-ui';

describe('share-abandon-rescue', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetShareAbandonSessionForTest();
    clearShareFirstFlags();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute('data-vr-share-locked');
    document.documentElement.removeAttribute('data-vr-share-pending');
    document.documentElement.removeAttribute('data-vr-share-abandon');
  });

  afterEach(() => {
    resetShareAbandonSessionForTest();
    clearShareFirstFlags();
    vi.restoreAllMocks();
  });

  it('buildShareAbandonMessage pushes send, not copy', () => {
    const msg = buildShareAbandonMessage();
    expect(msg.title.toLowerCase()).toMatch(/send|leave|don't|dont/i);
    expect(msg.cta.toLowerCase()).toMatch(/send|friend/i);
    expect(msg.body.toLowerCase()).toMatch(/lock|friend|get my link/i);
  });

  it('shouldShowShareAbandon requires link + pending and dwell', () => {
    const base = {
      hasLink: true,
      sharePending: true,
      locked: false,
      alreadyMaxShows: false,
      snoozed: false,
      dwellMs: MIN_DWELL_MS + 100,
      isCoarsePointer: false,
      embed: false,
      confirmFlowActive: false,
    };
    expect(shouldShowShareAbandon(base)).toBe(true);
    expect(shouldShowShareAbandon({ ...base, hasLink: false })).toBe(false);
    expect(shouldShowShareAbandon({ ...base, sharePending: false })).toBe(false);
    expect(shouldShowShareAbandon({ ...base, locked: true })).toBe(false);
    expect(shouldShowShareAbandon({ ...base, alreadyMaxShows: true })).toBe(false);
    expect(shouldShowShareAbandon({ ...base, snoozed: true })).toBe(false);
    expect(shouldShowShareAbandon({ ...base, embed: true })).toBe(false);
    expect(shouldShowShareAbandon({ ...base, confirmFlowActive: true })).toBe(false);
    expect(shouldShowShareAbandon({ ...base, dwellMs: 1000 })).toBe(false);
  });

  it('mobile needs longer dwell', () => {
    const base = {
      hasLink: true,
      sharePending: true,
      locked: false,
      alreadyMaxShows: false,
      snoozed: false,
      dwellMs: 10_000,
      isCoarsePointer: true,
      embed: false,
      confirmFlowActive: false,
    };
    expect(shouldShowShareAbandon(base)).toBe(false);
    expect(shouldShowShareAbandon({ ...base, dwellMs: MOBILE_DWELL_MS + 1 })).toBe(true);
  });

  it('softSnoozeShareAbandon stores session snooze', () => {
    const now = 1_700_000_000_000;
    softSnoozeShareAbandon(SOFT_SNOOZE_MS, now);
    const until = parseInt(sessionStorage.getItem('vr_share_abandon_snooze') || '0', 10);
    expect(until).toBe(now + SOFT_SNOOZE_MS);
  });

  it('forceShareAbandonForTest mounts panel when pending', () => {
    document.documentElement.setAttribute('data-vr-has-link', '1');
    markSharePending();
    document.body.innerHTML = `<input id="ref-link" value="https://www.viralrefer.app/r/VIRAL-TEST1" />`;

    forceShareAbandonForTest('unit');
    const panel = document.getElementById('vr-share-abandon');
    expect(panel).toBeTruthy();
    expect(panel?.querySelector('[data-abandon-cta]')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-vr-share-abandon')).toBe('unit');
  });

  it('MAX_SESSION_SHOWS is finite and small', () => {
    expect(MAX_SESSION_SHOWS).toBeGreaterThanOrEqual(2);
    expect(MAX_SESSION_SHOWS).toBeLessThanOrEqual(6);
  });
});
