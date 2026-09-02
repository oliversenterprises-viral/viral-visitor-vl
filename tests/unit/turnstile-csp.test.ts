import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('Turnstile CSP allows challenge-platform subdomains', () => {
  it('public and embed CSP allow brunhild.challenges.cloudflare.com', () => {
    const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
      headers?: { source: string; headers: { key: string; value: string }[] }[];
    };
    const policies = (vercel.headers || [])
      .map((block) => block.headers.find((h) => h.key === 'Content-Security-Policy')?.value || '')
      .filter((csp) => csp.includes('challenges.cloudflare.com'));

    expect(policies.length).toBeGreaterThanOrEqual(2);
    for (const csp of policies) {
      expect(csp).toContain('https://challenges.cloudflare.com');
      expect(csp).toContain('https://*.challenges.cloudflare.com');
      expect(csp).toMatch(/script-src[^;]*https:\/\/\*\.challenges\.cloudflare\.com/);
      expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.challenges\.cloudflare\.com/);
      expect(csp).toMatch(/frame-src[^;]*https:\/\/\*\.challenges\.cloudflare\.com/);
      expect(csp).toMatch(/worker-src[^;]*blob:/);
    }
  });
});
