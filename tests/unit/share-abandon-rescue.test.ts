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
  isPostLinkSendScreenActive,
  stealShareAbandonIfSendTap,
  dismissShareAbandon,
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
    document.documentElement.removeAttribute('data-vr-post-link-one');
  });

  afterEach(() => {
    resetShareAbandonSessionForTest();
    clearShareFirstFlags();
    document.documentElement.removeAttribute('data-vr-post-link-one');
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

  it('never shows the dont-leave overlay when the send screen is up', () => {
    document.documentElement.setAttribute('data-vr-post-link-one', '1');
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
    expect(isPostLinkSendScreenActive()).toBe(true);
    expect(shouldShowShareAbandon(base)).toBe(false);
  });

  it('stealShareAbandonIfSendTap drops the overlay so Copy wins first tap', () => {
    document.documentElement.setAttribute('data-vr-has-link', '1');
    markSharePending();
    document.body.innerHTML = `
      <input id="ref-link" value="https://www.viralrefer.app/r/VIRAL-TEST1" />
      <button type="button" id="post-link-copy">Copy link</button>
    `;
    forceShareAbandonForTest('unit');
    expect(document.getElementById('vr-share-abandon')).toBeTruthy();
    const copy = document.getElementById('post-link-copy') as HTMLButtonElement;
    copy.getBoundingClientRect = () =>
      ({ left: 10, right: 110, top: 10, bottom: 50, width: 100, height: 40 }) as DOMRect;
    const ev = new MouseEvent('pointerdown', { clientX: 40, clientY: 20, bubbles: true });
    Object.defineProperty(ev, 'target', { value: document.getElementById('vr-share-abandon') });
    stealShareAbandonIfSendTap(ev);
    expect(document.getElementById('vr-share-abandon')).toBeNull();
    dismissShareAbandon();
  });

  it('caps are conservative to limit residual annoyance', () => {
    expect(MAX_SESSION_SHOWS).toBe(3);
    expect(SOFT_SNOOZE_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(POLL_MS).toBeGreaterThanOrEqual(60_000);
    expect(MIN_DWELL_MS).toBeGreaterThanOrEqual(10_000);
  });
});
