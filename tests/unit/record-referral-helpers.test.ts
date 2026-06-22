import { describe, it, expect } from 'vitest';
import { isValidReferrerCode, normalizeReferrerCode } from '../../src/lib/referrer-code';

describe('record-referral validation (prod schema)', () => {
  it('accepts client-generated VIRAL codes', () => {
    expect(isValidReferrerCode('VIRAL-97UWEGZ')).toBe(true);
  });

  it('rejects empty or malformed codes', () => {
    expect(isValidReferrerCode('')).toBe(false);
    expect(isValidReferrerCode('ab')).toBe(false);
    expect(isValidReferrerCode('bad code!')).toBe(false);
  });

  it('normalizes case and whitespace', () => {
    expect(normalizeReferrerCode('  viral-abc123  ')).toBe('VIRAL-ABC123');
  });
});