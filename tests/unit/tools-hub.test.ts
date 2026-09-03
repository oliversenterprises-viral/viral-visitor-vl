import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

/** 38 tool pages + tools/index.html — the Site Drops zip hub. */
const TOOL_PAGES = [
  '7-day-launch.html',
  'banner-eligibility.html',
  'claim-steps.html',
  'contest-vs-giveaway.html',
  'copy-vs-send.html',
  'credit-checker.html',
  'credit-quiz.html',
  'featured-vs-race.html',
  'friends-needed.html',
  'get-link-30s.html',
  'hit-vs-skill.html',
  'homepage-this-week.html',
  'hook-bank.html',
  'index.html',
  'just-entered.html',
  'listing-url.html',
  'loop-builder.html',
  'no-cash.html',
  'one-sentence.html',
  'promoter-credit.html',
  'r-code.html',
  'r-vs-a.html',
  'rank-vs-prize.html',
  'read-the-board.html',
  'self-tap.html',
  'send-seven.html',
  'share-auditor.html',
  'share-generator.html',
  'site-drop-ladder.html',
  'spam-vs-dm.html',
  'traffic-exchange-fail.html',
  'traffic-refer-kit.html',
  'utm-builder.html',
  'viral-calculator.html',
  'visits-widget.html',
  'vs-viral-loops.html',
  'week-clock.html',
  'what-to-paste.html',
  'who-can-enter.html',
] as const;

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('tools hub restore from Site Drops zip', () => {
  it('keeps all 39 tool HTML files including the hub, ladder, and credit checker', () => {
    const dir = resolve(root, 'public/tools');
    expect(existsSync(dir)).toBe(true);
    expect(statSync(dir).isDirectory()).toBe(true);

    const onDisk = readdirSync(dir).filter((name) => name.endsWith('.html')).sort();
    expect(onDisk).toEqual([...TOOL_PAGES].sort());
    expect(onDisk).toHaveLength(39);
    expect(onDisk).toContain('index.html');
    expect(onDisk).toContain('site-drop-ladder.html');
    expect(onDisk).toContain('credit-checker.html');

    for (const name of TOOL_PAGES) {
      const abs = resolve(dir, name);
      expect(existsSync(abs), `missing public/tools/${name}`).toBe(true);
      expect(statSync(abs).size).toBeGreaterThan(500);
      const html = read(`public/tools/${name}`);
      expect(html).toMatch(/<!DOCTYPE html>/i);
      expect(html).toMatch(/ViralRefer/i);
    }
  });

  it('hub matches live Site Drops zip: credit-checker and Site Drop ladder', () => {
    const hub = read('public/tools/index.html');
    expect(hub).toContain('Free Growth Tools');
    expect(hub).toContain('./credit-checker.html');
    expect(hub).toContain('./site-drop-ladder.html');
    expect(hub).toContain('Site Drop ladder');
    expect(hub).toContain('Site Drops');
    expect(hub).not.toContain('#1 gets a banner for their site');
  });

  it('does not edit homepage English; footer Tools links stay; GSC file stays', () => {
    const home = read('index.html');
    expect(home).toContain('Win the ViralRefer homepage — Site Drops + #1 banner');
    expect(home).toContain('Site Drop');
    expect(home).toContain('href="/tools/"');
    expect(home).toContain('/tools/credit-checker.html');
    expect(home).toContain('/tools/site-drop-ladder.html');
    expect(home).toContain('id="footer-link-tools"');

    const gsc = read('public/google163d31ba24216edd.html');
    expect(gsc).toContain('google-site-verification: google163d31ba24216edd.html');
  });
});
