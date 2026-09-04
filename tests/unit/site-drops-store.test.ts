import { describe, expect, it } from 'vitest';
import { applySiteDropClimb, SITE_DROPS_KEY } from '../../src/lib/site-drops';
import { advanceSiteDropOnVerifiedCredit } from '../../supabase/functions/_shared/site-drops-store';

describe('advanceSiteDropOnVerifiedCredit', () => {
  it('climbs a remembered site to Rising after a verified friend credit', async () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const seeded = applySiteDropClimb(
      { drops: [], pending_entered: [] },
      { code: 'VIRAL-STORE1', url: 'https://store.example', locks: 0 },
      now,
    );
    let saved: unknown = seeded;
    const supabaseAdmin = {
      from: (table: string) => {
        if (table === 'site_content') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { value: saved }, error: null }),
              }),
            }),
            upsert: async (row: { value?: unknown }) => {
              saved = row.value;
              return { error: null };
            },
          };
        }
        if (table === 'referrals') {
          return {
            select: () => ({
              eq: async () => ({ count: 1, error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      rpc: async () => ({ data: [{ referrer_code: 'VIRAL-STORE1', rank: 4, referral_count: 1 }] }),
    };
    const ok = await advanceSiteDropOnVerifiedCredit(supabaseAdmin, 'VIRAL-STORE1', now);
    expect(ok).toBe(true);
    const stored = saved as { drops: Array<{ kind: string; code: string }> };
    expect(stored.drops.some((d) => d.kind === 'rising' && d.code === 'VIRAL-STORE1')).toBe(true);
  });

  it('no-ops when the referrer never pasted a website', async () => {
    const supabaseAdmin = {
      from: (table: string) => {
        if (table === 'site_content') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { value: { drops: [], pending_entered: [], sites: [] } },
                  error: null,
                }),
              }),
            }),
            upsert: async () => {
              throw new Error('must not save');
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const ok = await advanceSiteDropOnVerifiedCredit(supabaseAdmin, 'VIRAL-NONE01');
    expect(ok).toBe(false);
  });

  it('never throws when site_content is missing (credit still succeeds)', async () => {
    const supabaseAdmin = {
      from: () => {
        throw new Error(`unexpected table ${SITE_DROPS_KEY}`);
      },
    };
    await expect(advanceSiteDropOnVerifiedCredit(supabaseAdmin, 'VIRAL-EDGE')).resolves.toBe(false);
  });
});
