import { describe, it, expect } from 'vitest';
import {
  isValidReferrerCode as clientIsValid,
  normalizeReferrerCode as clientNormalize,
  REFERRER_CODE_RE as clientRe,
} from '../../src/lib/referrer-code';
import {
  isValidReferrerCode as edgeIsValid,
  normalizeReferrerCode as edgeNormalize,
  REFERRER_CODE_RE as edgeRe,
} from '../../supabase/functions/_shared/referrer-code';

describe('record-referral validation (edge _shared ↔ client re-export)', () => {
  it('client re-export matches edge _shared module exports', () => {
    expect(clientRe).toBe(edgeRe);
    expect(clientNormalize('  viral-x  ')).toBe(edgeNormalize('  viral-x  '));
    expect(clientIsValid('VIRAL-97UWEGZ')).toBe(edgeIsValid('VIRAL-97UWEGZ'));
  });

  it('accepts client-generated VIRAL codes', () => {
    expect(edgeIsValid('VIRAL-97UWEGZ')).toBe(true);
  });

  it('rejects empty or malformed codes', () => {
    expect(edgeIsValid('')).toBe(false);
    expect(edgeIsValid('ab')).toBe(false);
    expect(edgeIsValid('bad code!')).toBe(false);
  });

  it('normalizes case and whitespace', () => {
    expect(edgeNormalize('  viral-abc123  ')).toBe('VIRAL-ABC123');
  });
});