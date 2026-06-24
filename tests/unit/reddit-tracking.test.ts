import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  applyRedditLandingCopy,
  captureUtmAttribution,
  getStoredUtmAttribution,
} from '../../src/lib/reddit-tracking';

describe('reddit-tracking', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', {
      search: '?utm_source=reddit&utm_medium=paid&utm_campaign=launch_week1&utm_content=banner&ref=VIRAL-97UWEGZ',
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
    vi.stubGlobal('location', { search: '?ref=VIRAL-TEST' });
    expect(captureUtmAttribution()).toBeNull();
  });

  it('applyRedditLandingCopy updates hero for Reddit traffic', () => {
    captureUtmAttribution();
    document.body.innerHTML = `
      <div id="hero-badge"></div>
      <span id="hero-title-line1"></span>
      <p id="hero-subtitle"></p>
    `;
    applyRedditLandingCopy();
    expect(document.getElementById('hero-badge')?.textContent).toContain('FROM REDDIT');
    expect(document.getElementById('hero-title-line1')?.textContent).toContain('clicked the ad');
    expect(document.getElementById('hero-subtitle')?.textContent).toContain('Reddit');
  });
});