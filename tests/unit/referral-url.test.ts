import { describe, expect, it } from 'vitest';
import {
  buildCleanReferralLink,
  normalizeReferralCode,
  parseRefFromLocation,
} from '../../src/lib/referral-url';

function mockLocation(pathname: string, search = '') {
  return { pathname, search } as Location;
}

describe('referral-url', () => {
  it('parses ?ref= query', () => {
    expect(parseRefFromLocation(mockLocation('/', '?ref=viral-abc123'))).toBe('VIRAL-ABC123');
  });

  it('parses /r/CODE path', () => {
    expect(parseRefFromLocation(mockLocation('/r/VIRAL-97UWEGZ'))).toBe('VIRAL-97UWEGZ');
    expect(parseRefFromLocation(mockLocation('/r/viral-97uwegz/'))).toBe('VIRAL-97UWEGZ');
  });

  it('builds clean path link', () => {
    expect(buildCleanReferralLink('VIRAL-97UWEGZ')).toBe(
      'https://www.viralrefer.app/r/VIRAL-97UWEGZ',
    );
  });

  it('normalizes codes', () => {
    expect(normalizeReferralCode(' viral-x ')).toBe('VIRAL-X');
  });
});