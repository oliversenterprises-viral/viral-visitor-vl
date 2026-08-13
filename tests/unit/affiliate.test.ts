import { afterEach, describe, expect, it } from 'vitest';
import {
  addAffiliate,
  buildAffiliateLink,
  computeAffiliateStats,
  isValidAffiliateCode,
  markAffiliatePaid,
  normalizeAffiliateCode,
  parseAffiliateFromLocation,
  parseAffiliatesProgram,
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
});
