import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

describe('turnstile import contract (anti-drift)', () => {
  it('referral.ts imports shared turnstile module', () => {
    const src = readFileSync(resolve(root, 'src/referral.ts'), 'utf8');
    expect(src).toMatch(/from\s+['"]\.\/lib\/turnstile['"]/);
    expect(src).not.toMatch(/function ensureTurnstileReady/);
  });

  it('handlers.ts imports shared turnstile module', () => {
    const src = readFileSync(resolve(root, 'src/public/handlers.ts'), 'utf8');
    expect(src).toMatch(/from\s+['"]\.\.\/lib\/turnstile['"]/);
    expect(src).not.toMatch(/function ensureTurnstileReady/);
  });
});