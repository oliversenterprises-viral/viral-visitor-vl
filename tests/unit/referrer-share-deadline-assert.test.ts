import { describe, expect, it } from 'vitest';
import { assertReferrerLinkAllowsReferrals } from '../../supabase/functions/_shared/referrer-share-deadline';

function linksClient(row: Record<string, unknown> | null, error: { message: string } | null = null) {
  const chain: Record<string, unknown> = {};
  chain.eq = () => chain;
  chain.not = () => chain;
  chain.lt = () => chain;
  chain.is = () => chain;
  chain.select = async () => ({ data: [], error: null });
  chain.maybeSingle = async () => ({ data: row, error });
  return {
    from: () => ({
      update: () => chain,
      select: () => chain,
    }),
  };
}

describe('assertReferrerLinkAllowsReferrals', () => {
  it('grandfathers missing rows', async () => {
    const gate = await assertReferrerLinkAllowsReferrals(linksClient(null) as never, 'VIRAL-NEW');
    expect(gate).toMatchObject({ allowed: true, status: 'grandfathered' });
  });

  it('blocks expired codes', async () => {
    const gate = await assertReferrerLinkAllowsReferrals(
      linksClient({ status: 'expired', created_at: '2020-01-01T00:00:00Z', deadline_at: '2020-01-02T00:00:00Z' }) as never,
      'VIRAL-OLD',
    );
    expect(gate.allowed).toBe(false);
    expect(gate.status).toBe('expired');
  });

  it('fails closed when select errors', async () => {
    const gate = await assertReferrerLinkAllowsReferrals(
      linksClient(null, { message: 'db down' }) as never,
      'VIRAL-X',
    );
    expect(gate.allowed).toBe(false);
    expect(gate.status).toBe('unknown');
  });
});
