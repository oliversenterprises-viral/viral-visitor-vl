import { describe, it, expect } from 'vitest';
import {
  filterByDays,
  filterSharesBySearch,
  filterSharesByPlatform,
  applyShareFilters,
  computeAnalyticsData,
  getUniquePlatforms,
  extractReferrerCodeFromLink,
  normalizeShareRow,
  type ShareEvent,
} from '../../src/admin/share-analytics-helpers';

const makeShare = (overrides: Partial<ShareEvent> = {}): ShareEvent => ({
  platform: 'twitter',
  referrer_code: 'VIRAL-ABC',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('share analytics helpers (pure)', () => {
  it('filterSharesBySearch matches referrer and platform', () => {
    const shares = [
      makeShare({ referrer_code: 'VIRAL-1', platform: 'twitter' }),
      makeShare({ referrer_code: 'OTHER', platform: 'reddit' }),
    ];
    expect(filterSharesBySearch(shares, 'viral').length).toBe(1);
    expect(filterSharesBySearch(shares, 'reddit').length).toBe(1);
    expect(filterSharesBySearch(shares, '').length).toBe(2);
  });

  it('filterSharesByPlatform filters by platform name', () => {
    const shares = [
      makeShare({ platform: 'twitter' }),
      makeShare({ platform: 'reddit' }),
      makeShare({ platform: 'twitter' }),
    ];
    expect(filterSharesByPlatform(shares, 'twitter').length).toBe(2);
    expect(filterSharesByPlatform(shares, 'all').length).toBe(3);
  });

  it('applyShareFilters composes day, search, and platform', () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 20 * 86400000).toISOString();
    const shares = [
      makeShare({ referrer_code: 'VIRAL-1', platform: 'twitter', created_at: now }),
      makeShare({ referrer_code: 'VIRAL-2', platform: 'reddit', created_at: now }),
      makeShare({ referrer_code: 'OLD', platform: 'twitter', created_at: old }),
    ];
    const filtered = applyShareFilters(shares, 7, 'viral', 'twitter');
    expect(filtered.length).toBe(1);
    expect(filtered[0].referrer_code).toBe('VIRAL-1');
  });

  it('computeAnalyticsData returns zero-state insights for empty input', () => {
    const data = computeAnalyticsData([]);
    expect(data.total).toBe(0);
    expect(data.insights[0]).toContain('No shares');
  });

  it('getUniquePlatforms returns platforms sorted by count', () => {
    const shares = [
      makeShare({ platform: 'twitter' }),
      makeShare({ platform: 'twitter' }),
      makeShare({ platform: 'reddit' }),
    ];
    expect(getUniquePlatforms(shares)).toEqual(['twitter', 'reddit']);
  });

  it('filterByDays returns all when days=0', () => {
    const shares = [makeShare(), makeShare()];
    expect(filterByDays(shares, 0).length).toBe(2);
  });

  it('extractReferrerCodeFromLink parses /r/ path', () => {
    expect(extractReferrerCodeFromLink('https://www.viralrefer.app/r/VIRAL-97UWEGZ')).toBe(
      'VIRAL-97UWEGZ',
    );
    expect(extractReferrerCodeFromLink('')).toBeNull();
  });

  it('normalizeShareRow derives referrer_code from referral_link when missing', () => {
    const row = normalizeShareRow({
      platform: 'telegram',
      referral_link: 'https://www.viralrefer.app/r/VIRAL-TEST12',
      created_at: '2026-05-12T00:00:00Z',
    });
    expect(row.referrer_code).toBe('VIRAL-TEST12');
    expect(row.platform).toBe('telegram');
  });
});