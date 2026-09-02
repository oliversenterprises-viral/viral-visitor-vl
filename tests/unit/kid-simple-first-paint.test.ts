import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('kid-simple first paint', () => {
  it('sets data-vr-kid-simple in <head> before the stylesheet', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    const attrAt = head.indexOf("setAttribute('data-vr-kid-simple'");
    const cssAt = head.indexOf('href="/src/style.css"');
    expect(attrAt).toBeGreaterThan(0);
    expect(cssAt).toBeGreaterThan(attrAt);
    expect(head).toContain('/embed');
    expect(head).toContain("setAttribute('data-vr-referred-micro'");
    expect(head).toContain("setAttribute('data-vr-referred-landing'");
  });

  it('hides #prize before a link without waiting for kid-simple JS', () => {
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #prize/);
  });

  it('first screen is one race with Get my referral link', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero).toMatch(/Win the homepage/);
    expect(hero).toContain('Each step puts your site on this page. #1 owns the banner for 7 days.');
    expect(hero).toContain(
      'Get a link. Send it. When a friend taps Get my link, your site can go live here — Rising drop, text line, then the banner.',
    );
    expect(hero).toContain('id="hero-get-link-btn"');
    expect(hero).toContain('Get my referral link');
    expect(hero).not.toContain('Get my free link');
    expect(hero).toContain(
      'Paste your website in the slot. 1 friend → Rising drop. 2 → text line. #1 (not the owner) with 3+ friends → 7-day banner.',
    );
    expect(hero).toContain('id="hero-banner-mock"');
    expect(hero).toContain('Empty right now. #1 this week puts their site here.');
    expect(hero).toContain('Your site here · 7 days');
    expect(hero).toContain('data-vr-prize-slot="empty"');
    expect(hero).not.toContain('ViralRefer Tools');
    expect(hero).not.toContain('Example — this is what #1 gets');
    expect(hero).not.toContain('Example ad');
    expect(hero).not.toContain('Free growth tools');
    expect(hero).not.toContain('Share generator');
    expect(hero).not.toMatch(/CURRENT #1/);
    expect(hero).not.toContain('yourwebsite.com');
    expect(hero).toContain('Early ranks are open. #1 puts their website on this page.');
    expect(hero).not.toContain('See leaderboard');
    expect(hero).not.toContain('id="hero-leaderboard-btn"');
    expect(hero).not.toContain('Telegram');
    expect(hero).not.toContain('id="hero-telegram-helper-btn"');
    expect(hero).not.toContain('id="hero-leaderboard-link"');
    expect(hero).not.toContain('id="promoter-week-strip"');
    expect(hero).not.toContain('id="hero-promoter-cta"');
    expect(hero).not.toContain('We want promoters');
    expect(hero).not.toContain('We want affiliates');
  });

  it('keeps promoter chrome off the homepage', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).not.toContain('id="become-promoter"');
    expect(html).not.toContain('Get my promoter link');
    expect(html).not.toContain('Become a promoter');
    expect(html).not.toContain('href="#become-promoter"');
    expect(html).not.toContain('Can I promote ViralRefer');
  });

  it('hides promoter chrome and unhydrated dash-proof on first viewport', () => {
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #promoter-week-strip/);
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #vr-verified-total/);
    expect(css).toMatch(/#vr-verified-total:not\(\.vr-verified-total--ready\)/);
  });

  it('hides FAQ and extras on a cold land until expand; How and Board stay in the page', () => {
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(css).toMatch(/html:not\(\[data-vr-funnel-expanded\]\) \[data-vr-below-fold\]:not\(#how\):not\(#leaderboard\)/);
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\):not\(\[data-vr-referred-micro\]\) #funnel-expand-wrap/);
    expect(css).toMatch(/html:not\(\[data-vr-share-locked\]\) #daily-crown-section/);
    expect(css).toMatch(/html:not\(\[data-vr-embed\]\) #how/);
    expect(css).toMatch(/html:not\(\[data-vr-embed\]\) #leaderboard/);
    expect(html).not.toContain('id="daily-crown-section"');
    expect(html).not.toContain('id="weekly-sprint-board"');
    expect(html).not.toContain('id="community-unlock-meter"');
    expect(html).not.toContain('id="daily-champion-strip"');
  });

  it('keeps cash-bonus and owner password chrome out of first-paint HTML', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).not.toContain('Cash bonus is tracked');
    expect(html).not.toContain('Can I get paid');
    expect(html).not.toContain('Type the owner password');
    expect(html).not.toContain('admin-owner-gate-modal');
    expect(html).not.toMatch(/>ADMIN</);
    expect(html).not.toContain('ad-board');
    expect(html).not.toContain('48h');
  });

  it('does not paint em-dash referral proof before hydration', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const hero = html.slice(html.indexOf('id="vr-verified-total"'), html.indexOf('id="funnel-journey"'));
    expect(hero).not.toMatch(/—\s*verified referrals/);
    expect(hero).not.toContain('— people got a link today');
    expect(hero).toContain('id="total-referrers"');
    expect(hero).toContain('id="hero-got-link-today"');
  });
});
