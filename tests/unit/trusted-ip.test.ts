import { describe, expect, it } from 'vitest';
import { getTrustedClientIp } from '../../supabase/functions/_shared/trusted-ip.ts';

function req(headers: Record<string, string>): Request {
  return new Request('https://example.test', { headers });
}

describe('getTrustedClientIp', () => {
  it('prefers cf-connecting-ip', () => {
    expect(
      getTrustedClientIp(
        req({
          'cf-connecting-ip': '203.0.113.9',
          'x-forwarded-for': '1.1.1.1, 9.9.9.9',
        }),
      ),
    ).toBe('203.0.113.9');
  });

  it('uses the rightmost X-Forwarded-For hop', () => {
    expect(getTrustedClientIp(req({ 'x-forwarded-for': '1.1.1.1, 8.8.8.8' }))).toBe('8.8.8.8');
  });

  it('returns unknown when no headers', () => {
    expect(getTrustedClientIp(req({}))).toBe('unknown');
  });
});
