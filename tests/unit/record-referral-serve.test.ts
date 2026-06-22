import { describe, expect, it, vi } from 'vitest';
import { createRecordReferralServeHandler } from '../../supabase/functions/_shared/record-referral-serve';

function buildSupabaseMock() {
  return {
    from: () => ({
      select: (_cols: string, opts?: { head?: boolean }) => {
        if (opts?.head) {
          return { eq: () => ({ gte: async () => ({ count: 0, error: null }) }) };
        }
        return {
          eq: () => ({
            eq: () => ({
              gte: () => ({
                order: () => ({
                  limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
                }),
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
    }),
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
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.1' },
        body: JSON.stringify({ referrerCode: 'VIRAL-SERVE', turnstileToken: 'tok' }),
      }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, referralId: 'serve-test-id' });
    expect(verifyTurnstile).toHaveBeenCalledWith('tok', '203.0.113.1');
  });
});