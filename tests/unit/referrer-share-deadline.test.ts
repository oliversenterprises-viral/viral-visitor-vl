import { describe, it, expect, vi } from 'vitest';
import {
  SHARE_DEADLINE_MS,
  deadlineIsoFromCreated,
  isPastShareDeadline,
  isVerifiedSharePlatform,
  normalizeSharePlatform,
  registerReferrerLink,
} from '../../supabase/functions/_shared/referrer-share-deadline';
import { ADMIN_FUNNEL_EXCLUDED_IPS } from '../../supabase/functions/_shared/visitor-funnel-test';

describe('referrer-share-deadline (edge shared)', () => {
  it('normalizes x → twitter', () => {
    expect(normalizeSharePlatform('x')).toBe('twitter');
    expect(normalizeSharePlatform('WhatsApp')).toBe('whatsapp');
  });

  it('verified platforms exclude clipboard', () => {
    expect(isVerifiedSharePlatform('whatsapp')).toBe(true);
    expect(isVerifiedSharePlatform('twitter')).toBe(true);
    expect(isVerifiedSharePlatform('sms')).toBe(true);
    expect(isVerifiedSharePlatform('copy')).toBe(false);
    expect(isVerifiedSharePlatform('copy-message')).toBe(false);
  });

  it('deadline helpers use 24h window', () => {
    const created = '2026-07-11T00:00:00.000Z';
    expect(deadlineIsoFromCreated(created)).toBe('2026-07-12T00:00:00.000Z');
    const t0 = Date.parse(created);
    expect(isPastShareDeadline(created, t0 + SHARE_DEADLINE_MS - 1)).toBe(false);
    expect(isPastShareDeadline(created, t0 + SHARE_DEADLINE_MS)).toBe(true);
  });

  it('owner IP registers as exempt active with no deadline', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({
        upsert,
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn(),
        update: vi.fn(),
        insert: vi.fn(),
      })),
    };
    // Minimal mock: upsert is chained from from()
    supabase.from = vi.fn(() => ({ upsert }));

    const ownerIp = ADMIN_FUNNEL_EXCLUDED_IPS[0];
    const result = await registerReferrerLink(supabase as never, 'VIRAL-OWNER1', {
      clientIp: ownerIp,
    });
    expect(result.ok).toBe(true);
    expect(result.exempt).toBe(true);
    expect(result.status).toBe('active');
    expect(result.deadline_at).toBeUndefined();
    expect(upsert).toHaveBeenCalled();
    const row = upsert.mock.calls[0][0];
    expect(row.status).toBe('active');
    expect(row.first_share_platform).toBe('owner_ip_exempt');
  });
});
