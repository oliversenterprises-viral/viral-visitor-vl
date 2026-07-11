import { describe, it, expect } from 'vitest';
import {
  mergePublicActivityRows,
  countReferralVelocityLastHour,
  filterPublicShareRows,
  formatSharePlatformLabel,
  buildActivityVelocityHtml,
  buildReferredHeroSocialProofText,
  buildReferredHeroSocialProofHtml,
  buildDirectHeroSocialProofText,
  buildDirectHeroSocialProofHtml,
} from '../../src/lib/public-activity';

describe('public-activity', () => {
  it('mergePublicActivityRows interleaves by time and filters test rows', () => {
    const merged = mergePublicActivityRows(
      [
        { referrer_code: 'VIRAL-A', created_at: '2026-06-30T10:00:00Z' },
        { referrer_code: 'VIRAL-PROBE', created_at: '2026-06-30T12:00:00Z' },
      ],
      [{ referrer_code: 'VIRAL-B', created_at: '2026-06-30T11:00:00Z', platform: 'twitter' }],
      5,
    );
    expect(merged.map((r) => r.referrer_code)).toEqual(['VIRAL-B', 'VIRAL-A']);
    expect(merged[0]?.kind).toBe('share');
  });

  it('countReferralVelocityLastHour counts recent real referrals only', () => {
    const now = new Date('2026-06-30T12:00:00Z').getTime();
    const count = countReferralVelocityLastHour(
      [
        { referrer_code: 'VIRAL-A', created_at: '2026-06-30T11:30:00Z' },
        { referrer_code: 'VIRAL-B', created_at: '2026-06-30T09:00:00Z' },
        { referrer_code: 'SMOKETEST', created_at: '2026-06-30T11:50:00Z' },
      ],
      now,
    );
    expect(count).toBe(1);
  });

  it('filterPublicShareRows removes agent codes', () => {
    expect(
      filterPublicShareRows([
        { referrer_code: 'VIRAL-X', created_at: '2026-06-30T12:00:00Z' },
        { referrer_code: 'DEMOCODE', created_at: '2026-06-30T12:00:00Z' },
      ]),
    ).toHaveLength(1);
  });

  it('formatSharePlatformLabel normalizes copy and twitter', () => {
    expect(formatSharePlatformLabel('copy')).toBe('link copy');
    expect(formatSharePlatformLabel('twitter')).toBe('Twitter');
  });

  it('buildActivityVelocityHtml hides at zero', () => {
    expect(buildActivityVelocityHtml(0)).toBe('');
    expect(buildActivityVelocityHtml(3)).toContain('3 referrals in the last hour');
  });

  it('buildReferredHeroSocialProofText combines velocity and latest share', () => {
    const text = buildReferredHeroSocialProofText(
      [
        {
          kind: 'share',
          referrer_code: 'VIRAL-Z',
          created_at: '2026-06-30T12:00:00Z',
          platform: 'reddit',
        },
      ],
      2,
    );
    expect(text).toContain('2 referrals in the last hour');
    expect(text).toContain('VIRAL-Z just shared on Reddit');
  });

  it('buildReferredHeroSocialProofHtml returns empty without signal', () => {
    expect(buildReferredHeroSocialProofHtml([], 0)).toBe('');
    expect(buildReferredHeroSocialProofHtml(
      [{ kind: 'referral', referrer_code: 'VIRAL-A', created_at: '2026-06-30T12:00:00Z' }],
      0,
    )).toContain('hero-referred-social-proof');
  });

  it('buildDirectHeroSocialProofText includes referrer count and velocity', () => {
    const text = buildDirectHeroSocialProofText(
      [
        {
          kind: 'share',
          referrer_code: 'VIRAL-Z',
          created_at: '2026-06-30T12:00:00Z',
          platform: 'reddit',
        },
      ],
      2,
      12,
    );
    expect(text).toContain('12 referrers competing now');
    expect(text).toContain('2 referrals in the last hour');
    expect(text).toContain('VIRAL-Z just shared on Reddit');
  });

  it('buildDirectHeroSocialProofHtml always shows FOMO when board is quiet', () => {
    // Product rule: never silence direct hero — empty board gets open-board FOMO
    const empty = buildDirectHeroSocialProofHtml([], 0, 0);
    expect(empty).toContain('Board is open worldwide');
    expect(buildDirectHeroSocialProofHtml([], 0, 5)).toContain('5 referrers competing now');
  });

  it('buildDirectHeroSocialProofText prefers leader FOMO on thin board', () => {
    const text = buildDirectHeroSocialProofText([], 0, 1, 6);
    expect(text).toMatch(/#1 has only 6 referral/);
    expect(text).toContain('wide open board');
    expect(text).not.toContain('1 referrer competing');
  });
});