import { describe, expect, it, vi } from 'vitest';
import {
  getClientIp,
  handleRecordReferral,
} from '../../supabase/functions/_shared/record-referral-handler';

function buildSupabaseMock(overrides: {
  rateCount?: number;
  existing?: { id: string; created_at: string } | null;
  inserted?: { id: string; created_at: string } | null;
  insertError?: { code?: string } | null;
} = {}) {
  const rateCount = overrides.rateCount ?? 0;
  const existing = overrides.existing ?? null;
  const inserted = overrides.inserted ?? { id: 'ref-uuid-1', created_at: '2026-06-22T12:00:00Z' };
  const insertError = overrides.insertError ?? null;

  return {
    from: (table: string) => {
      if (table !== 'referrals') throw new Error(`unexpected table ${table}`);
      return {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: () => ({
                gte: async () => ({ count: rateCount, error: null }),
              }),
            };
          }
          return {
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: existing, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        },
        insert: () => ({
          select: () => ({
            single: async () => ({ data: inserted, error: insertError }),
          }),
        }),
      };
    },
  };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://edge.test/record-referral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('record-referral handler (edge index delegates here)', () => {
  it('OPTIONS returns CORS ok', async () => {
    const res = await handleRecordReferral(
      new Request('https://edge.test/', { method: 'OPTIONS' }),
      { verifyTurnstile: vi.fn(), supabaseAdmin: buildSupabaseMock() },
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('POST with invalid body returns 400 via shared parser', async () => {
    const res = await handleRecordReferral(post({ referrerCode: '!!' }), {
      verifyTurnstile: vi.fn(),
      supabaseAdmin: buildSupabaseMock(),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'Invalid request payload' });
  });

  it('POST self-referral returns 403', async () => {
    const res = await handleRecordReferral(
      post({ referrerCode: 'VIRAL-SAME', turnstileToken: 'tok', visitorCode: 'VIRAL-SAME' }),
      { verifyTurnstile: vi.fn(), supabaseAdmin: buildSupabaseMock() },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Self-referral is not allowed.' });
  });

  it('POST with failed Turnstile returns 403', async () => {
    const res = await handleRecordReferral(
      post({ referrerCode: 'VIRAL-OK', turnstileToken: 'bad' }),
      {
        verifyTurnstile: vi.fn().mockResolvedValue({ success: false, error: 'verification_failed' }),
        supabaseAdmin: buildSupabaseMock(),
      },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Bot verification failed' });
  });

  it('POST without turnstile token still inserts (server-protected path)', async () => {
    const verifyTurnstile = vi.fn();
    const res = await handleRecordReferral(
      post(
        { referrerCode: 'VIRAL-NOTURN' },
        { 'cf-connecting-ip': '203.0.113.11', 'user-agent': 'vitest' },
      ),
      { verifyTurnstile, supabaseAdmin: buildSupabaseMock() },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, referralId: 'ref-uuid-1' });
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it('POST success inserts referral (full handler path)', async () => {
    const verifyTurnstile = vi.fn().mockResolvedValue({ success: true });
    const res = await handleRecordReferral(
      post(
        { referrerCode: 'VIRAL-EDGE', turnstileToken: 'good-token' },
        { 'cf-connecting-ip': '203.0.113.10', 'user-agent': 'vitest' },
      ),
      { verifyTurnstile, supabaseAdmin: buildSupabaseMock() },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, referralId: 'ref-uuid-1' });
    expect(verifyTurnstile).toHaveBeenCalledWith('good-token', '203.0.113.10');
  });

  it('getClientIp prefers cf-connecting-ip', () => {
    const req = new Request('https://x/', {
      headers: { 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });
});