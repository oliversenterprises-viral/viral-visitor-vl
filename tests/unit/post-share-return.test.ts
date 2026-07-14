import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/public/globals', () => ({
  getMyReferralCode: () => 'VIRAL-PS1',
  getReferralBaseUrl: () => 'https://www.viralrefer.app',
}));

vi.mock('../../src/lib/share-context', () => ({
  getShareLeaderboardRank: () => null,
  getShareReferralCount: () => 0,
}));

vi.mock('../../src/lib/rank-receipt-card', () => ({
  offerRankReceipt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/duel-invite', () => ({
  syncDuelInviteStrip: vi.fn(),
  triggerDuelInviteMoment: vi.fn(),
}));

vi.mock('../../src/ui', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../src/lib/visitor-tracking', () => ({
  trackVisitorFunnel: vi.fn(),
  trackViralLoopEvent: vi.fn(),
}));

describe('post-share-return', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="share-first-strip"></div>';
    document.documentElement.removeAttribute('data-vr-post-share-return');
    document.documentElement.removeAttribute('data-vr-share-locked');
  });

  afterEach(() => {
    document.getElementById('post-share-return-hub')?.remove();
    vi.clearAllMocks();
  });

  it('activates hub, locks attrs, offers receipt + duel', async () => {
    const { activatePostShareReturnLoop } = await import('../../src/lib/post-share-return');
    const { offerRankReceipt } = await import('../../src/lib/rank-receipt-card');
    const { syncDuelInviteStrip, triggerDuelInviteMoment } = await import(
      '../../src/lib/duel-invite'
    );

    await activatePostShareReturnLoop();

    expect(document.documentElement.getAttribute('data-vr-post-share-return')).toBe('1');
    expect(document.documentElement.getAttribute('data-vr-share-locked')).toBe('1');
    expect(document.getElementById('post-share-return-hub')).toBeTruthy();
    expect(document.getElementById('post-share-return-hub')?.textContent).toMatch(/climb|Challenge/i);
    expect(offerRankReceipt).toHaveBeenCalled();
    expect(syncDuelInviteStrip).toHaveBeenCalled();
    expect(triggerDuelInviteMoment).toHaveBeenCalled();
  });
});
