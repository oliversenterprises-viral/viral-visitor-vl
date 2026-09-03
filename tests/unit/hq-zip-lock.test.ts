import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('HQ Command stays inside the zip Site Drops app', () => {
  it('keeps HQ Command + owner funnel desk in the live site shell', () => {
    const html = read('index.html');
    expect(html).toContain('id="admin-modal"');
    expect(html).toContain('hq-command');
    expect(html).toContain('HQ Command');
    expect(html).toContain('data-owner-funnel-desk="1"');
    expect(html).toContain('hq-desk-tile--visits');
    expect(html).toContain('Clear junk visits');
    expect(html).not.toContain('Daily Champion');
    expect(html).not.toContain('Daily Crown');
  });

  it('keeps owner funnel desk as the HQ paint path and leaves GSC file alone', () => {
    const desk = read('src/admin/owner-funnel-desk.ts');
    expect(desk).toContain('export async function renderOwnerFunnelDesk');
    expect(desk).toContain('renderOwnerFunnelDeskView');
    expect(desk).not.toContain('Daily Champion');
    expect(desk).not.toContain('Daily Crown');
    expect(desk).not.toContain('google163d31ba24216edd');

    expect(read('public/google163d31ba24216edd.html')).toContain(
      'google-site-verification: google163d31ba24216edd.html',
    );
  });
});
