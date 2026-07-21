import { describe, it, expect } from 'vitest';
import {
  formatReferrerBadge,
  formatReferrerCreditArrow,
  formatPublicReferralActivity,
  formatAdminLiveReferralDetail,
  formatAdminLiveShareDetail,
  formatVisitorViaReferrer,
  formatReferralCreditNotifierLine,
  REFERRAL_STAT_HINTS,
  REFERRER_COLUMN_TITLE,
} from '../../src/lib/referrer-display';

describe('referrer-display', () => {
  it('badge and credit arrow make referrer identity obvious', () => {
    expect(formatReferrerBadge('VIRAL-ABC')).toBe('Referrer VIRAL-ABC');
    expect(formatReferrerCreditArrow('VIRAL-ABC')).toBe('Credit → VIRAL-ABC');
    expect(formatReferrerBadge('')).toBe('Referrer unknown');
  });

  it('public referral activity says who got credit', () => {
    const a = formatPublicReferralActivity('VIRAL-X');
    expect(a.code).toBe('VIRAL-X');
    expect(a.action).toMatch(/got credit/i);
  });

  it('admin live details include referrer', () => {
    expect(formatAdminLiveReferralDetail('VIRAL-1')).toContain('VIRAL-1');
    expect(formatAdminLiveShareDetail('VIRAL-2', 'whatsapp')).toMatch(/Referrer VIRAL-2/);
  });

  it('visitor via referrer is plain English', () => {
    expect(formatVisitorViaReferrer('VIRAL-Z')).toBe('via VIRAL-Z');
    expect(formatVisitorViaReferrer('')).toMatch(/direct/i);
  });

  it('notifier line: who got credit ← visitor', () => {
    const line = formatReferralCreditNotifierLine({
      referrerCode: 'VIRAL-9',
      visitorIp: '203.0.113.1',
    });
    expect(line.summary).toContain('Referrer VIRAL-9');
    expect(line.summary).toContain('got credit');
    expect(line.summary).toContain('203.0.113.1');
  });

  it('stat hints and column titles stay glanceable', () => {
    expect(REFERRER_COLUMN_TITLE).toMatch(/credit/i);
    expect(REFERRAL_STAT_HINTS.total.length).toBeGreaterThan(10);
    expect(REFERRAL_STAT_HINTS.unique).toMatch(/credit|referrer/i);
  });
});
