import { describe, expect, it } from 'vitest';
import {
  BLOCKED_ACTIVITY_IPS,
  isBlockedActivityIp,
  normalizeClientIp,
} from '../../supabase/functions/_shared/blocked-ips';
import { handleRecordReferral } from '../../supabase/functions/_shared/record-referral-handler';

describe('blocked-ips', () => {
  it('includes the high-risk IP 77.49.85.59', () => {
    expect(BLOCKED_ACTIVITY_IPS).toContain('77.49.85.59');
  });

  it('isBlockedActivityIp matches exact blocked IP', () => {
    expect(isBlockedActivityIp('77.49.85.59')).toBe(true);
    expect(isBlockedActivityIp(' 77.49.85.59 ')).toBe(true);
  });

  it('isBlockedActivityIp does not match unrelated IPs', () => {
    expect(isBlockedActivityIp('8.8.8.8')).toBe(false);
    expect(isBlockedActivityIp('77.49.85.60')).toBe(false);
    expect(isBlockedActivityIp('unknown')).toBe(false);
    expect(isBlockedActivityIp('')).toBe(false);
    expect(isBlockedActivityIp(null)).toBe(false);
  });

  it('normalizeClientIp trims and lowercases', () => {
    expect(normalizeClientIp('  1.2.3.4  ')).toBe('1.2.3.4');
  });
});

describe('record-referral blocks high-risk IP', () => {
  it('returns 403 for blocked IP before any DB work', async () => {
    const from = () => {
      throw new Error('DB must not be called for blocked IP');
    };
    const res = await handleRecordReferral(
      new Request('https://edge.test/record-referral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '77.49.85.59',
        },
        body: JSON.stringify({ referrerCode: 'VIRAL-ABCDEF' }),
      }),
      {
        verifyTurnstile: async () => ({ success: true }),
        supabaseAdmin: { from },
      },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ success: false, error: 'Access denied.' });
  });

  it('does not 403 a normal IP at the block gate', async () => {
    const res = await handleRecordReferral(
      new Request('https://edge.test/record-referral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '8.8.8.8',
        },
        body: JSON.stringify({ referrerCode: '!!invalid!!' }),
      }),
      {
        verifyTurnstile: async () => ({ success: true }),
        supabaseAdmin: {
          from: () => {
            throw new Error('should fail parse first');
          },
        },
      },
    );
    // Invalid code fails parse (400), not block (403)
    expect(res.status).toBe(400);
  });
});
