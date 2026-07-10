import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyWorldwideReferralTotal,
  formatVerifiedReferralTotalLabel,
  formatVerifiedReferralTotalLive,
  formatVerifiedReferralTotalMeta,
} from '../../src/lib/worldwide-referral-total';

describe('worldwide-referral-total', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="vr-verified-total">
        <span id="total-referrers">—</span>
        <span id="hero-stats-suffix"></span>
        <p id="hero-board-meta"></p>
      </div>
      <span id="hero-global-proof-live"></span>
      <span id="leaderboard-total-referrals">—</span>
      <span id="leaderboard-total-label"></span>
    `;
  });

  it('formats labels for singular and plural', () => {
    expect(formatVerifiedReferralTotalLabel(1)).toBe('verified referral worldwide');
    expect(formatVerifiedReferralTotalLabel(6)).toBe('verified referrals worldwide');
  });

  it('formats live strip with total', () => {
    expect(formatVerifiedReferralTotalLive(0)).toMatch(/live free leaderboard/i);
    expect(formatVerifiedReferralTotalLive(1)).toBe('1 verified referral worldwide');
    expect(formatVerifiedReferralTotalLive(12)).toBe('12 verified referrals worldwide');
  });

  it('formats meta with board + leader', () => {
    expect(formatVerifiedReferralTotalMeta(3, 5)).toMatch(/3 people/);
    expect(formatVerifiedReferralTotalMeta(3, 5)).toMatch(/#1 has 5/);
  });

  it('applyWorldwideReferralTotal paints all surfaces', () => {
    applyWorldwideReferralTotal({ total: 6, uniqueReferrers: 2, leaderCount: 4 });
    expect(document.getElementById('total-referrers')!.textContent).toBe('6');
    expect(document.getElementById('total-referrers')!.getAttribute('data-vr-total-verified')).toBe(
      '6',
    );
    expect(document.getElementById('hero-stats-suffix')!.textContent).toMatch(/verified referrals worldwide/);
    expect(document.getElementById('hero-global-proof-live')!.textContent).toMatch(/6 verified/);
    expect(document.getElementById('leaderboard-total-referrals')!.textContent).toBe('6');
    expect(document.getElementById('vr-verified-total')!.classList.contains('vr-verified-total--ready')).toBe(
      true,
    );
  });
});
