import { describe, expect, it, vi } from 'vitest';
import {
  buildRecordReferralIndexDeps,
  createRecordReferralIndexHandler,
  verifyTurnstileForRecordReferral,
} from '../../supabase/functions/_shared/record-referral-index';
import {
  isValidReferrerCode,
  normalizeReferrerCode,
  REFERRER_CODE_RE,
} from '../../supabase/functions/_shared/referrer-code';
import {
  isValidReferrerCode as clientIsValid,
  normalizeReferrerCode as clientNormalize,
  REFERRER_CODE_RE as clientRe,
} from '../../src/lib/referrer-code';

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
            data: { id: 'index-flow-id', created_at: '2026-06-22T12:00:00Z' },
            error: null,
          }),
        }),
      }),
    }),
  };
}

const mockEnv = {
  get: (key: string) => (key === 'TURNSTILE_SECRET_KEY' ? 'test-secret' : undefined),
};

describe('record-referral index wiring (index.ts → createRecordReferralIndexHandler)', () => {
  it('client re-export matches edge _shared referrer-code', () => {
    expect(clientRe).toBe(REFERRER_CODE_RE);
    expect(clientNormalize(' viral-x ')).toBe(normalizeReferrerCode(' viral-x '));
    expect(clientIsValid('VIRAL-97UWEGZ')).toBe(isValidReferrerCode('VIRAL-97UWEGZ'));
  });

  it('buildRecordReferralIndexDeps wires verifyTurnstile from env', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const deps = buildRecordReferralIndexDeps(mockEnv, buildSupabaseMock());
    const result = await deps.verifyTurnstile('tok-abc', '1.2.3.4');
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('createRecordReferralIndexHandler full POST success (same deps shape as index.ts)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ success: true }) }));
    const handler = createRecordReferralIndexHandler(
      buildRecordReferralIndexDeps(mockEnv, buildSupabaseMock()),
    );
    const res = await handler(
      new Request('https://edge.test/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.5' },
        body: JSON.stringify({ referrerCode: 'VIRAL-INDEX', turnstileToken: 'good' }),
      }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, referralId: 'index-flow-id' });
    vi.unstubAllGlobals();
  });

  it('verifyTurnstileForRecordReferral fails when secret missing', async () => {
    const result = await verifyTurnstileForRecordReferral('t', '1.1.1.1', { get: () => undefined });
    expect(result.success).toBe(false);
  });
});