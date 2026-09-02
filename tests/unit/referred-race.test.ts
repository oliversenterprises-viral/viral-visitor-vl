import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAME_RACE_CTA,
  SAME_RACE_SUB,
  SEND_NOW_LABEL,
  formatSameRaceTitle,
  paintReferredRaceHero,
} from '../../src/lib/referred-race';
import { applyReferredLandingOverrides } from '../../src/lib/funnel-conversion';
import { LOCKED_SHARE_TEXT } from '../../src/lib/prize-slot';
import { POST_LINK_SHARE_TEXT, maybeOfferSameGestureShare } from '../../src/lib/post-link-share';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('referred-race (Helix Bet 3)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="hero-title-line1"></span>
      <span id="hero-title-accent">Each step puts your site on this page. #1 owns the banner for 7 days.</span>
      <p id="hero-subtitle"></p>
      <button id="hero-get-link-btn"><span>Get my referral link</span></button>
      <button id="nav-get-link-btn">Get link</button>
      <div id="hero-badge"></div>
      <p id="hero-trust-line">Not a bank</p>
      <p id="hero-lock-rule">48h lawyer</p>
      <p id="referrer-invite-headline"></p>
      <p id="referrer-invite-hint" class="hidden"></p>
      <span id="referrer-code-inline"></span>
      <button id="attribution-get-link-btn"><span>Step 1</span></button>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('formats the same-race title with the code', () => {
    expect(formatSameRaceTitle('viral-abc1')).toBe("You're in the same race as VIRAL-ABC1.");
    expect(formatSameRaceTitle('')).toBe("You're in the same race.");
  });

  it('paints first viewport copy and Get my link', () => {
    paintReferredRaceHero('VIRAL-FRIEND');
    expect(document.getElementById('hero-title-line1')?.textContent).toBe(
      "You're in the same race as VIRAL-FRIEND.",
    );
    expect(document.getElementById('hero-subtitle')?.textContent).toBe(SAME_RACE_SUB);
    expect(document.querySelector('#hero-get-link-btn span')?.textContent).toBe(SAME_RACE_CTA);
    expect(document.getElementById('hero-title-accent')?.textContent).toBe('');
    expect(document.getElementById('hero-trust-line')?.textContent).toBe('');
    expect(SAME_RACE_SUB).toMatch(/Get my link/);
    expect(SAME_RACE_SUB).toMatch(/beat them/);
  });

  it('applyReferredLandingOverrides uses Bet 3 copy', () => {
    vi.stubGlobal('location', { pathname: '/r/VIRAL-GATE01', search: '', hash: '' });
    applyReferredLandingOverrides();
    expect(document.getElementById('hero-title-line1')?.textContent).toContain(
      'same race as VIRAL-GATE01',
    );
    expect(document.getElementById('hero-subtitle')?.textContent).toBe(SAME_RACE_SUB);
  });

  it('post-link share stays on the Bet 2 sentence; same-gesture no-ops without Web Share', () => {
    expect(POST_LINK_SHARE_TEXT).toBe(LOCKED_SHARE_TEXT);
    expect(SEND_NOW_LABEL).toBe('Send to a friend now');
    expect(maybeOfferSameGestureShare('https://www.viralrefer.app/r/VIRAL-TEST01')).toBe(false);
  });

  it('head script sets referred flags before CSS; CSS hides kitchen sink', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    const referredAt = head.indexOf("setAttribute('data-vr-referred-micro'");
    const cssAt = head.indexOf('href="/src/style.css"');
    expect(referredAt).toBeGreaterThan(0);
    expect(cssAt).toBeGreaterThan(referredAt);
    expect(head).toContain('data-vr-referred-micro');
    expect(head).toContain('ref=');
    expect(html).toContain("You're in the same race as ");
    expect(html).not.toContain('id="become-promoter"');

    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(css).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) #how/,
    );
    expect(css).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) #faq/,
    );
    expect(css).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) #prize/,
    );
    expect(css).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) #hero-banner-mock/,
    );
    expect(css).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) #hero-security-trust/,
    );
  });
});
