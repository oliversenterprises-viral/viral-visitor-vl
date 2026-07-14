import { describe, it, expect, vi } from 'vitest';
import {
  SHARE_DEADLINE_MS,
  SHARE_GRACE_MS,
  MAX_GRACE_EXTENSIONS,
  deadlineIsoFromCreated,
  isPastShareDeadline,
  isPastDeadline,
  isVerifiedSharePlatform,
  normalizeSharePlatform,
  registerReferrerLink,
  resolveDeadlineAt,
  LOCK_PLATFORM_FIRST_REFERRAL,
} from '../../supabase/functions/_shared/referrer-share-deadline';
import { ADMIN_FUNNEL_EXCLUDED_IPS } from '../../supabase/functions/_shared/visitor-funnel-test';

describe('referrer-share-deadline (first-referral lock + grace)', () => {
  it('normalizes x → twitter', () => {
    expect(normalizeSharePlatform('x')).toBe('twitter');
    expect(normalizeSharePlatform('WhatsApp')).toBe('whatsapp');
  });

  it('verified platforms exclude clipboard; first_referral allowed', () => {
    expect(isVerifiedSharePlatform('whatsapp')).toBe(true);
    expect(isVerifiedSharePlatform('first_referral')).toBe(true);
    expect(isVerifiedSharePlatform(LOCK_PLATFORM_FIRST_REFERRAL)).toBe(true);
    expect(isVerifiedSharePlatform('copy')).toBe(false);
    expect(isVerifiedSharePlatform('discord')).toBe(false);
  });

  it('base window is 48h', () => {
    expect(SHARE_DEADLINE_MS).toBe(48 * 60 * 60 * 1000);
    const created = '2026-07-11T00:00:00.000Z';
    expect(deadlineIsoFromCreated(created)).toBe('2026-07-13T00:00:00.000Z');
    const t0 = Date.parse(created);
    expect(isPastShareDeadline(created, t0 + SHARE_DEADLINE_MS - 1)).toBe(false);
    expect(isPastShareDeadline(created, t0 + SHARE_DEADLINE_MS)).toBe(true);
  });

  it('resolveDeadlineAt uses deadline_at or created + grace', () => {
    expect(
      resolveDeadlineAt({
        created_at: '2026-07-11T00:00:00.000Z',
        deadline_at: '2026-07-14T12:00:00.000Z',
      }),
    ).toBe('2026-07-14T12:00:00.000Z');

    const withGrace = resolveDeadlineAt({
      created_at: '2026-07-11T00:00:00.000Z',
      share_grace_count: 1,
    });
    expect(withGrace).toBe(
      new Date(Date.parse('2026-07-11T00:00:00.000Z') + SHARE_DEADLINE_MS + SHARE_GRACE_MS).toISOString(),
    );
    expect(MAX_GRACE_EXTENSIONS).toBe(2);
  });

  it('isPastDeadline respects absolute deadline', () => {
    const d = '2026-07-12T00:00:00.000Z';
    expect(isPastDeadline(d, Date.parse(d) - 1)).toBe(false);
    expect(isPastDeadline(d, Date.parse(d))).toBe(true);
  });

  it('owner IP registers as exempt active with no deadline', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({ upsert })),
    };

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
