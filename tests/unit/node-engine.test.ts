import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('Node engine pin', () => {
  it('requires Node 22 in package.json (Vite 8 + smoke WebSocket)', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    expect(String(pkg.engines?.node ?? '')).toMatch(/22/);
  });

  it('pins 22 in .nvmrc for Vercel and local shells', () => {
    const nvmrc = readFileSync(resolve(ROOT, '.nvmrc'), 'utf8').trim();
    expect(nvmrc).toBe('22');
  });
});
