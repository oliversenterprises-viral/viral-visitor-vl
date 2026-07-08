import { describe, it, expect } from 'vitest';
import { formatHeroStatsSubtext } from '../../src/lib/public-clarity';

describe('public-clarity', () => {
  it('formatHeroStatsSubtext uses FOMO when board is thin', () => {
    expect(formatHeroStatsSubtext(1, 6)).toContain('#1 has only 6 referrals');
    expect(formatHeroStatsSubtext(1, 6)).toContain('wide open');
  });

  it('formatHeroStatsSubtext uses early contest when alone', () => {
    expect(formatHeroStatsSubtext(0, 0)).toContain('Early contest');
  });

  it('formatHeroStatsSubtext uses default when board has depth', () => {
    expect(formatHeroStatsSubtext(12, 40)).toContain('wide open');
  });
});