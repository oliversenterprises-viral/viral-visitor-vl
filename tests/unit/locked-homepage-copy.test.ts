import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Locked 8a24705 morning Site Drops homepage copy. Do not change. */
export const LOCKED_8A24705 = {
  title: 'Win the ViralRefer homepage — #1 gets a banner',
  h1: 'Win the homepage.',
  accent: '#1 gets a banner for their site.',
  sub: 'Tap Get my link. Send it. When a friend taps Get my link, you climb.',
  slot: 'Example — this is what #1 gets',
  slotNote: 'Example — this is what #1 gets. Slot still empty.',
  rule: 'Verified #1 gets a 30-day banner for their website.',
  cta: 'Get my referral link',
  lockRule: 'Your link counts when a friend taps Get my link.',
} as const;

function sliceHero(html: string): string {
  const start = html.indexOf('id="hero-title"');
  const end = html.indexOf('id="funnel-journey"');
  return html.slice(start, end);
}

describe('locked 8a24705 homepage copy', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const hero = sliceHero(html);
  const messages = readFileSync(resolve(ROOT, 'src/lib/i18n/messages.ts'), 'utf8');

  it('keeps title, H1, SUB, SLOT, RULE, CTA exactly', () => {
    expect(html).toContain(`<title>${LOCKED_8A24705.title}</title>`);
    expect(hero).toContain(LOCKED_8A24705.h1);
    expect(hero).toContain(LOCKED_8A24705.accent);
    expect(hero).toContain(LOCKED_8A24705.sub);
    expect(hero).toContain(LOCKED_8A24705.slot);
    expect(hero).toContain(LOCKED_8A24705.slotNote);
    expect(hero).toContain(LOCKED_8A24705.rule);
    expect(hero).toContain(LOCKED_8A24705.cta);
    expect(html).toContain(LOCKED_8A24705.lockRule);
  });

  it('keeps i18n hero keys on the locked strings', () => {
    expect(messages).toContain(`'${LOCKED_8A24705.h1}'`);
    expect(messages).toContain(`'${LOCKED_8A24705.accent}'`);
    expect(messages).toContain(LOCKED_8A24705.sub);
    expect(messages).toContain(`'${LOCKED_8A24705.cta}'`);
    expect(messages).toContain(LOCKED_8A24705.lockRule);
  });

  it('matches git 8a24705 hero strings when the commit is available', () => {
    let lockedHtml = '';
    try {
      lockedHtml = execSync('git show 8a24705:index.html', { cwd: ROOT, encoding: 'utf8' });
    } catch {
      return;
    }
    const lockedHero = sliceHero(lockedHtml);
    expect(hero).toContain(LOCKED_8A24705.h1);
    expect(lockedHero).toContain(LOCKED_8A24705.h1);
    expect(lockedHero).toContain(LOCKED_8A24705.sub);
    expect(lockedHero).toContain(LOCKED_8A24705.cta);
    expect(lockedHero).toContain(LOCKED_8A24705.slotNote);
    expect(lockedHero).toContain(LOCKED_8A24705.rule);
  });
});
