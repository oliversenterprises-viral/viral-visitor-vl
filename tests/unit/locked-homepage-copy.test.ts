import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Locked live Site Drops homepage copy (https://www.viralrefer.app).
 * Live HTML is the source of truth — not git 8a24705, which still has the old 30-day banner strings.
 */
export const LOCKED_LIVE_SITE_DROPS = {
  title: 'Win the ViralRefer homepage — Site Drops + #1 banner',
  h1: 'Win the homepage.',
  accent: 'Each step puts your site on this page. #1 owns the banner for 7 days.',
  sub: 'Get a link. Send it. When a friend taps Get my link, your site can go live here — Rising drop, text line, then the banner.',
  slot: 'Empty right now. #1 this week puts their site here.',
  slotMeta: 'Your site here · 7 days',
  rule: 'Paste your website in the slot. 1 friend → Rising drop. 2 → text line. #1 (not the owner) with 3+ friends → 7-day banner.',
  cta: 'Get my referral link',
  og: "I'm racing on ViralRefer — Site Drops put my site on the homepage as I climb. #1 gets the banner. Get a free link and try to beat me.",
} as const;

const OLD_BANNER_COPY = [
  'Win the ViralRefer homepage — #1 gets a banner',
  '#1 gets a banner for their site.',
  'Tap Get my link. Send it. When a friend taps Get my link, you climb.',
  'Example — this is what #1 gets',
  'Verified #1 gets a 30-day banner for their website.',
] as const;

function sliceHero(html: string): string {
  const start = html.indexOf('id="hero-title"');
  const end = html.indexOf('id="funnel-journey"');
  return html.slice(start, end);
}

describe('locked live Site Drops homepage copy', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const hero = sliceHero(html);
  const messages = readFileSync(resolve(ROOT, 'src/lib/i18n/messages.ts'), 'utf8');
  const prizeSlot = readFileSync(resolve(ROOT, 'src/lib/prize-slot.ts'), 'utf8');

  it('fails closed if any locked live string, UTM footer, or /guides/ is missing', () => {
    const required = [
      LOCKED_LIVE_SITE_DROPS.title,
      LOCKED_LIVE_SITE_DROPS.h1,
      LOCKED_LIVE_SITE_DROPS.accent,
      LOCKED_LIVE_SITE_DROPS.sub,
      LOCKED_LIVE_SITE_DROPS.slot,
      LOCKED_LIVE_SITE_DROPS.rule,
      LOCKED_LIVE_SITE_DROPS.cta,
    ];
    for (const locked of required) {
      expect(html, `missing locked live string: ${locked}`).toContain(locked);
    }
    expect(html).toContain(`<title>${LOCKED_LIVE_SITE_DROPS.title}</title>`);
    expect(hero).toContain(LOCKED_LIVE_SITE_DROPS.slotMeta);
    expect(html).toContain('Site Drop ladder:');
    expect(html).toContain('utm_source=homepage_footer');
    expect(html).toContain('href="/guides/"');
    expect(html).toContain(
      'href="/tools/credit-checker.html?utm_source=homepage_footer&amp;utm_medium=internal&amp;utm_campaign=organic_tools"',
    );
    expect(html).toContain(
      'href="/tools/what-to-paste.html?utm_source=homepage_footer&amp;utm_medium=internal&amp;utm_campaign=organic_tools"',
    );
    expect(existsSync(resolve(ROOT, 'public/guides/index.html'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'public/guides/site-drops/index.html'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'public/guides/claim-7-day-banner/index.html'))).toBe(true);
  });

  it('does not keep the old 30-day banner / example-ad strings', () => {
    for (const stale of OLD_BANNER_COPY) {
      expect(hero).not.toContain(stale);
      expect(html).not.toContain(`<title>${stale}</title>`);
    }
    expect(hero).not.toContain('Example ad');
    expect(hero).not.toContain('ViralRefer Tools');
    expect(hero).not.toContain('30-day banner');
  });

  it('keeps i18n + prize-slot defaults on the live strings', () => {
    expect(messages).toContain(`'${LOCKED_LIVE_SITE_DROPS.h1}'`);
    expect(messages).toContain(`'${LOCKED_LIVE_SITE_DROPS.accent}'`);
    expect(messages).toContain(LOCKED_LIVE_SITE_DROPS.sub);
    expect(messages).toContain(`'${LOCKED_LIVE_SITE_DROPS.cta}'`);
    expect(messages).toContain(LOCKED_LIVE_SITE_DROPS.rule);
    expect(prizeSlot).toContain(LOCKED_LIVE_SITE_DROPS.slot);
    expect(prizeSlot).toContain(LOCKED_LIVE_SITE_DROPS.slotMeta);
    expect(prizeSlot).toContain(LOCKED_LIVE_SITE_DROPS.rule);
    expect(prizeSlot).toContain(LOCKED_LIVE_SITE_DROPS.og);
  });

  it('keeps the live UTM footer and /guides/ hub', () => {
    expect(html).toContain('Site Drop ladder:');
    expect(html).toContain('href="/guides/"');
    expect(html).toContain('utm_source=homepage_footer');
    expect(html).toContain('href="/llms.txt"');
    expect(html).toContain('href="/go/affiliates/"');
    expect(existsSync(resolve(ROOT, 'public/guides/index.html'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'public/guides/site-drops/index.html'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'public/tools/credit-checker.html'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'public/tools/what-to-paste.html'))).toBe(true);
  });

  it('does not treat git 8a24705 HTML as the live copy source', () => {
    expect(LOCKED_LIVE_SITE_DROPS.title).toContain('Site Drops');
    expect(LOCKED_LIVE_SITE_DROPS.title).not.toBe('Win the ViralRefer homepage — #1 gets a banner');
  });
});
