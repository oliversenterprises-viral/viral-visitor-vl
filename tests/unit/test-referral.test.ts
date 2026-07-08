import { describe, expect, it } from 'vitest';
import {
  isTestReferralRecord,
  isTestReferrerCode,
  shouldSkipReferralCrediting,
} from '../../supabase/functions/_shared/test-referral';

describe('test-referral guards', () => {
  it('flags smoke referrer codes', () => {
    expect(isTestReferrerCode('VIRAL-SMOKETEST')).toBe(true);
    expect(isTestReferrerCode('VIRAL-97UWEGZ')).toBe(false);
  });

  it('skips owner IP and headless automation', () => {
    expect(
      shouldSkipReferralCrediting({
        referrerCode: 'VIRAL-97UWEGZ',
        referredIp: '161.38.136.60',
        userAgent: 'Mozilla/5.0 Chrome',
      }),
    ).toBe(true);
    expect(
      shouldSkipReferralCrediting({
        referrerCode: 'VIRAL-97UWEGZ',
        referredIp: '57.138.135.240',
        userAgent: 'Mozilla/5.0 Chrome',
      }),
    ).toBe(true);
    expect(
      shouldSkipReferralCrediting({
        referrerCode: 'VIRAL-97UWEGZ',
        referredIp: '1.2.3.4',
        userAgent: 'Mozilla/5.0 HeadlessChrome/149',
      }),
    ).toBe(true);
    expect(
      shouldSkipReferralCrediting({
        referrerCode: 'VIRAL-97UWEGZ',
        referredIp: '182.62.227.19',
        userAgent: 'Mozilla/5.0 Chrome',
      }),
    ).toBe(false);
  });

  it('classifies stored rows for display filters', () => {
    expect(
      isTestReferralRecord({
        referrer_code: 'VIRAL-SMOKETEST',
        referred_ip: '20.1.1.1',
        user_agent: 'node',
      }),
    ).toBe(true);
    expect(
      isTestReferralRecord({
        referrer_code: 'VIRAL-97UWEGZ',
        referred_ip: '182.62.227.19',
        user_agent: 'Mozilla/5.0 Chrome',
      }),
    ).toBe(false);
  });
});