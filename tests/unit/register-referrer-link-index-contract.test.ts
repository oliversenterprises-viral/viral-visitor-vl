import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

describe('register-referrer-link/index.ts contract', () => {
  it('does not fail-open with success:true on catch', () => {
    const src = readFileSync(resolve(root, 'supabase/functions/register-referrer-link/index.ts'), 'utf8');
    expect(src).toMatch(/success:\s*false/);
    expect(src).toMatch(/Could not register your link/);
    expect(src).not.toMatch(/Fail open for client UX/);
    const catchBlock = src.slice(src.lastIndexOf('} catch (err)'));
    expect(catchBlock).toMatch(/success:\s*false/);
    expect(catchBlock).not.toMatch(/success:\s*true/);
  });
});
