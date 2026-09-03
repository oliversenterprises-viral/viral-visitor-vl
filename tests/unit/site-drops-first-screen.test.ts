import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMPTY_SLOT_NAME } from '../../src/lib/prize-slot';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('site-drops first screen contract on this tree', () => {
  it('ships Just entered / Rising / Challenger chips with honest empty copy', () => {
    const html = read('index.html');
    expect(html).toContain('id="site-entered-ticker"');
    expect(html).toContain('id="site-drops-entered-list"');
    expect(html).toContain('id="site-drops-rising-list"');
    expect(html).toContain('id="site-drops-challenger-list"');
    expect(html).toContain('Just entered · 15 min');
    expect(html).toContain('Rising · 1 hour');
    expect(html).toContain('Challenger · #2 / #3');
    expect(html).toContain('No one just entered');
    expect(html).toContain('Rising slots are open');
    expect(html).toContain('No challengers yet');
    expect(html).toMatch(/id="site-entered-ticker"[^>]*hidden/);
  });

  it('keeps prize Your site here and does not rename Recent Activity or extra locales', () => {
    const html = read('index.html');
    const messages = read('src/lib/i18n/messages.ts');
    const prize = read('src/lib/prize-slot.ts');
    expect(html).toContain(EMPTY_SLOT_NAME);
    expect(html).toContain('id="recent-activity-title"');
    expect(html).toContain('>Recent Activity<');
    expect(prize).toContain(`EMPTY_SLOT_NAME = 'Your site here'`);
    expect(messages).toContain("'leaderboard.title': 'Live Leaderboard'");
    expect(messages).not.toMatch(/drop\.entered_empty/);
    expect(messages).not.toMatch(/'leaderboard.title': 'Recent Activity'/);
  });

  it('does not wait on site_content for first-screen chips', () => {
    const app = read('src/app.ts');
    const fetch = read('src/lib/site-drops-fetch.ts');
    expect(fetch).toContain('new AbortController()');
    expect(fetch).toContain('SITE_DROPS_FETCH_TIMEOUT_MS = 2_000');
    expect(app.indexOf('loadSiteDropsLadder')).toBeLessThan(
      app.indexOf('await withInitTimeout(loadSiteContent()'),
    );
  });
});
