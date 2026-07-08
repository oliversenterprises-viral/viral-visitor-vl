import { describe, it, expect } from 'vitest';
import { computePersonalKScore } from '../../src/lib/growth-k-score';

describe('growth-k-score', () => {
  it('pending when no shares', () => {
    const r = computePersonalKScore(3, 0);
    expect(r.display).toBe('—');
    expect(r.k).toBe(0);
  });

  it('computes K from referrals per share', () => {
    const r = computePersonalKScore(4, 8);
    expect(r.k).toBe(0.5);
    expect(r.display).toBe('0.50');
  });

  it('elite label at K >= 1', () => {
    const r = computePersonalKScore(5, 4);
    expect(r.k).toBeGreaterThanOrEqual(1);
    expect(r.tip).toMatch(/elite/i);
  });
});