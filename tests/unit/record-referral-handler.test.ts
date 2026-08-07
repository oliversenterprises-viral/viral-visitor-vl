import { describe, expect, it, vi } from 'vitest';
import {
  getClientIp,
  handleRecordReferral,
} from '../../supabase/functions/_shared/record-referral-handler';

function buildSupabaseMock(overrides: {
  rateCount?: number;
  dailyCount?: number;
  existing?: { id: string; created_at: string } | null;
  dedupeError?: unknown;
  inserted?: { id: string; created_at: string } | null;
  insertError?: { code?: string } | null;
} = {}) {
  const rateCount = overrides.rateCount ?? 0;
  const dailyCount = overrides.dailyCount ?? rateCount;
  const existing = overrides.existing ?? null;
  const dedupeError = overrides.dedupeError ?? null;
  const inserted = overrides.inserted ?? { id: 'ref-uuid-1', created_at: '2026-06-22T12:00:00Z' };
  const insertError = overrides.insertError ?? null;
  let headCountCalls = 0;

  return {
    from: (table: string) => {
      if (table !== 'referrals') throw new Error(`unexpected table ${table}`);
      return {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: () => ({
                gte: async () => {
                  headCountCalls += 1;
                  // 1st head = short rate window, 2nd = daily global cap
                  const count = headCountCalls === 1 ? rateCount : dailyCount;
                  return { count, error: null };
                },
              }),
            };
          }
          // Lifetime dedupe: .eq(referrer).eq(ip).order().limit().maybeSingle() — no gte
          return {
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: existing, error: dedupeError }),
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

  it('POST with failed Turnstile still records (non-blocking hardening)', async () => {
    const res = await handleRecordReferral(
      post({ referrerCode: 'VIRAL-OK', turnstileToken: 'bad' }),
      {
        verifyTurnstile: vi.fn().mockResolvedValue({ success: false, error: 'verification_failed' }),
        supabaseAdmin: buildSupabaseMock(),
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });

  it('POST skips smoke/owner/automation without inserting', async () => {
    const verifyTurnstile = vi.fn();
    const res = await handleRecordReferral(
      post(
        { referrerCode: 'VIRAL-SMOKETEST' },
        { 'cf-connecting-ip': '20.1.1.1', 'user-agent': 'node' },
      ),
      { verifyTurnstile, supabaseAdmin: buildSupabaseMock() },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, skipped: true });
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it('POST without turnstile token still inserts (server-protected path)', async () => {
    const verifyTurnstile = vi.fn();
    const res = await handleRecordReferral(
      post(
        { referrerCode: 'VIRAL-NOTURN' },
        { 'cf-connecting-ip': '182.62.227.19', 'user-agent': 'Mozilla/5.0 Chrome' },
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
        { 'cf-connecting-ip': '182.62.227.19', 'user-agent': 'Mozilla/5.0 Chrome' },
      ),
      { verifyTurnstile, supabaseAdmin: buildSupabaseMock() },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, referralId: 'ref-uuid-1' });
    expect(verifyTurnstile).toHaveBeenCalledWith('good-token', '182.62.227.19');
  });

  it('getClientIp prefers cf-connecting-ip', () => {
    const req = new Request('https://x/', {
      headers: { 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('POST returns duplicate for lifetime same IP + same referrer (no time window)', async () => {
    const res = await handleRecordReferral(
      post(
        { referrerCode: 'VIRAL-LIFE' },
        { 'cf-connecting-ip': '182.62.227.19', 'user-agent': 'Mozilla/5.0 Chrome' },
      ),
      {
        verifyTurnstile: vi.fn(),
        supabaseAdmin: buildSupabaseMock({
          existing: { id: 'old-ref-id', created_at: '2025-01-01T00:00:00Z' },
        }),
      },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      duplicate: true,
      lifetime_ip_dedupe: true,
      referralId: 'old-ref-id',
      message: 'Referral already recorded for this network',
    });
  });

  it('POST fails closed with 503 when lifetime dedupe query errors', async () => {
    const res = await handleRecordReferral(
      post(
        { referrerCode: 'VIRAL-LIFE' },
        { 'cf-connecting-ip': '182.62.227.20', 'user-agent': 'Mozilla/5.0 Chrome' },
      ),
      {
        verifyTurnstile: vi.fn(),
        supabaseAdmin: buildSupabaseMock({ dedupeError: { message: 'db down' } }),
      },
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ success: false });
  });
});