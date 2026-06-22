import { describe, it, expect } from 'vitest';
import {
  computeHighRiskIPs,
  filterReferralsByDays,
  filterReferralsBySearch,
  filterReferralsByRisk,
  computeTopReferrers,
  applyReferralFilters,
  getReferralIp,
} from '../../src/admin/referrals-tab';
import type { AdminReferralRow } from '../../src/admin/state';

const makeRow = (overrides: Partial<AdminReferralRow> = {}): AdminReferralRow => ({
  referrer_code: 'TEST',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('referrals helpers (pure)', () => {
  it('getReferralIp prefers referred_ip over legacy ip_address', () => {
    expect(getReferralIp(makeRow({ referred_ip: '203.0.113.77' }))).toBe('203.0.113.77');
    expect(
      getReferralIp(makeRow({ referred_ip: '203.0.113.77', ip_address: '1.2.3.4' })),
    ).toBe('203.0.113.77');
    expect(getReferralIp(makeRow({ ip_address: '1.2.3.4' }))).toBe('1.2.3.4');
    expect(getReferralIp(makeRow({}))).toBe('');
  });

  it('computeHighRiskIPs detects IPs with 3+ referrals', () => {
    const rows: AdminReferralRow[] = [
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '5.6.7.8' }),
    ];

    const risk = computeHighRiskIPs(rows);
    expect(risk.has('1.2.3.4')).toBe(true);
    expect(risk.has('5.6.7.8')).toBe(false);
  });

  it('computeHighRiskIPs uses production referred_ip column', () => {
    const rows: AdminReferralRow[] = [
      makeRow({ referred_ip: '203.0.113.1' }),
      makeRow({ referred_ip: '203.0.113.1' }),
      makeRow({ referred_ip: '203.0.113.1' }),
    ];
    expect(computeHighRiskIPs(rows).has('203.0.113.1')).toBe(true);
  });

  it('filterReferralsByDays returns all when days=0', () => {
    const rows = [makeRow(), makeRow()];
    const filtered = filterReferralsByDays(rows, 0);
    expect(filtered.length).toBe(2);
  });

  it('filterReferralsByDays correctly filters recent rows', () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const rows: AdminReferralRow[] = [
      makeRow({ created_at: now.toISOString() }),
      makeRow({ created_at: twoDaysAgo }),
      makeRow({ created_at: tenDaysAgo }),
    ];

    const last3Days = filterReferralsByDays(rows, 3);
    expect(last3Days.length).toBe(2);
  });

  it('computeHighRiskIPs returns empty set when no high-risk IPs', () => {
    const rows: AdminReferralRow[] = [
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '5.6.7.8' }),
    ];
    const risk = computeHighRiskIPs(rows);
    expect(risk.size).toBe(0);
  });

  it('filterReferralsByDays filters correctly for various day ranges', () => {
    const now = new Date();
    const rows: AdminReferralRow[] = [
      makeRow({ created_at: now.toISOString() }),
      makeRow({ created_at: new Date(now.getTime() - 5 * 86400000).toISOString() }),
    ];

    expect(filterReferralsByDays(rows, 1).length).toBe(1);
    expect(filterReferralsByDays(rows, 10).length).toBe(2);
  });

  it('filterReferralsBySearch matches code, IP, and user agent', () => {
    const rows: AdminReferralRow[] = [
      makeRow({ referrer_code: 'VIRAL-ABC', ip_address: '1.2.3.4', user_agent: 'Chrome/120' }),
      makeRow({ referrer_code: 'OTHER', ip_address: '9.9.9.9', user_agent: 'Safari' }),
    ];
    expect(filterReferralsBySearch(rows, 'viral').length).toBe(1);
    expect(filterReferralsBySearch(rows, '1.2.3').length).toBe(1);
    expect(filterReferralsBySearch(rows, 'safari').length).toBe(1);
    expect(filterReferralsBySearch(rows, '').length).toBe(2);
  });

  it('filterReferralsByRisk returns only high-risk rows', () => {
    const rows: AdminReferralRow[] = [
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '5.6.7.8' }),
    ];
    const riskIPs = computeHighRiskIPs(rows);
    const filtered = filterReferralsByRisk(rows, riskIPs, 'high-risk');
    expect(filtered.length).toBe(3);
    expect(filtered.every((r) => getReferralIp(r) === '1.2.3.4')).toBe(true);
  });

  it('computeTopReferrers ranks by count', () => {
    const rows: AdminReferralRow[] = [
      makeRow({ referrer_code: 'A' }),
      makeRow({ referrer_code: 'B' }),
      makeRow({ referrer_code: 'A' }),
      makeRow({ referrer_code: 'A' }),
    ];
    const top = computeTopReferrers(rows, 2);
    expect(top[0]).toEqual({ code: 'A', count: 3 });
    expect(top[1]).toEqual({ code: 'B', count: 1 });
  });

  it('applyReferralFilters composes day, search, and risk filters', () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 20 * 86400000).toISOString();
    const rows: AdminReferralRow[] = [
      makeRow({ referrer_code: 'VIRAL-1', ip_address: '1.1.1.1', created_at: now }),
      makeRow({ referrer_code: 'VIRAL-2', ip_address: '1.1.1.1', created_at: now }),
      makeRow({ referrer_code: 'VIRAL-3', ip_address: '1.1.1.1', created_at: now }),
      makeRow({ referrer_code: 'OLD', ip_address: '2.2.2.2', created_at: old }),
    ];
    const { filtered } = applyReferralFilters(rows, 7, 'viral', 'high-risk');
    expect(filtered.length).toBe(3);
  });
});
