import { describe, expect, it } from 'vitest';
import { normalizeSiteContentText } from '../../src/lib/site-content-value';

describe('normalizeSiteContentText', () => {
  it('returns plain strings unchanged', () => {
    expect(normalizeSiteContentText('Hello world')).toBe('Hello world');
  });

  it('unwraps legacy double-encoded JSON strings', () => {
    expect(normalizeSiteContentText('"Refer friends. Climb the leaderboard."')).toBe(
      'Refer friends. Climb the leaderboard.',
    );
  });

  it('returns null for empty values', () => {
    expect(normalizeSiteContentText('')).toBeNull();
    expect(normalizeSiteContentText(null)).toBeNull();
  });
});