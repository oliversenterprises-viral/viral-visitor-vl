import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('reddit pixel ship contract', () => {
  it('puts the official snippet and pixel id on the public homepage HTML', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('https://www.redditstatic.com/ads/pixel.js');
    expect(html).toContain("rdt('init','a2_ir6sjdbsj2n4')");
    expect(html).toContain("rdt('track','PageVisit')");
    expect(html).toMatch(/\/\^\\\/embed\\\/\?\$\/i/);
  });

  it('allows Reddit pixel hosts on public pages but not embed CSP', () => {
    const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
      headers?: { source: string; headers: { key: string; value: string }[] }[];
    };
    const publicCsp = vercel.headers
      ?.find((h) => h.source.includes('?!embed'))
      ?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
    const embedCsp = vercel.headers
      ?.find((h) => h.source === '/embed')
      ?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;

    expect(publicCsp).toContain('https://www.redditstatic.com');
    expect(publicCsp).toContain('https://alb.reddit.com');
    expect(embedCsp).not.toContain('redditstatic.com');
  });
});
