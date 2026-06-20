import { describe, it, expect } from 'vitest';
import { parseBanners } from '../../src/content';

describe('banner edit data loading', () => {
  it('parses live-style double-encoded banners JSON string', () => {
    const raw =
      '[{"imageUrl":"https://example.com/a.png","redirectUrl":"https://example.com","label":"","enabled":true,"weight":1}]';
    const banners = parseBanners(raw);
    expect(banners).toHaveLength(1);
    expect(banners[0].imageUrl).toContain('example.com');
  });

  it('parses native JSONB array objects', () => {
    const raw = [
      { imageUrl: 'https://example.com/b.png', redirectUrl: 'https://example.com/join', enabled: true, weight: 2 },
    ];
    const banners = parseBanners(raw);
    expect(banners[0].weight).toBe(2);
  });
});