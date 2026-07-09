import { describe, it, expect } from 'vitest';
import {
  formatHeroStatsSubtext,
  formatHeroGlobalProofLive,
} from '../../src/lib/public-clarity';

describe('public-clarity', () => {
  it('formatHeroStatsSubtext uses FOMO when board is thin', () => {
    expect(formatHeroStatsSubtext(1, 6)).toContain('#1 has only 6 referrals');
    expect(formatHeroStatsSubtext(1, 6)).toContain('wide open');
  });

  it('formatHeroStatsSubtext uses early invite when alone', () => {
    expect(formatHeroStatsSubtext(0, 0)).toMatch(/first on the live board/i);
  });

  it('formatHeroStatsSubtext uses default when board has depth', () => {
    expect(formatHeroStatsSubtext(12, 40)).toMatch(/early spots still open/i);
  });

  it('formatHeroGlobalProofLive reflects board size', () => {
    expect(formatHeroGlobalProofLive(0)).toMatch(/live free leaderboard/i);
    expect(formatHeroGlobalProofLive(1)).toMatch(/1 person/i);
    expect(formatHeroGlobalProofLive(12)).toMatch(/12 on the live board/i);
  });
});
