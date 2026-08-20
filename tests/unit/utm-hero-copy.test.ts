import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveUtmHeroSegment,
  resolveUtmHeroCopy,
  applyUtmHeroCopy,
} from '../../src/lib/utm-hero-copy';
import { captureUtmAttribution } from '../../src/lib/utm-attribution';

describe('utm-hero-copy', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.documentElement.removeAttribute('data-vr-referred-landing');
    document.documentElement.removeAttribute('data-vr-utm-source');
    document.body.innerHTML = `
      <div id="hero-badge"></div>
      <div id="hero-title-line1"></div>
      <div id="hero-title-accent"></div>
      <div id="hero-subtitle"></div>
      <div id="hero-trust-line"></div>
      <button id="hero-get-link-btn"><span>Get my referral link</span></button>
    `;
  });

  it('resolveUtmHeroSegment maps traffic exchanges', () => {
    expect(resolveUtmHeroSegment('pagerankcafe', 'traffic_exchange')).toBe('traffic_exchange');
    expect(resolveUtmHeroSegment('trafficadbar', 'traffic_exchange')).toBe('traffic_exchange');
    expect(resolveUtmHeroSegment('unknown', 'traffic_exchange')).toBe('traffic_exchange');
  });

  it('resolveUtmHeroSegment maps social sources', () => {
    expect(resolveUtmHeroSegment('linkedin', 'social')).toBe('linkedin');
    expect(resolveUtmHeroSegment('reddit', 'social')).toBe('reddit');
    expect(resolveUtmHeroSegment('telegram', 'social')).toBe('telegram');
  });

  it('resolveUtmHeroSegment maps paid medium to paid segment', () => {
    expect(resolveUtmHeroSegment('reddit', 'paid')).toBe('reddit');
    expect(resolveUtmHeroSegment('facebook', 'paid')).toBe('paid');
    expect(resolveUtmHeroSegment('google', 'cpc')).toBe('paid');
  });

  it('resolveUtmHeroCopy paid segment emphasizes get-link then share', () => {
    const copy = resolveUtmHeroCopy('facebook', 'paid');
    expect(copy?.buttonLabel.toLowerCase()).toMatch(/link|share/);
    expect(copy?.titleLine1.toLowerCase()).toMatch(/#1|banner|homepage/);
  });

  it('resolveUtmHeroCopy returns tailored button for trafficadbar', () => {
    const copy = resolveUtmHeroCopy('trafficadbar', 'traffic_exchange');
    expect(copy?.buttonLabel).toBe('Get my link');
    expect(copy?.titleLine1).toMatch(/Win the homepage/i);
    expect(copy?.titleLine1).not.toMatch(/\$10|Cash App/i);
  });

  it('applyUtmHeroCopy paints DOM from stored UTM', () => {
    vi.stubGlobal('location', {
      search: '?utm_source=trafficadbar&utm_medium=traffic_exchange',
      pathname: '/',
    });
    captureUtmAttribution();
    expect(applyUtmHeroCopy()).toBe(true);
    expect(document.getElementById('hero-title-line1')?.textContent).toMatch(/Win the homepage/i);
    expect(document.getElementById('hero-title-line1')?.textContent).not.toMatch(/\$10|Cash App/i);
    expect(document.documentElement.getAttribute('data-vr-utm-source')).toBe('trafficadbar');
  });

  it('applyUtmHeroCopy skips referred landings', () => {
    sessionStorage.setItem('vr_landing_ref', 'VIRAL-FRIEND');
    vi.stubGlobal('location', {
      search: '?utm_source=trafficadbar&utm_medium=traffic_exchange',
      pathname: '/r/VIRAL-FRIEND',
    });
    captureUtmAttribution();
    expect(applyUtmHeroCopy()).toBe(false);
  });
});