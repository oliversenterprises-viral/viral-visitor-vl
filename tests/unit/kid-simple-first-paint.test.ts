import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('kid-simple first paint', () => {
  it('sets data-vr-kid-simple in <head> before the stylesheet', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    const attrAt = head.indexOf("setAttribute('data-vr-kid-simple'");
    const cssAt = head.indexOf('href="/src/style.css"');
    expect(attrAt).toBeGreaterThan(0);
    expect(cssAt).toBeGreaterThan(attrAt);
    expect(head).toContain('/embed');
  });

  it('hides #prize before a link without waiting for kid-simple JS', () => {
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #prize/);
  });
});
