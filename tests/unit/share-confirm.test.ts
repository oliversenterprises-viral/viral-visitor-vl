import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  trackShareAwaitingConfirm,
  getPendingIntentShare,
  clearPendingIntentShare,
  confirmIntentShareSent,
  dismissIntentShareConfirm,
  canConfirmYes,
  evaluateConfirmGates,
  markShareSheetSettled,
  MIN_ELAPSED_BEFORE_YES_MS,
  MIN_AWAY_MS,
  DESKTOP_NO_AWAY_FALLBACK_MS,
} from '../../src/lib/share-confirm';
import {
  writeShareDeadlineState,
  clearShareDeadlineState,
  readShareDeadlineState,
  SHARE_DEADLINE_MS,
} from '../../src/lib/share-deadline';

vi.mock('../../src/lib/record-share', () => ({
  recordShareEvent: vi.fn(),
}));

describe('evaluateConfirmGates (anti-cheat)', () => {
  it('blocks confirm while page is hidden (share sheet open)', () => {
    const g = evaluateConfirmGates({
      elapsedMs: 60_000,
      totalAwayMs: 10_000,
      wasAwayLongEnough: true,
      pageVisible: false,
      sheetSettled: true,
      isNative: true,
    });
    expect(g.canShow).toBe(false);
    expect(g.canYes).toBe(false);
  });

  it('blocks yes before min elapsed even if away', () => {
    const g = evaluateConfirmGates({
      elapsedMs: 3_000,
      totalAwayMs: 5_000,
      wasAwayLongEnough: true,
      pageVisible: true,
      sheetSettled: true,
      isNative: true,
    });
    expect(g.canYes).toBe(false);
  });

  it('allows yes after elapsed + away', () => {
    const g = evaluateConfirmGates({
      elapsedMs: MIN_ELAPSED_BEFORE_YES_MS + 500,
      totalAwayMs: MIN_AWAY_MS + 100,
      wasAwayLongEnough: true,
      pageVisible: true,
      sheetSettled: true,
      isNative: true,
    });
    expect(g.canShow).toBe(true);
    expect(g.canYes).toBe(true);
  });

  it('desktop native without away needs long fallback before yes', () => {
    const early = evaluateConfirmGates({
      elapsedMs: MIN_ELAPSED_BEFORE_YES_MS + 1000,
      totalAwayMs: 0,
      wasAwayLongEnough: false,
      pageVisible: true,
      sheetSettled: true,
      isNative: true,
    });
    expect(early.canYes).toBe(false);

    const late = evaluateConfirmGates({
      elapsedMs: DESKTOP_NO_AWAY_FALLBACK_MS + 500,
      totalAwayMs: 0,
      wasAwayLongEnough: false,
      pageVisible: true,
      sheetSettled: true,
      isNative: true,
    });
    expect(late.canYes).toBe(true);
  });
});

describe('share-confirm flow', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPendingIntentShare();
    clearShareDeadlineState();
    document.body.innerHTML = '';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    writeShareDeadlineState({
      code: 'VIRAL-CONF1',
      status: 'pending_share',
      createdAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + SHARE_DEADLINE_MS).toISOString(),
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearPendingIntentShare();
    clearShareDeadlineState();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('native track does not allow immediate confirm', () => {
    trackShareAwaitingConfirm({
      platform: 'native',
      referrer_code: 'VIRAL-CONF1',
      referral_link: 'https://www.viralrefer.app/r/VIRAL-CONF1',
      sheetSettled: false,
    });
    expect(getPendingIntentShare()?.platform).toBe('native');
    expect(canConfirmYes()).toBe(false);
    expect(readShareDeadlineState()?.status).toBe('pending_share');
    expect(document.getElementById('share-confirm-banner')?.classList.contains('hidden') ?? true).toBe(
      true,
    );
  });

  it('confirmIntentShareSent refuses before gates (no lock path)', async () => {
    const { recordShareEvent } = await import('../../src/lib/record-share');
    trackShareAwaitingConfirm({
      platform: 'whatsapp',
      referrer_code: 'VIRAL-CONF1',
      referral_link: 'https://www.viralrefer.app/r/VIRAL-CONF1',
      sheetSettled: true,
    });
    await confirmIntentShareSent();
    expect(recordShareEvent).not.toHaveBeenCalled();
    expect(getPendingIntentShare()?.platform).toBe('whatsapp');
  });

  it('ignores clipboard platforms', () => {
    trackShareAwaitingConfirm({
      platform: 'copy',
      referrer_code: 'VIRAL-CONF1',
      referral_link: 'https://www.viralrefer.app/r/VIRAL-CONF1',
    });
    expect(getPendingIntentShare()).toBeNull();
  });

  it('markShareSheetSettled does not lock', () => {
    trackShareAwaitingConfirm({
      platform: 'native',
      referrer_code: 'VIRAL-CONF1',
      referral_link: 'https://www.viralrefer.app/r/VIRAL-CONF1',
      sheetSettled: false,
    });
    markShareSheetSettled();
    expect(getPendingIntentShare()?.sheetSettled).toBe(true);
    expect(readShareDeadlineState()?.status).toBe('pending_share');
    expect(canConfirmYes()).toBe(false);
  });

  it('dismiss keeps pending', () => {
    trackShareAwaitingConfirm({
      platform: 'whatsapp',
      referrer_code: 'VIRAL-CONF1',
      referral_link: 'https://www.viralrefer.app/r/VIRAL-CONF1',
      sheetSettled: true,
    });
    dismissIntentShareConfirm();
    expect(getPendingIntentShare()?.platform).toBe('whatsapp');
    expect(readShareDeadlineState()?.status).toBe('pending_share');
  });
});
