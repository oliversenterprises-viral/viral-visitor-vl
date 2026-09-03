import { describe, expect, it } from 'vitest';
import {
  isAgentAutomationMetadata,
  isAutomationUserAgent,
  isTestReferralRecord,
  isTestReferrerCode,
  shouldSkipReferralCrediting,
} from '../../supabase/functions/_shared/test-referral';
import { getClientAutomationMetadata } from '../../src/lib/test-referral';

describe('test-referral guards', () => {
  it('flags agent and script user agents, not real Chrome', () => {
    expect(isAutomationUserAgent('node')).toBe(true);
    expect(isAutomationUserAgent('curl/8.7.1')).toBe(true);
    expect(isAutomationUserAgent('Mozilla/5.0 HeadlessChrome/131')).toBe(true);
    expect(
      isAutomationUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 playwright',
      ),
    ).toBe(true);
    expect(isAutomationUserAgent('Mozilla/5.0 Chrome')).toBe(false);
    expect(isAutomationUserAgent('Mozilla/5.0 scout Chrome/131')).toBe(true);
    expect(isAutomationUserAgent('cursor-scout/1.0')).toBe(true);
    expect(isAutomationUserAgent('cursorbot')).toBe(true);
    expect(isAgentAutomationMetadata({ webdriver: true })).toBe(true);
    expect(isAgentAutomationMetadata({})).toBe(false);
    Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => true });
    expect(getClientAutomationMetadata()).toEqual({ webdriver: true });
    Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
    expect(getClientAutomationMetadata()).toEqual({});
  });

  it('flags smoke referrer codes', () => {
    expect(isTestReferrerCode('VIRAL-SMOKETEST')).toBe(true);
    expect(isTestReferrerCode('VIRAL-E2ECLAIM')).toBe(true);
    expect(isTestReferrerCode('VIRAL-LIVECHK1')).toBe(true);
    expect(isTestReferrerCode('VIRAL-97UWEGZ')).toBe(false);
    expect(isTestReferrerCode('RELAY')).toBe(true);
    expect(isTestReferrerCode('VIRAL-SCOUT')).toBe(true);
    expect(isTestReferrerCode('SCOUT')).toBe(true);
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