import { describe, it, expect, beforeEach } from 'vitest';
import {
  HERO_CTA_COPY,
  applyHeroCtaVariant,
} from '../../src/lib/hero-cta-variant';
import { setOptimizerFlags } from '../../src/lib/optimizer-flags';

describe('hero-cta-variant', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.documentElement.removeAttribute('data-vr-referred-landing');
    setOptimizerFlags({});
    document.body.innerHTML = `
      <div id="hero-badge"></div>
      <div id="hero-title-line1"></div>
      <div id="hero-title-accent"></div>
      <div id="hero-subtitle"></div>
      <div id="hero-trust-line"></div>
      <button id="hero-get-link-btn"><span>Get my referral link</span></button>
    `;
  });

  it('prize variant overwrites hero copy on direct landings', () => {
    setOptimizerFlags({ hero_cta_variant: 'prize' });
    applyHeroCtaVariant();

    expect(document.getElementById('hero-title-line1')?.textContent).toBe(
      HERO_CTA_COPY.prize.titleLine1,
    );
    expect(document.getElementById('hero-title-accent')?.textContent).toBe(
      HERO_CTA_COPY.prize.titleAccent,
    );
    expect(document.querySelector('#hero-get-link-btn span')?.textContent).toBe(
      HERO_CTA_COPY.prize.buttonLabel,
    );
  });

  it('control variant leaves DOM unchanged', () => {
    const line1 = document.getElementById('hero-title-line1');
    line1!.textContent = 'CMS headline';
    setOptimizerFlags({ hero_cta_variant: 'control' });
    applyHeroCtaVariant();
    expect(line1?.textContent).toBe('CMS headline');
  });

  it('skips on referred landings', () => {
    sessionStorage.setItem('vr_landing_ref', 'VIRAL-FRIEND');
    setOptimizerFlags({ hero_cta_variant: 'prize' });
    applyHeroCtaVariant();
    expect(document.getElementById('hero-title-line1')?.textContent).toBe('');
  });
});