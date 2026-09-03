import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMPTY_SLOT_NAME } from '../../src/lib/prize-slot';
import {
  LOCKED_BOARD_TITLE,
  LOCKED_DROP_BADGE,
  LOCKED_DROP_CHALLENGER_EMPTY,
  LOCKED_DROP_CHALLENGER_LABEL,
  LOCKED_DROP_ENTERED_EMPTY,
  LOCKED_DROP_ENTERED_LABEL,
  LOCKED_DROP_LEAD,
  LOCKED_DROP_RISING_EMPTY,
  LOCKED_DROP_RISING_LABEL,
  LOCKED_DROP_TITLE,
  LOCKED_LIVE_FUNNEL_BADGE,
  LOCKED_LIVE_HOW_BADGE,
  LOCKED_PRIZE_SLOT,
} from '../../src/lib/site-drops-copy';
import { en } from '../../src/lib/i18n/messages';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('site-drops first screen contract on this tree', () => {
  it('ships Just entered / Rising Site Drops / Challenger strip with zip empty copy', () => {
    const html = read('index.html');
    expect(html).toContain('id="site-entered-ticker"');
    expect(html).toContain('id="site-drops-entered-list"');
    expect(html).toContain('id="site-drops-rising-list"');
    expect(html).toContain('id="site-drops-challenger-list"');
    expect(html).toContain(LOCKED_DROP_BADGE);
    expect(html).toContain(LOCKED_DROP_TITLE);
    expect(html).toContain(LOCKED_DROP_LEAD);
    expect(html).toContain(LOCKED_DROP_ENTERED_LABEL);
    expect(html).toContain(LOCKED_DROP_RISING_LABEL);
    expect(html).toContain(LOCKED_DROP_CHALLENGER_LABEL);
    expect(html).toContain(LOCKED_DROP_ENTERED_EMPTY);
    expect(html).toContain(LOCKED_DROP_RISING_EMPTY);
    expect(html).toContain(LOCKED_DROP_CHALLENGER_EMPTY);
    expect(html).toContain(LOCKED_LIVE_FUNNEL_BADGE);
    expect(html).toContain(LOCKED_LIVE_HOW_BADGE);
    expect(html).toMatch(/id="site-entered-ticker"[^>]*hidden/);
    const board = html.slice(
      html.indexOf('id="leaderboard-title"'),
      html.indexOf('id="leaderboard-container"'),
    );
    expect(board).not.toContain('Early Leaderboard');
    expect(board).toContain('Recent Activity');
  });

  it('keeps prize Your site here and Recent Activity, not Early Leaderboard', () => {
    const html = read('index.html');
    const messages = read('src/lib/i18n/messages.ts');
    const prize = read('src/lib/prize-slot.ts');
    expect(html).toContain(EMPTY_SLOT_NAME);
    expect(html).toContain(LOCKED_PRIZE_SLOT);
    expect(html).toContain('id="recent-activity-title"');
    expect(html).toMatch(/id="leaderboard-title"[^>]*>\s*Recent Activity\s*<\/h2>/);
    expect(prize).toContain(`EMPTY_SLOT_NAME = 'Your site here'`);
    expect(messages).toContain(`'leaderboard.title': '${LOCKED_BOARD_TITLE}'`);
    expect(messages).not.toContain("'leaderboard.title': 'Early Leaderboard'");
    expect(messages).not.toContain("'leaderboard.title': 'Live Leaderboard'");
    expect(en['drop.badge']).toBe(LOCKED_DROP_BADGE);
    expect(en['drop.entered_label']).toBe(LOCKED_DROP_ENTERED_LABEL);
    expect(en['drop.rising_label']).toBe(LOCKED_DROP_RISING_LABEL);
    expect(en['drop.challenger_label']).toBe(LOCKED_DROP_CHALLENGER_LABEL);
    expect(en['funnel.badge']).toBe(LOCKED_LIVE_FUNNEL_BADGE);
    expect(en['how.badge']).toBe(LOCKED_LIVE_HOW_BADGE);
  });

  it('does not wait on site_content for first-screen chips', () => {
    const app = read('src/app.ts');
    const fetch = read('src/lib/site-drops-fetch.ts');
    const ui = read('src/lib/site-drops-ui.ts');
    const content = read('src/content.ts');
    expect(fetch).toContain('new AbortController()');
    expect(fetch).toContain('SITE_DROPS_FETCH_TIMEOUT_MS = FIRST_PAINT_FETCH_MS');
    expect(ui).toContain('loadSiteDropsLadder');
    expect(content).toContain('never wipe an independent ladder fetch');
    expect(app.indexOf('loadSiteDropsLadder')).toBeLessThan(
      app.indexOf('void withInitTimeout(loadSiteContent()'),
    );
    expect(app).toContain('hydratePublicFirstPaint');
  });
});
