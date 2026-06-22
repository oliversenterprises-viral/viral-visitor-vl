import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

describe('record-referral/index.ts contract', () => {
  it('index.ts delegates to createRecordReferralIndexHandler + buildRecordReferralIndexDeps', () => {
    const src = readFileSync(
      resolve(root, 'supabase/functions/record-referral/index.ts'),
      'utf8',
    );
    expect(src).toMatch(/createRecordReferralIndexHandler/);
    expect(src).toMatch(/buildRecordReferralIndexDeps/);
    expect(src).toMatch(/Deno\.serve\s*\(/);
    expect(src).not.toMatch(/parseRecordReferralRequest/);
    expect(src).not.toMatch(/function verifyTurnstile/);
  });
});