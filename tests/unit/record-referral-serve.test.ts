import { describe, expect, it, vi } from 'vitest';
import { createRecordReferralServeHandler } from '../../supabase/functions/_shared/record-referral-serve';

function buildSupabaseMock() {
  const linkChain = () => {
    const chain: Record<string, unknown> = {};
    chain.eq = () => chain;
    chain.not = () => chain;
    chain.lt = () => chain;
    chain.is = () => chain;
    chain.select = async () => ({ data: [], error: null });
    chain.maybeSingle = async () => ({
      data: { status: 'active', created_at: '2026-01-01T00:00:00Z', deadline_at: null },
      error: null,
    });
    return chain;
  };
  return {
    from: (table?: string) => {
      if (table === 'referrer_links') {
        return { update: () => linkChain(), select: () => linkChain() };
      }
      return {
      select: (_cols: string, opts?: { head?: boolean }) => {
        if (opts?.head) {
          return { eq: () => ({ gte: async () => ({ count: 0, error: null }) }) };
        }
        return {
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
              }),
            }),
          }),
        };
      },
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: { id: 'serve-test-id', created_at: '2026-06-22T12:00:00Z' },
            error: null,
          }),
        }),
      }),
    };
    },
  };
}

describe('createRecordReferralServeHandler (index.ts wiring contract)', () => {
  it('OPTIONS via factory matches edge index behavior', async () => {
    const handler = createRecordReferralServeHandler({
      verifyTurnstile: vi.fn(),
      supabaseAdmin: buildSupabaseMock(),
    });
    const res = await handler(new Request('https://edge.test/', { method: 'OPTIONS' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('POST success via factory (same deps shape as index.ts)', async () => {
    const verifyTurnstile = vi.fn().mockResolvedValue({ success: true });
    const handler = createRecordReferralServeHandler({
      verifyTurnstile,
      supabaseAdmin: buildSupabaseMock(),
    });
    const res = await handler(
      new Request('https://edge.test/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '182.62.227.19', 'user-agent': 'Mozilla/5.0 Chrome' },
        body: JSON.stringify({ referrerCode: 'VIRAL-SERVE', turnstileToken: 'tok' }),
      }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, referralId: 'serve-test-id' });
    expect(verifyTurnstile).toHaveBeenCalledWith('tok', '182.62.227.19');
  });
});