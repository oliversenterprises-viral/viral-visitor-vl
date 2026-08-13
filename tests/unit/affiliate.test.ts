import { afterEach, describe, expect, it } from 'vitest';
import {
  addAffiliate,
  buildAffiliateLink,
  computeAffiliateRewards,
  computeAffiliateStats,
  isValidAffiliateCode,
  markAffiliatePaid,
  mintAffiliateCode,
  normalizeAffiliateCode,
  parseAffiliateFromLocation,
  parseAffiliatesProgram,
  pickWeeklyTopFromLedger,
  pickWeeklyTopPromoter,
} from '../../src/lib/affiliate';

describe('affiliate attribution', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('normalizes codes and rejects junk / test patterns', () => {
    expect(normalizeAffiliateCode('aff-joe')).toBe('JOE');
    expect(isValidAffiliateCode('joe')).toBe(true);
    expect(isValidAffiliateCode('j')).toBe(false);
    expect(isValidAffiliateCode('SMOKETEST')).toBe(false);
    expect(isValidAffiliateCode('')).toBe(false);
  });

  it('parses ?aff= and /a/CODE', () => {
    const q = { search: '?aff=maya', pathname: '/' } as Location;
    expect(parseAffiliateFromLocation(q)).toBe('MAYA');
    const p = { search: '', pathname: '/a/maya' } as Location;
    expect(parseAffiliateFromLocation(p)).toBe('MAYA');
  });

  it('builds a short promoter link that is not a /r/ friend link', () => {
    expect(buildAffiliateLink('maya')).toBe('https://www.viralrefer.app/a/MAYA');
    expect(buildAffiliateLink('maya')).not.toContain('/r/');
  });

  it('counts Get my link as the unpaid conversion', () => {
    const events = [
      { event_name: 'SiteLanding', visitor_id: 'v1', metadata: { aff_code: 'MAYA' } },
      { event_name: 'GetReferralLink', visitor_id: 'v1', metadata: { aff_code: 'MAYA' } },
      { event_name: 'GetReferralLink', visitor_id: 'v1', metadata: { aff_code: 'MAYA' } },
      { event_name: 'GetReferralLink', visitor_id: 'v2', metadata: { aff_code: 'OTHER' } },
    ];
    const stats = computeAffiliateStats(events, 'MAYA', 0);
    expect(stats.landings).toBe(1);
    expect(stats.getLinks).toBe(2);
    expect(stats.uniqueGetLinkVisitors).toBe(1);
    expect(stats.unpaid).toBe(1);
    expect(computeAffiliateStats(events, 'MAYA', 1).unpaid).toBe(0);
  });

  it('parses a JSON string roster', () => {
    const parsed = parseAffiliatesProgram(
      JSON.stringify({
        bounty_label: '$2',
        affiliates: [{ code: 'MAYA', name: 'Maya', paid_count: 1, active: true }],
      }),
    );
    expect(parsed.bounty_label).toBe('$2');
    expect(parsed.affiliates[0]?.code).toBe('MAYA');
  });

  it('adds a promoter and marks paid', () => {
    const started = parseAffiliatesProgram({});
    const added = addAffiliate(started, { name: 'Maya' });
    expect(added.error).toBeUndefined();
    expect(added.row?.code).toBe('MAYA');
    const paid = markAffiliatePaid(added.program, 'MAYA', 3);
    expect(paid.affiliates[0]?.paid_count).toBe(3);
  });

  it('mints a new code when the name is already taken', () => {
    const first = addAffiliate(parseAffiliatesProgram({}), { name: 'Maya', source: 'self' });
    const second = addAffiliate(first.program, { name: 'Maya', source: 'self' });
    expect(second.error).toBeUndefined();
    expect(second.row?.code).not.toBe('MAYA');
    expect(second.row?.code.startsWith('MAYA')).toBe(true);
  });

  it('treats ad credit as the default reward and cash after a threshold', () => {
    const program = parseAffiliatesProgram({ cash_threshold: 10 });
    const stats = { landings: 12, getLinks: 12, uniqueGetLinkVisitors: 12, unpaid: 12 };
    const due = computeAffiliateRewards(stats, program, { paid_count: 0, ad_credit_granted: 2 });
    expect(due.adCreditOwed).toBe(10);
    expect(due.cashDue).toBe(true);
    expect(due.cashUnpaid).toBe(12);
    const early = computeAffiliateRewards(
      { landings: 3, getLinks: 3, uniqueGetLinkVisitors: 3, unpaid: 3 },
      program,
      { paid_count: 0, ad_credit_granted: 0 },
    );
    expect(early.cashDue).toBe(false);
    expect(early.adCreditOwed).toBe(3);
  });

  it('picks this week’s top promoter from Get my link counts', () => {
    const now = Date.parse('2026-08-13T12:00:00Z');
    const program = addAffiliate(parseAffiliatesProgram({}), { name: 'Maya' }).program;
    const withSam = addAffiliate(program, { name: 'Sam' }).program;
    const events = [
      {
        event_name: 'GetReferralLink',
        visitor_id: 'a',
        metadata: { aff_code: 'MAYA' },
        created_at: '2026-08-12T10:00:00Z',
      },
      {
        event_name: 'GetReferralLink',
        visitor_id: 'b',
        metadata: { aff_code: 'MAYA' },
        created_at: '2026-08-12T11:00:00Z',
      },
      {
        event_name: 'GetReferralLink',
        visitor_id: 'c',
        metadata: { aff_code: 'SAM' },
        created_at: '2026-08-12T11:00:00Z',
      },
      {
        event_name: 'GetReferralLink',
        visitor_id: 'old',
        metadata: { aff_code: 'SAM' },
        created_at: '2026-07-01T11:00:00Z',
      },
    ];
    const top = pickWeeklyTopPromoter(events, withSam, now);
    expect(top?.code).toBe('MAYA');
    expect(top?.uniqueGetLinkVisitors).toBe(2);
  });

  it('picks weekly top from the credit ledger without scanning all visits', () => {
    const program = addAffiliate(parseAffiliatesProgram({}), { name: 'Maya' }).program;
    const withSam = addAffiliate(program, { name: 'Sam' }).program;
    const top = pickWeeklyTopFromLedger(
      [
        { affiliate_code: 'MAYA' },
        { affiliate_code: 'MAYA' },
        { affiliate_code: 'SAM' },
      ],
      withSam,
    );
    expect(top?.code).toBe('MAYA');
    expect(top?.uniqueGetLinkVisitors).toBe(2);
  });

  it('mintAffiliateCode skips taken slugs', () => {
    const code = mintAffiliateCode('Maya', new Set(['MAYA']));
    expect(code).not.toBe('MAYA');
    expect(isValidAffiliateCode(code)).toBe(true);
  });
});
