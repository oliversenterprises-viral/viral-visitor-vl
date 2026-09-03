import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('nav Tools (promote gate)', () => {
  it('homepage nav has Tools → /tools/ on this tree', () => {
    const html = read('index.html');
    const nav = html.slice(html.indexOf('id="vr-nav"'), html.indexOf('</nav>'));
    expect(nav).toMatch(/<a href="\/tools\/"[^>]*>\s*Tools\s*<\/a>/);
    expect(nav).toContain('vr-nav-tools');
    expect(nav).toContain('text-zinc-400');
    expect(nav).toContain('hover:text-violet-400');
    expect(nav).not.toMatch(/text-blue-/);
    expect(nav).not.toContain('data-i18n="nav.tools"');
  });

  it('cold-land CSS does not hide Tools', () => {
    const css = read('src/style.css');
    expect(css).toMatch(
      /html\[data-vr-direct-landing\]:not\(\[data-vr-has-link\]\) \.vr-nav-link:not\(\.vr-nav-tools\)/,
    );
    expect(css).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) \.vr-nav-link:not\(\.vr-nav-tools\)/,
    );
    expect(css).not.toMatch(
      /html\[data-vr-direct-landing\]:not\(\[data-vr-has-link\]\) \.vr-nav-link \{/,
    );
  });

  it('prize empty slot stays Your site here', () => {
    const html = read('index.html');
    const prize = read('src/lib/prize-slot.ts');
    expect(html).toContain('Your site here');
    expect(html).toContain('Your site here · 30 days');
    expect(prize).toContain("EMPTY_SLOT_NAME = 'Your site here'");
    expect(prize).toContain("EMPTY_SLOT_META = 'Your site here · 30 days'");
  });
});
