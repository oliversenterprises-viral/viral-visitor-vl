import { describe, it, expect, beforeEach } from 'vitest';
import {
  HERO_CTA_COPY,
  applyHeroCtaVariant,
  lock844HomepageCopy,
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

  it('lock844HomepageCopy restores the two-screen homepage after CMS overwrite', () => {
    document.getElementById('hero-title-line1')!.textContent = 'CMS headline';
    document.getElementById('hero-title-accent')!.textContent = 'CMS accent';
    document.getElementById('hero-subtitle')!.textContent = 'CMS sub';
    document.querySelector('#hero-get-link-btn span')!.textContent = 'CMS cta';
    document.body.insertAdjacentHTML(
      'beforeend',
      '<p id="hero-prize-one">CMS prize</p>',
    );
    document.getElementById('hero-badge')!.innerHTML =
      '<span data-i18n-text>WORLDWIDE • FREE • NO SIGNUP</span>';
    document.body.insertAdjacentHTML(
      'beforeend',
      '<p id="hero-daily-crown-line">Daily Crown race: VIRAL-BA0S5MF</p>',
    );
    lock844HomepageCopy();
    expect(document.getElementById('hero-badge')?.textContent).toBe(
      'THIS WEEK • FREE • NO SIGNUP',
    );
    expect(document.getElementById('hero-daily-crown-line')?.textContent).toBe('');
    expect(document.getElementById('hero-daily-crown-line')?.classList.contains('hidden')).toBe(
      true,
    );
    expect(document.getElementById('hero-title-line1')?.textContent).toBe('Win the homepage.');
    expect(document.getElementById('hero-title-accent')?.textContent).toBe(
      'Each step puts your site on this page. #1 owns the banner for 7 days.',
    );
    expect(document.getElementById('hero-subtitle')?.textContent).toBe(
      HERO_CTA_COPY.control.subtitle,
    );
    expect(document.querySelector('#hero-get-link-btn span')?.textContent).toBe(
      'Get my referral link',
    );
    expect(document.getElementById('hero-prize-one')?.textContent).toBe(
      'Paste your website in the slot. 1 friend → Rising drop. 2 → text line. #1 (not the owner) with 3+ friends → 7-day banner.',
    );
  });

  it('lock844HomepageCopy demotes Early Leaderboard to Recent Activity', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<h2 id="leaderboard-title">Early Leaderboard</h2>',
    );
    lock844HomepageCopy();
    expect(document.getElementById('leaderboard-title')?.textContent).toBe('Recent Activity');
  });

  it('skips on referred landings', () => {
    sessionStorage.setItem('vr_landing_ref', 'VIRAL-FRIEND');
    setOptimizerFlags({ hero_cta_variant: 'prize' });
    applyHeroCtaVariant();
    expect(document.getElementById('hero-title-line1')?.textContent).toBe('');
  });
});