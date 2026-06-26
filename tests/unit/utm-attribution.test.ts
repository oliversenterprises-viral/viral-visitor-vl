import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureUtmAttribution, getStoredUtmAttribution } from '../../src/lib/utm-attribution';

describe('utm-attribution', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', {
      search: '?utm_source=reddit&utm_medium=paid&utm_campaign=launch_week1&utm_content=banner&ref=VIRAL-97UWEGZ',
      pathname: '/',
    });
  });

  it('captures and stores UTM attribution from URL', () => {
    const result = captureUtmAttribution();
    expect(result?.source).toBe('reddit');
    expect(result?.medium).toBe('paid');
    expect(result?.campaign).toBe('launch_week1');
    expect(result?.ref).toBe('VIRAL-97UWEGZ');

    const stored = getStoredUtmAttribution();
    expect(stored?.content).toBe('banner');
  });

  it('returns null when no utm_source in URL', () => {
    vi.stubGlobal('location', { search: '?ref=VIRAL-TEST', pathname: '/' });
    expect(captureUtmAttribution()).toBeNull();
  });
});