import { describe, it, expect } from 'vitest';
import {
  shareCardDimensions,
  shareCardFilename,
  buildShareCardStatusLine,
} from '../../src/lib/share-cards';

describe('share-cards', () => {
  it('shareCardDimensions returns correct aspect ratios', () => {
    expect(shareCardDimensions('square')).toEqual({ width: 1080, height: 1080 });
    expect(shareCardDimensions('story')).toEqual({ width: 1080, height: 1920 });
  });

  it('shareCardFilename includes code and format', () => {
    expect(shareCardFilename('VIRAL-ABC', 'square')).toBe('viralrefer-VIRAL-ABC-share.png');
    expect(shareCardFilename('VIRAL-ABC', 'story')).toBe('viralrefer-VIRAL-ABC-story.png');
  });

  it('buildShareCardStatusLine personalizes rank and gap', () => {
    expect(buildShareCardStatusLine({ rank: 1 })).toContain('#1');
    expect(buildShareCardStatusLine({ rank: 4, gapToNext: 2 })).toMatch(/#4/);
    expect(buildShareCardStatusLine({ rank: 4, gapToNext: 2 })).toMatch(/2 MORE/);
    expect(buildShareCardStatusLine({ referralCount: 0 })).toMatch(/UNRANKED/i);
    expect(buildShareCardStatusLine({ referralCount: 3 })).toMatch(/3 REFERRAL/);
  });
});