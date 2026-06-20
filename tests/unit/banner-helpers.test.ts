import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseBanners,
  selectBanner,
  getBannerKey,
  computeBannerStats,
  clearBannerEvents,
  getLocalBannerEvents,
  BANNER_EVENTS_KEY,
} from '../../src/content';

describe('banner helpers (pure)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getBannerKey builds stable label|url key', () => {
    expect(getBannerKey({ label: 'Promo', redirectUrl: 'https://x.com' })).toBe('Promo|https://x.com');
  });

  it('computeBannerStats aggregates impressions and clicks', () => {
    const events = [
      { type: 'impression', label: 'A', redirectUrl: 'https://a.com', key: 'A|https://a.com', timestamp: '2026-01-01T00:00:00Z' },
      { type: 'click', label: 'A', redirectUrl: 'https://a.com', key: 'A|https://a.com', timestamp: '2026-01-01T00:01:00Z' },
      { type: 'impression', label: 'B', redirectUrl: 'https://b.com', key: 'B|https://b.com', timestamp: '2026-01-01T00:02:00Z' },
    ];
    const stats = computeBannerStats(events);
    expect(stats.perBanner).toHaveLength(2);
    const a = stats.perBanner.find((b) => b.label === 'A');
    expect(a?.impressions).toBe(1);
    expect(a?.clicks).toBe(1);
  });

  it('clearBannerEvents removes local storage', () => {
    localStorage.setItem(BANNER_EVENTS_KEY, JSON.stringify([{ type: 'impression' }]));
    clearBannerEvents();
    expect(getLocalBannerEvents()).toEqual([]);
  });

  it('parseBanners filters invalid entries', () => {
    const raw = [{ imageUrl: 'https://img.jpg', redirectUrl: 'https://go.com', enabled: true }];
    expect(parseBanners(raw)).toHaveLength(1);
    expect(parseBanners([{ imageUrl: '', redirectUrl: 'x' }])).toHaveLength(0);
  });

  it('selectBanner rotates with weights', () => {
    const banners = parseBanners([
      { imageUrl: 'https://a.jpg', redirectUrl: 'https://a.com', weight: 1 },
      { imageUrl: 'https://b.jpg', redirectUrl: 'https://b.com', weight: 3 },
    ]);
    const pick = selectBanner(banners);
    expect(pick?.banner.redirectUrl).toMatch(/https:\/\/(a|b)\.com/);
    expect(pick?.total).toBe(2);
  });
});