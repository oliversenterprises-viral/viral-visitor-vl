import { describe, it, expect } from 'vitest';
import {
  sortClaimsByPriority,
  filterClaimsByStatus,
  countPendingClaims,
  prizeTabEmptyListHtml,
  prizeTabListErrorHtml,
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

  it('empty and error Prize lists still say the tab loaded — no cash', () => {
    const empty = prizeTabEmptyListHtml();
    expect(empty).toContain('data-hq-prize-empty="1"');
    expect(empty).toContain('Prize tab is loaded');
    expect(empty).toContain('no cash');
    expect(empty).toContain('data-hq-prize-retry="1"');
    const err = prizeTabListErrorHtml('Unknown action');
    expect(err).toContain('data-hq-prize-list="1"');
    expect(err).toContain('Prize tab is loaded');
    expect(err).toContain('Unknown action');
    expect(err).toContain('data-hq-prize-retry="1"');
  });
});