import { describe, it, expect } from 'vitest';
import { isEmbedMode } from '../../src/lib/embed-mode';
import { buildEmbedAdUrl } from '../../scripts/growth-post-queue-helpers.mjs';

describe('embed-mode', () => {
  it('isEmbedMode detects /embed path', () => {
    expect(isEmbedMode({ pathname: '/embed', search: '' } as Location)).toBe(true);
    expect(isEmbedMode({ pathname: '/embed/', search: '' } as Location)).toBe(true);
  });

  it('isEmbedMode detects embed query flag', () => {
    expect(isEmbedMode({ pathname: '/', search: '?embed=1' } as Location)).toBe(true);
    expect(isEmbedMode({ pathname: '/', search: '?iframe=1' } as Location)).toBe(true);
    expect(isEmbedMode({ pathname: '/', search: '' } as Location)).toBe(false);
  });

  it('buildEmbedAdUrl points to /embed with UTMs', () => {
    const url = buildEmbedAdUrl({ source: 'trafficadbar' });
    expect(url).toContain('/embed?');
    expect(url).toContain('utm_source=trafficadbar');
    expect(url).toContain('utm_campaign=embed');
  });
});