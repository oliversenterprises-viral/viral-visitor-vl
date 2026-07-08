import { describe, it, expect } from 'vitest';
import {
  shareCardDimensions,
  shareCardFilename,
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
});