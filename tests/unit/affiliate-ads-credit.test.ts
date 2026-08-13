import { describe, expect, it } from 'vitest';
import { creditIdempotencyKey } from '../../supabase/functions/_shared/affiliate-ads-credit';

describe('affiliate ad-credit settle', () => {
  it('uses one key per promoter + visitor so the same friend is not paid twice', () => {
    expect(creditIdempotencyKey('maya', 'vis-1')).toBe('getlink:MAYA:vis-1');
    expect(creditIdempotencyKey('AFF-maya', 'vis-1')).toBe('getlink:MAYA:vis-1');
  });
});
