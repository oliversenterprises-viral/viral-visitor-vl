import { describe, it, expect } from 'vitest';
import {
  sortClaimsByPriority,
  filterClaimsByStatus,
  countPendingClaims,
} from '../../src/admin/prize-claims-tab';
import type { AdminClaimRow } from '../../src/admin/state';

const makeClaim = (overrides: Partial<AdminClaimRow> = {}): AdminClaimRow => ({
  id: '1',
  created_at: new Date().toISOString(),
  referrer_code: 'TEST',
  status: 'pending',
  ...overrides,
});

describe('prize claims helpers (pure)', () => {
  it('sortClaimsByPriority puts pending first', () => {
    const claims = [
      makeClaim({ id: 'a', status: 'paid', created_at: '2026-06-20T00:00:00Z' }),
      makeClaim({ id: 'b', status: 'pending', created_at: '2026-06-19T00:00:00Z' }),
      makeClaim({ id: 'c', status: 'approved', created_at: '2026-06-21T00:00:00Z' }),
    ];
    const sorted = sortClaimsByPriority(claims);
    expect(sorted.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('filterClaimsByStatus filters by status', () => {
    const claims = [
      makeClaim({ status: 'pending' }),
      makeClaim({ status: 'paid' }),
      makeClaim({ status: 'pending' }),
    ];
    expect(filterClaimsByStatus(claims, 'pending').length).toBe(2);
    expect(filterClaimsByStatus(claims, 'all').length).toBe(3);
  });

  it('countPendingClaims counts only pending rows', () => {
    const claims = [
      makeClaim({ status: 'pending' }),
      makeClaim({ status: 'paid' }),
      makeClaim({ status: undefined }),
    ];
    expect(countPendingClaims(claims)).toBe(2);
  });
});