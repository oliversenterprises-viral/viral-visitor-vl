import { describe, it, expect } from 'vitest';
import {
  formatBannerCtr,
  computeBannerTotals,
  sortBannerRows,
  filterBannerRowsBySearch,
  findTopPerformer,
  type BannerStatRow,
} from '../../src/admin/banner-stats-helpers';

const row = (overrides: Partial<BannerStatRow> = {}): BannerStatRow => ({
  key: 'A|https://a.com',
  label: 'A',
  redirectUrl: 'https://a.com',
  impressions: 10,
  clicks: 2,
  ...overrides,
});

describe('banner stats helpers (pure)', () => {
  it('formatBannerCtr handles zero impressions', () => {
    expect(formatBannerCtr(0, 0)).toBe('—');
    expect(formatBannerCtr(10, 2)).toBe('20.0%');
  });

  it('computeBannerTotals sums impressions and clicks', () => {
    const totals = computeBannerTotals([row(), row({ impressions: 5, clicks: 1 })]);
    expect(totals.impressions).toBe(15);
    expect(totals.clicks).toBe(3);
  });

  it('sortBannerRows sorts by clicks', () => {
    const sorted = sortBannerRows([row({ clicks: 1 }), row({ label: 'B', clicks: 5 })], 'clicks');
    expect(sorted[0].clicks).toBe(5);
  });

  it('filterBannerRowsBySearch matches label and url', () => {
    const rows = [row(), row({ label: 'Promo', redirectUrl: 'https://promo.com', key: 'Promo|https://promo.com' })];
    expect(filterBannerRowsBySearch(rows, 'promo').length).toBe(1);
    expect(filterBannerRowsBySearch(rows, '').length).toBe(2);
  });

  it('findTopPerformer requires minimum impressions', () => {
    const rows = [
      row({ impressions: 1, clicks: 1 }),
      row({ label: 'B', impressions: 10, clicks: 2 }),
    ];
    expect(findTopPerformer(rows, 3)?.label).toBe('B');
    expect(findTopPerformer(rows, 20)).toBeNull();
  });
});