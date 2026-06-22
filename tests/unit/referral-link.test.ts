import { describe, expect, it, beforeEach } from 'vitest';
import { buildReferralLink } from '../../src/referral';
import { setReferralBaseUrl } from '../../src/public/globals';

describe('buildReferralLink', () => {
  beforeEach(() => {
    setReferralBaseUrl('https://www.viralrefer.app');
  });

  it('builds clean /r/ path from configured base', () => {
    expect(buildReferralLink('VIRAL-ABC123')).toBe(
      'https://www.viralrefer.app/r/VIRAL-ABC123',
    );
  });

  it('falls back to location.origin on invalid base URL', () => {
    setReferralBaseUrl('not-a-valid-url');
    const link = buildReferralLink('VIRAL-FALLBACK');
    expect(link).toMatch(/\/r\/VIRAL-FALLBACK$/);
  });
});