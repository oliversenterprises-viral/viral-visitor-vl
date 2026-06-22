import { describe, expect, it } from 'vitest';
import { getTurnstileSiteKey } from '../../src/lib/turnstile';

describe('turnstile', () => {
  it('getTurnstileSiteKey returns a string (empty when env unset)', () => {
    expect(typeof getTurnstileSiteKey()).toBe('string');
  });
});