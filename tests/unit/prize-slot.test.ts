import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_MIN_REFERRALS_FOR_CLAIM,
  EMPTY_AD_NOTE,
  EMPTY_SLOT_META,
  EMPTY_SLOT_NAME,
  EMPTY_SLOT_THUMB_SRC,
  LOCKED_OG_DESCRIPTION,
  LOCKED_SHARE_TEXT,
  ONE_PRIZE_SENTENCE,
  PRIZE_FOMO_LINE,
  formatFaqPrizeAnswer,
  formatPrizeThresholdLine,
  parseMinReferralsForClaim,
  formatUnlockRaceLine,
  formatVisitInventoryLine,
  formatWeekRaceClock,
  getUtcWeekEndMs,
  paintPrizeSlot,
  paintPrizePullProof,
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
        <span id="hero-ad-kicker-kind">Live ad</span>
        <div id="hero-ad-mark">#1</div>
        <img id="hero-slot-thumb" class="hidden" alt="" />
        <a id="hero-slot-preview" class="hero-ad-site-preview"></a>
        <a id="hero-slot-site" aria-disabled="true">Your site here</a>
        <div id="hero-slot-meta">${EMPTY_SLOT_META}</div>
        <p id="hero-ad-note"></p>
        <p id="hero-ad-inventory" hidden></p>
        <p id="hero-ad-race" hidden></p>
        <a id="hero-ad-visit" class="hidden" hidden></a>
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
    expect(formatFaqPrizeAnswer(10)).toContain('10 friends');
    expect(formatFaqPrizeAnswer(10)).not.toMatch(/see threshold/i);
  });

  it('resolves empty 7-day slot when no claimed banner, winner when there is one', () => {
    const empty = resolvePrizeSlot({});
    expect(empty.kind).toBe('empty');
    expect(empty.siteName).toBe(EMPTY_SLOT_NAME);
    expect(empty.meta).toBe(EMPTY_SLOT_META);
    expect(empty.href).toBeNull();
    expect(empty.meta.toLowerCase()).not.toContain('current #1');

    const promo = resolvePrizeSlot({
      banners: [
        {
          label: 'Winner Spotlight',
          imageUrl: 'https://www.viralrefer.app/assets/banners/winner-spotlight.svg',
          redirectUrl: 'https://viralrefer.app/?ref=VIRAL-97UWEGZ',
          enabled: true,
        },
        {
          imageUrl: 'https://example.com/x.jpg',
          redirectUrl: 'https://x.com/viralrefer',
          enabled: true,
        },
      ],
    });
    expect(promo.kind).toBe('empty');
    expect(promo.href).toBeNull();

    const winner = resolvePrizeSlot({
      selected: {
        label: 'Acme Tools',
        redirectUrl: 'https://www.acme.example/go',
        imageUrl: 'https://cdn.example/acme.png',
      },
    });
    expect(winner.kind).toBe('winner');
    expect(winner.siteName).toBe('Acme Tools');
    expect(winner.meta).toBe('acme.example · 7 days');
    expect(winner.href).toContain('https://www.acme.example/go');
  });

  it('paints the empty 7-day slot, or a claimed winner site', () => {
    paintPrizeSlot(resolvePrizeSlot({}));
    expect(document.getElementById('hero-slot-meta')?.textContent).toBe(EMPTY_SLOT_META);
    expect(document.getElementById('hero-banner-mock')?.getAttribute('data-vr-prize-slot')).toBe(
      'empty',
    );
    expect(document.getElementById('hero-ad-mark')?.textContent).toBe('#');
    expect(document.getElementById('hero-ad-kicker-kind')?.textContent).toBe('This homepage');
    expect(document.getElementById('hero-ad-note')?.textContent).toBe(EMPTY_AD_NOTE);
    expect((document.getElementById('hero-slot-site') as HTMLAnchorElement).hasAttribute('href')).toBe(
      false,
    );
    expect(document.getElementById('hero-slot-preview')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('hero-slot-thumb')?.classList.contains('hidden')).toBe(true);
    expect((document.getElementById('hero-slot-thumb') as HTMLImageElement).src).toBe(
      EMPTY_SLOT_THUMB_SRC,
    );
    expect(document.getElementById('hero-ad-visit')?.classList.contains('hidden')).toBe(true);

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
    expect(document.getElementById('hero-slot-meta')?.textContent).toBe('northwind.test · 7 days');
    expect((document.getElementById('hero-slot-site') as HTMLAnchorElement).href).toContain(
      'https://northwind.test',
    );
    expect(document.getElementById('prize-slot-thumb')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('hero-slot-thumb')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('hero-slot-preview')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('hero-ad-visit')?.classList.contains('hidden')).toBe(false);
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
    expect(copy).toContain('racing for the homepage this week');
    expect(copy).toContain('Tap Get my link');
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

  it('first-paint HTML has named threshold, 7-day empty slot, no junk empty meters', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('Your site here · 7 days');
    expect(html).not.toContain('yourwebsite.com');
    expect(html).toContain('id="prize-threshold"');
    expect(html).toContain('id="min-referrals-value">3<');
    expect(html).toContain(PRIZE_FOMO_LINE);
    expect(html).toContain(ONE_PRIZE_SENTENCE);
    expect(html).toContain(EMPTY_AD_NOTE);
    expect(html).toContain('This homepage');
    expect(html).toContain('id="hero-slot-preview"');
    expect(html).not.toContain('viralrefer.app/tools');
    expect(html).not.toContain('Free growth tools');
    expect(html).not.toContain('Share generator');
    expect(html).toContain('id="hero-race-countdown"');
    expect(html).not.toMatch(/CURRENT #1 CAN CLAIM THIS/);
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
    expect(HOMEPAGE_FAQ[2]?.answer).toContain('3 friends');
  });

  it('formats inventory and unlock lines without naming a fake winner', () => {
    expect(formatVisitInventoryLine(0)).toBe('');
    expect(formatVisitInventoryLine(2041)).toBe('Seen 2,041 times this week on this page.');
    expect(formatUnlockRaceLine(7, 10, 'example')).toBe(
      'Board leader has 7 of 10 friends. Slot still empty.',
    );
    expect(formatUnlockRaceLine(10, 10, 'example')).toContain('until they claim');
    expect(formatUnlockRaceLine(7, 10, 'winner')).toBe('');
    paintPrizePullProof({ visits7d: 2041, leaderReferrals: 7, minForClaim: 10, kind: 'empty' });
    expect(document.getElementById('hero-ad-inventory')?.textContent).toContain('2,041');
    expect(document.getElementById('hero-ad-race')?.hidden).toBe(true);
    expect(document.getElementById('hero-ad-race')?.textContent).toBe('');
  });

  it('week race clock is live, not a frozen 3d 18h 50m string', () => {
    const frozen = "This week's race ends in 3d 18h 50m. Send now.";
    const a = formatWeekRaceClock(Date.UTC(2026, 7, 20, 16, 0, 0));
    const b = formatWeekRaceClock(Date.UTC(2026, 7, 21, 16, 0, 0));
    expect(a).toMatch(/^This week's race ends in \d+d \d+h \d+m\. Send now\.$/);
    expect(b).toMatch(/^This week's race ends in \d+d \d+h \d+m\. Send now\.$/);
    expect(a).not.toBe(b);
    expect(a).not.toBe(frozen);
    expect(getUtcWeekEndMs(Date.UTC(2026, 7, 20, 16, 0, 0))).toBe(Date.UTC(2026, 7, 24, 0, 0, 0, 0));
  });
});
