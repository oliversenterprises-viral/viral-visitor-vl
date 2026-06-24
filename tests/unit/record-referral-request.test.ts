import { describe, expect, it } from 'vitest';
import {
  isSelfReferral,
  parseRecordReferralRequest,
} from '../../supabase/functions/_shared/record-referral-request';

describe('record-referral edge request parser (shipped _shared module)', () => {
  it('parses production-shaped POST body', () => {
    const parsed = parseRecordReferralRequest({
      referrerCode: '  viral-abc123  ',
      turnstileToken: 'cf-token-xyz',
      visitorCode: 'VIRAL-VISITOR',
    });
    expect(parsed).toEqual({
      referrerCode: 'VIRAL-ABC123',
      turnstileToken: 'cf-token-xyz',
      referredCode: 'VIRAL-VISITOR',
    });
  });

  it('accepts snake_case field aliases from legacy clients', () => {
    const parsed = parseRecordReferralRequest({
      referrer_code: 'VIRAL-LEGACY',
      token: 'legacy-token',
    });
    expect(parsed.referrerCode).toBe('VIRAL-LEGACY');
    expect(parsed.turnstileToken).toBe('legacy-token');
    expect(parsed.referredCode).toBeNull();
  });

  it('rejects invalid referrerCode (same error path as edge 400)', () => {
    expect(() => parseRecordReferralRequest({ referrerCode: 'bad!', turnstileToken: 't' }))
      .toThrow('Missing or invalid referrerCode');
  });

  it('allows missing turnstileToken (server rate limit + dedupe path)', () => {
    const parsed = parseRecordReferralRequest({ referrerCode: 'VIRAL-OK' });
    expect(parsed.referrerCode).toBe('VIRAL-OK');
    expect(parsed.turnstileToken).toBeNull();
  });

  it('detects self-referral before DB insert', () => {
    expect(isSelfReferral('VIRAL-SAME', 'VIRAL-SAME')).toBe(true);
    expect(isSelfReferral('VIRAL-A', 'VIRAL-B')).toBe(false);
    expect(isSelfReferral('VIRAL-A', null)).toBe(false);
  });
});