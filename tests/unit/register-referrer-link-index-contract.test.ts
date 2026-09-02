import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('register-referrer-link index contract', () => {
  it('returns success:false on server catch (never silent fail-open)', () => {
    const src = readFileSync(
      resolve(ROOT, 'supabase/functions/register-referrer-link/index.ts'),
      'utf8',
    );
    expect(src).toContain("success: false");
    expect(src).toContain("error: 'Could not register your link'");
    expect(src).not.toMatch(/Fail open for client UX/);
  });
});
