import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  shouldShowShareAbandon,
  shouldArmBeforeUnload,
  buildShareAbandonMessage,
  softSnoozeShareAbandon,
  SOFT_SNOOZE_MS,
  MIN_DWELL_MS,
  MOBILE_DWELL_MS,
  MAX_SESSION_SHOWS,
  BEFOREUNLOAD_MIN_DWELL_MS,
  POLL_MS,
  resetShareAbandonSessionForTest,
  forceShareAbandonForTest,
  isOwnerHqContext,
  dismissShareAbandonForOwnerHq,
} from '../../src/lib/share-abandon-rescue';
import { markSharePending, clearShareFirstFlags } from '../../src/lib/share-first-ui';
import { setAdminSessionToken, clearAdminSessionToken } from '../../src/lib/admin-session';

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
    clearAdminSessionToken();
  });

  afterEach(() => {
    resetShareAbandonSessionForTest();
    clearShareFirstFlags();
    clearAdminSessionToken();
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
    expect(shouldShowShareAbandon({ ...base, ownerHq: true })).toBe(false);
    expect(shouldShowShareAbandon({ ...base, dwellMs: 1000 })).toBe(false);
  });

  it('owner HQ (?owner=1 / Desk / session) never gets Don\'t leave without sending', () => {
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
    expect(shouldShowShareAbandon({ ...base, ownerHq: true })).toBe(false);
    expect(
      shouldArmBeforeUnload({
        hasLink: true,
        sharePending: true,
        locked: false,
        embed: false,
        confirmFlowActive: false,
        snoozed: false,
        sessionShows: 2,
        dwellMs: BEFOREUNLOAD_MIN_DWELL_MS + 1,
        ownerHq: true,
      }),
    ).toBe(false);

    document.body.innerHTML = `
      <div id="admin-modal" class="hidden"></div>
      <input id="ref-link" value="https://www.viralrefer.app/r/VIRAL-TEST1" />
    `;
    document.documentElement.setAttribute('data-vr-has-link', '1');
    markSharePending();
    forceShareAbandonForTest('unit');
    expect(document.getElementById('vr-share-abandon')).toBeTruthy();

    document.getElementById('admin-modal')?.classList.remove('hidden');
    expect(isOwnerHqContext()).toBe(true);
    dismissShareAbandonForOwnerHq();
    expect(document.getElementById('vr-share-abandon')).toBeNull();
    expect(document.documentElement.getAttribute('data-vr-share-abandon')).toBeNull();

    forceShareAbandonForTest('desk');
    expect(document.getElementById('vr-share-abandon')).toBeNull();
  });

  it('isOwnerHqContext is true for owner=1, #owner, and owner session', () => {
    document.body.innerHTML = `<div id="admin-modal" class="hidden"></div>`;
    const fakeWin = (search: string, hash = '') =>
      ({
        location: { search, hash },
        document,
      }) as unknown as Window;

    expect(isOwnerHqContext(fakeWin('?owner=1'))).toBe(true);
    expect(isOwnerHqContext(fakeWin('', '#owner'))).toBe(true);
    expect(isOwnerHqContext(fakeWin(''))).toBe(false);

    setAdminSessionToken('owner-session-token');
    expect(isOwnerHqContext(fakeWin(''))).toBe(true);
    clearAdminSessionToken();
    expect(isOwnerHqContext(fakeWin(''))).toBe(false);
  });

  it('poll skips when share strip already in view (fatigue mitigation)', () => {
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
      reason: 'poll',
      shareStripInView: true,
    };
    expect(shouldShowShareAbandon(base)).toBe(false);
    expect(shouldShowShareAbandon({ ...base, shareStripInView: false })).toBe(true);
  });

  it('mobile needs longer dwell', () => {
    const base = {
      hasLink: true,
      sharePending: true,
      locked: false,
      alreadyMaxShows: false,
      snoozed: false,
      dwellMs: 12_000,
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

  it('beforeunload only after prior show or long idle', () => {
    const base = {
      hasLink: true,
      sharePending: true,
      locked: false,
      embed: false,
      confirmFlowActive: false,
      snoozed: false,
      sessionShows: 0,
      dwellMs: 20_000,
    };
    expect(shouldArmBeforeUnload(base)).toBe(false);
    expect(shouldArmBeforeUnload({ ...base, sessionShows: 1 })).toBe(true);
    expect(
      shouldArmBeforeUnload({ ...base, dwellMs: BEFOREUNLOAD_MIN_DWELL_MS + 1 }),
    ).toBe(true);
    expect(shouldArmBeforeUnload({ ...base, sessionShows: 1, snoozed: true })).toBe(false);
    expect(shouldArmBeforeUnload({ ...base, sessionShows: 1, locked: true })).toBe(false);
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

  it('caps are conservative to limit residual annoyance', () => {
    expect(MAX_SESSION_SHOWS).toBe(3);
    expect(SOFT_SNOOZE_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(POLL_MS).toBeGreaterThanOrEqual(60_000);
    expect(MIN_DWELL_MS).toBeGreaterThanOrEqual(10_000);
  });
});
