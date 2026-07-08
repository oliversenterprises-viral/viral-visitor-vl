import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadSiteContent } from '../../src/app';
import * as supabaseMod from '../../src/lib/supabase';
import { getReferralBaseUrl } from '../../src/public/globals';
import { buildReferralLinkFromBase, parseRefFromLocation } from '../../src/lib/referral-url';

function locationFromUrl(url: string): Location {
  const u = new URL(url);
  return { pathname: u.pathname, search: u.search } as Location;
}

describe('loadSiteContent (fetchSiteContent → updatePublicContent → referral base)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('applies referral_base_url from fetched site_content', async () => {
    vi.spyOn(supabaseMod, 'fetchSiteContent').mockResolvedValue({
      referral_base_url: 'https://mybrand.com/join',
      hero_title_line1: 'Test Hero',
    });

    document.body.innerHTML = '<h1 id="hero-title-line1"></h1>';

    await loadSiteContent();

    expect(getReferralBaseUrl()).toBe('https://mybrand.com/join');
    expect(document.getElementById('hero-title-line1')?.textContent).toBe('Test Hero');

    const link = buildReferralLinkFromBase('VIRAL-LOAD', getReferralBaseUrl());
    expect(parseRefFromLocation(locationFromUrl(link))).toBe('VIRAL-LOAD');
  });

  it('maps legacy hero_title to hero-title-line1 and unwraps quoted values', async () => {
    vi.spyOn(supabaseMod, 'fetchSiteContent').mockResolvedValue({
      hero_title: '"Custom headline from admin"',
      hero_subtitle: '"Custom subtitle"',
      cta_button_text: 'Tap for your link',
    });

    document.body.innerHTML = `
      <span id="hero-title-line1"></span>
      <p id="hero-subtitle"></p>
      <button id="hero-get-link-btn"><span>Get my referral link</span></button>
    `;

    await loadSiteContent();

    expect(document.getElementById('hero-title-line1')?.textContent).toBe('Custom headline from admin');
    expect(document.getElementById('hero-subtitle')?.textContent).toBe('Custom subtitle');
    expect(document.querySelector('#hero-get-link-btn span')?.textContent).toBe('Tap for your link');
  });
});