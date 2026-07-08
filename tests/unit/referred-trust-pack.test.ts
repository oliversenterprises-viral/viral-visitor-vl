import { describe, it, expect } from 'vitest';
import {
  buildReferredTrustPackMainLine,
  buildReferredTrustPackPersonalLine,
  buildReferredTrustPackHtml,
} from '../../src/lib/referred-trust-pack';

describe('referred-trust-pack', () => {
  const board = [
    { referrer_code: 'VIRAL-A', referral_count: 2, rank: 1 },
    { referrer_code: 'VIRAL-B', referral_count: 1, rank: 2 },
  ];

  it('buildReferredTrustPackMainLine shows competition and leader', () => {
    const line = buildReferredTrustPackMainLine({ board, uniqueReferrers: 2 });
    expect(line).toContain('2 referrers competing');
    expect(line).toContain('#1 has 2 referrals');
    expect(line).toContain('wide open');
  });

  it('buildReferredTrustPackPersonalLine shows gap to next rank', () => {
    const line = buildReferredTrustPackPersonalLine({
      board,
      uniqueReferrers: 2,
      myCode: 'VIRAL-B',
      myCount: 1,
      myRank: 2,
    });
    expect(line).toContain('2 referrals');
    expect(line).toContain('#1');
  });

  it('buildReferredTrustPackPersonalLine encourages new visitors', () => {
    const line = buildReferredTrustPackPersonalLine({
      board,
      uniqueReferrers: 2,
      myCode: 'VIRAL-NEW',
      myCount: 0,
      myRank: null,
    });
    expect(line).toContain('1 referral puts you in the race');
  });

  it('buildReferredTrustPackHtml wraps main and personal lines', () => {
    const html = buildReferredTrustPackHtml({
      board,
      uniqueReferrers: 2,
      myCode: 'VIRAL-B',
      myCount: 1,
      myRank: 2,
    });
    expect(html).toContain('referred-trust-pack');
    expect(html).toContain('competing');
  });
});