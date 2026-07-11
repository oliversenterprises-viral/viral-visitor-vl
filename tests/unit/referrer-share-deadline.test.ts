import { describe, it, expect } from 'vitest';
import {
  SHARE_DEADLINE_MS,
  deadlineIsoFromCreated,
  isPastShareDeadline,
  isVerifiedSharePlatform,
  normalizeSharePlatform,
} from '../../supabase/functions/_shared/referrer-share-deadline';

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
});
