import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  sortClaimsByPriority,
  filterClaimsByStatus,
  countPendingClaims,
  displayClaimStatus,
  PRIZE_AUDIT_LEAD,
  PRIZE_AUDIT_TITLE,
  buildClaimsTableHTML,
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

  it('shows leftover paid rows as Legacy and never Mark Paid / cashtag / Owner Test Tools', () => {
    expect(displayClaimStatus('paid')).toBe('Legacy');
    expect(displayClaimStatus('pending')).toBe('pending');
    expect(PRIZE_AUDIT_TITLE).toBe('Prize audit');
    expect(PRIZE_AUDIT_LEAD).toMatch(/You do not approve/);
    const html = buildClaimsTableHTML(
      [makeClaim({ id: 'c1', website: 'https://example.com', message: 'site drop' })],
      1,
      'all',
    );
    expect(html).toContain('Prize audit');
    expect(html).toContain('You do not approve');
    expect(html).toContain('View details');
    expect(html).not.toContain('Mark Paid');
    expect(html).not.toContain('>Approve<');
    expect(html).not.toContain('Cashtag');
    expect(html).not.toContain('Owner Test Tools');

    const src = readFileSync(resolve(__dirname, '../../src/admin/prize-claims-tab.ts'), 'utf8');
    expect(src).not.toContain('Mark Paid');
    expect(src).not.toContain('Owner Test Tools');
    expect(src).not.toContain("data-status=\"paid\"");
    expect(src).not.toContain('cashtag');
    expect(src).not.toContain('reset_landing_visit_counters');
    expect(src).toContain('data-prize-retry');
  });
});