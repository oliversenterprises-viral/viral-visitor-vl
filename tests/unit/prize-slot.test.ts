import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_MIN_REFERRALS_FOR_CLAIM,
  EMPTY_SLOT_META,
  LOCKED_OG_DESCRIPTION,
  LOCKED_SHARE_TEXT,
  PRIZE_FOMO_LINE,
  formatFaqPrizeAnswer,
  formatPrizeThresholdLine,
  parseMinReferralsForClaim,
  paintPrizeSlot,
  paintPrizeThreshold,
  resolvePrizeSlot,
  sharePayloadHasBannerRace,
  shouldShowWeeklySideWidgets,
} from '../../src/lib/prize-slot';
import { FIRST_SCREEN_SHARE_TEXT, buildShareMessage } from '../../src/lib/share-power';
import { POST_LINK_SHARE_TEXT } from '../../src/lib/post-link-share';
import { HOMEPAGE_FAQ, HOMEPAGE_SEO } from '../../src/lib/organic-seo';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LINK = 'https://www.viralrefer.app/r/VIRAL-TEST01';

describe('prize-slot (Helix Bet 2)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="hero-banner-mock">
        <a id="hero-slot-site" aria-disabled="true">Your site here</a>
        <div id="hero-slot-meta">${EMPTY_SLOT_META}</div>
      </div>
      <div id="prize-banner-visual">
        <img id="prize-slot-thumb" class="hidden" alt="" />
        <a id="prize-slot-site" aria-disabled="true">Your site here</a>
        <div id="prize-slot-meta">${EMPTY_SLOT_META}</div>
        <p id="prize-threshold">Verified #1 with at least <span id="min-referrals-value">10</span> friends who tapped Get my link can claim the banner.</p>
      </div>
    `;
  });

  it('defaults claim threshold to 10 and formats the named line', () => {
    expect(parseMinReferralsForClaim(undefined)).toBe(DEFAULT_MIN_REFERRALS_FOR_CLAIM);
    expect(parseMinReferralsForClaim('10')).toBe(10);
    expect(parseMinReferralsForClaim({ minReferrals: 12 })).toBe(12);
    expect(formatPrizeThresholdLine(10)).toBe(
      'Verified #1 with at least 10 friends who tapped Get my link can claim the banner.',
    );
    expect(formatFaqPrizeAnswer(10)).toContain('at least 10 friends');
    expect(formatFaqPrizeAnswer(10)).not.toMatch(/see threshold/i);
  });

  it('resolves empty slot vs featured winner', () => {
    expect(resolvePrizeSlot({}).kind).toBe('empty');
    expect(resolvePrizeSlot({}).meta).toBe(EMPTY_SLOT_META);

    const winner = resolvePrizeSlot({
      selected: {
        label: 'Acme Tools',
        redirectUrl: 'https://www.acme.example/go',
        imageUrl: 'https://cdn.example/acme.png',
      },
    });
    expect(winner.kind).toBe('winner');
    expect(winner.siteName).toBe('Acme Tools');
    expect(winner.meta).toBe('acme.example · 30 days');
    expect(winner.href).toContain('https://www.acme.example/go');
  });

  it('paints winner site + link, or Your site here · 30 days', () => {
    paintPrizeSlot(resolvePrizeSlot({}));
    expect(document.getElementById('hero-slot-meta')?.textContent).toBe(EMPTY_SLOT_META);
    expect(document.getElementById('hero-banner-mock')?.getAttribute('data-vr-prize-slot')).toBe(
      'empty',
    );
    expect(document.getElementById('hero-slot-site')?.getAttribute('aria-disabled')).toBe('true');

    paintPrizeSlot(
      resolvePrizeSlot({
        selected: {
          label: 'Northwind',
          redirectUrl: 'https://northwind.test',
          imageUrl: 'https://cdn.example/n.png',
        },
      }),
    );
    expect(document.getElementById('hero-slot-site')?.textContent).toBe('Northwind');
    expect(document.getElementById('hero-slot-meta')?.textContent).toBe('northwind.test · 30 days');
    expect((document.getElementById('hero-slot-site') as HTMLAnchorElement).href).toContain(
      'https://northwind.test',
    );
    expect(document.getElementById('prize-slot-thumb')?.classList.contains('hidden')).toBe(false);
  });

  it('paints the numeric threshold into the prize card', () => {
    paintPrizeThreshold(10);
    expect(document.getElementById('prize-threshold')?.textContent).toContain('at least 10 friends');
    expect(document.getElementById('min-referrals-value')?.textContent).toBe('10');
  });

  it('gates weekly sprint / unlock until 10 verified referrals in 7 days', () => {
    expect(shouldShowWeeklySideWidgets(0)).toBe(false);
    expect(shouldShowWeeklySideWidgets(9)).toBe(false);
    expect(shouldShowWeeklySideWidgets(10)).toBe(true);
  });

  it('rejects stale CMS share templates that are not the banner race', () => {
    const stale =
      'Worldwide free leaderboard — grab your link in ~30 sec. #1 can claim a homepage feature. {link}';
    expect(sharePayloadHasBannerRace(stale)).toBe(false);
    const msg = buildShareMessage(LINK, {
      platform: 'whatsapp',
      template: stale,
      trackUtm: false,
    });
    expect(msg).toBe(LOCKED_SHARE_TEXT.replace('{link}', LINK));
    const copy = buildShareMessage(LINK, {
      platform: 'copy',
      template: stale,
      trackUtm: false,
    });
    expect(copy).toContain('racing for the ViralRefer homepage');
    expect(copy).toMatch(/beat me/i);
  });

  it('locks share + OG + post-link to the banner race sentence', () => {
    expect(FIRST_SCREEN_SHARE_TEXT).toBe(LOCKED_SHARE_TEXT);
    expect(POST_LINK_SHARE_TEXT).toBe(LOCKED_SHARE_TEXT);
    expect(HOMEPAGE_SEO.description).toBe(LOCKED_OG_DESCRIPTION);
    expect(sharePayloadHasBannerRace(LOCKED_SHARE_TEXT)).toBe(true);

    for (const platform of ['native', 'whatsapp', 'sms', 'copy'] as const) {
      const msg = buildShareMessage(LINK, { platform, trackUtm: false });
      expect(sharePayloadHasBannerRace(msg)).toBe(true);
      expect(msg).toContain(LINK);
    }
  });

  it('first-paint HTML has named threshold, 30-day slot, no junk empty meters', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('Your site here · 30 days');
    expect(html).not.toContain('yourwebsite.com');
    expect(html).toContain('id="prize-threshold"');
    expect(html).toContain('id="min-referrals-value">10<');
    expect(html).toContain(PRIZE_FOMO_LINE);
    expect(html).toContain(LOCKED_OG_DESCRIPTION);
    expect(html).not.toContain('Together: 0 / 100');
    expect(html).not.toContain('0 / 100');
    expect(html).not.toMatch(/—\s*verified referrals/);
    expect(html).not.toContain('id="community-unlock-meter"');
    expect(html).not.toContain('id="weekly-sprint-board"');
    expect(html).not.toContain('id="daily-crown-section"');
    expect(html).not.toContain('id="daily-champion-strip"');
    expect(html).not.toContain('Hall of Crowns');
    expect(html).not.toMatch(/see threshold on site/i);
    expect(html).not.toMatch(/minimum referrals as shown/i);
    expect(HOMEPAGE_FAQ[2]?.answer).toContain('at least 10 friends');
  });
});
