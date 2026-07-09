/**
 * Unit tests for claim leader ranking (edge shared pure helpers).
 * Source lives under supabase/functions/_shared — imported for parity with edge.
 */
import { describe, it, expect } from 'vitest';
import {
  computeClaimLeader,
  isSafeHttpUrl,
  isValidCashtag,
} from '../../supabase/functions/_shared/claim-leader.ts';

describe('computeClaimLeader', () => {
  it('returns null for empty rows', () => {
    expect(computeClaimLeader([])).toBeNull();
  });

  it('picks highest count and ignores test codes', () => {
    const result = computeClaimLeader([
      { referrer_code: 'VIRAL-SMOKETEST', created_at: '2026-01-01T00:00:00Z' },
      { referrer_code: 'VIRAL-SMOKETEST', created_at: '2026-01-02T00:00:00Z' },
      { referrer_code: 'VIRAL-AAA111', created_at: '2026-01-03T00:00:00Z' },
      { referrer_code: 'VIRAL-AAA111', created_at: '2026-01-04T00:00:00Z' },
      { referrer_code: 'VIRAL-BBB222', created_at: '2026-01-05T00:00:00Z' },
    ]);
    expect(result).not.toBeNull();
    expect(result!.topReferrerCode).toBe('VIRAL-AAA111');
    expect(result!.topCount).toBe(2);
    expect(result!.counts['VIRAL-SMOKETEST']).toBeUndefined();
  });

  it('breaks ties with earliest first-seen', () => {
    const result = computeClaimLeader([
      { referrer_code: 'VIRAL-LATE', created_at: '2026-02-01T00:00:00Z' },
      { referrer_code: 'VIRAL-EARLY', created_at: '2026-01-01T00:00:00Z' },
      { referrer_code: 'VIRAL-LATE', created_at: '2026-02-02T00:00:00Z' },
      { referrer_code: 'VIRAL-EARLY', created_at: '2026-01-02T00:00:00Z' },
    ]);
    expect(result!.topReferrerCode).toBe('VIRAL-EARLY');
    expect(result!.topCount).toBe(2);
  });

  it('filters owner/automation IPs and automation UAs', () => {
    const result = computeClaimLeader([
      {
        referrer_code: 'VIRAL-OWNER',
        referred_ip: '161.38.136.60',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        referrer_code: 'VIRAL-OWNER',
        referred_ip: '161.38.136.60',
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        referrer_code: 'VIRAL-REAL1',
        referred_ip: '8.8.8.8',
        user_agent: 'Mozilla/5.0',
        created_at: '2026-01-03T00:00:00Z',
      },
    ]);
    expect(result!.topReferrerCode).toBe('VIRAL-REAL1');
    expect(result!.topCount).toBe(1);
  });
});

describe('isSafeHttpUrl', () => {
  it('allows https and http', () => {
    expect(isSafeHttpUrl('https://www.viralrefer.app')).toBe(true);
    expect(isSafeHttpUrl('http://localhost:5173')).toBe(true);
  });

  it('rejects javascript and non-urls', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,hi')).toBe(false);
    expect(isSafeHttpUrl('not a url')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
  });
});

describe('isValidCashtag', () => {
  it('accepts $Handle and Handle', () => {
    expect(isValidCashtag('$Olive')).toBe(true);
    expect(isValidCashtag('Olive_1')).toBe(true);
  });

  it('rejects empty and junk', () => {
    expect(isValidCashtag('')).toBe(false);
    expect(isValidCashtag('$')).toBe(false);
    expect(isValidCashtag('has space')).toBe(false);
  });
});
