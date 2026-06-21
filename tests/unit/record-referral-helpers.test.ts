import { describe, it, expect } from 'vitest';

const REFERRER_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{3,19}$/;

function normalizeReferrerCode(raw: unknown): string {
  return String(raw || '').trim().toUpperCase();
}

function isValidReferrerCode(code: string): boolean {
  return REFERRER_CODE_RE.test(code);
}

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