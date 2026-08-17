import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('conversion pass contracts', () => {
  it('permanently redirects /relay to the traffic kit', () => {
    const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
      redirects?: { source: string; destination: string; permanent?: boolean }[];
    };
    const relay = (vercel.redirects || []).filter((r) => r.source.replace(/\/$/, '') === '/relay');
    expect(relay.length).toBeGreaterThan(0);
    for (const r of relay) {
      expect(r.destination).toContain('/tools/traffic-refer-kit.html');
      expect(r.permanent).toBe(true);
    }
  });
});
