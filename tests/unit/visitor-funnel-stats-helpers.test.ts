import { describe, it, expect } from 'vitest';
import {
  countryLabel,
  filterCountryRowsForDisplay,
  sortSourceEntries,
  shouldShowUtmSources,
  computeFunnelTotals,
  topCountries,
  formatVisitorIpLabel,
  formatRecentVisitorEventDetail,
  filterExcludedVisitorFunnelEvents,
  getVisitorEventIp,
  isExcludedVisitorFunnelEvent,
  isTestVisitorFunnelRefCode,
  getReferralNotifierIp,
  isRecentReferralNotifier,
  countRecentReferralNotifiers,
  type FunnelRow,
  type CountryRow,
} from '../../src/admin/visitor-funnel-stats-helpers';

const funnelRow = (name: string, count: number, unique = count): FunnelRow => ({
  name,
  count,
  unique,
});

const countryRow = (country: string, unique: number, events = unique): CountryRow => ({
  country,
  unique,
  events,
});

describe('visitor funnel stats helpers (pure)', () => {
  it('countryLabel maps known codes and handles unknown', () => {
    expect(countryLabel('US')).toBe('United States');
    expect(countryLabel('—')).toBe('Unknown');
    expect(countryLabel('')).toBe('Unknown');
  });

  it('filterCountryRowsForDisplay removes placeholder dash rows', () => {
    const rows = [countryRow('US', 5), countryRow('—', 2), countryRow('GB', 1)];
    expect(filterCountryRowsForDisplay(rows).map((r) => r.country)).toEqual(['US', 'GB']);
  });

  it('sortSourceEntries orders by count descending', () => {
    const sorted = sortSourceEntries({ twitter: 3, direct: 10, email: 7 });
    expect(sorted.map(([k]) => k)).toEqual(['direct', 'email', 'twitter']);
  });

  it('shouldShowUtmSources hides single direct-only source', () => {
    expect(shouldShowUtmSources({ '(direct)': 5 })).toBe(false);
    expect(shouldShowUtmSources({ '(direct)': 5, reddit: 2 })).toBe(true);
    expect(shouldShowUtmSources({ reddit: 1 })).toBe(true);
  });

  it('computeFunnelTotals uses unique visitors for conversion', () => {
    const funnel = [
      funnelRow('SiteLanding', 100, 50),
      funnelRow('SubmitPrizeClaim', 25, 10),
      funnelRow('Other', 10, 8),
    ];
    const totals = computeFunnelTotals(funnel);
    expect(totals.totalEvents).toBe(135);
    expect(totals.landings).toBe(50);
    expect(totals.claims).toBe(10);
    expect(totals.conversion).toBe('20.0%');
  });

  it('topCountries returns at most limit rows', () => {
    const rows = Array.from({ length: 12 }, (_, i) => countryRow(`C${i}`, i + 1));
    expect(topCountries(rows, 5)).toHaveLength(5);
    expect(topCountries(rows, 5)[0].country).toBe('C0');
  });

  it('filters excluded owner IP from funnel event lists', () => {
    const blocked = {
      event_name: 'SiteLanding',
      metadata: { client_ip: '161.38.136.60' },
      created_at: '2026-06-25T12:00:00Z',
    };
    const real = {
      event_name: 'SiteLanding',
      metadata: { client_ip: '8.8.8.8' },
      created_at: '2026-06-25T12:01:00Z',
    };
    expect(isExcludedVisitorFunnelEvent(blocked)).toBe(true);
    expect(isExcludedVisitorFunnelEvent(real)).toBe(false);
    expect(getVisitorEventIp(blocked)).toBe('161.38.136.60');
    expect(filterExcludedVisitorFunnelEvents([blocked, real]).length).toBe(1);
    expect(
      isExcludedVisitorFunnelEvent({ event_name: 'SiteLanding', ip_hash: 'd8399295624890754c844c12' }),
    ).toBe(true);
    expect(
      isExcludedVisitorFunnelEvent({
        event_name: 'SiteLanding',
        metadata: { client_ip: '57.138.135.240' },
      }),
    ).toBe(true);
    expect(
      isExcludedVisitorFunnelEvent({ event_name: 'SiteLanding', ip_hash: '717ece42045d3673ed7fb81c' }),
    ).toBe(true);
  });

  it('filters smoke automation bursts and E2E ref codes', () => {
    const smokeBurst = [
      {
        event_name: 'SiteLanding',
        metadata: { client_ip: '20.161.69.68' },
      },
      {
        event_name: 'GetReferralLink',
        metadata: { client_ip: '20.161.69.68' },
      },
      {
        event_name: 'OpenPrizeClaim',
        metadata: { client_ip: '20.161.69.68' },
      },
    ];
    expect(filterExcludedVisitorFunnelEvents(smokeBurst)).toHaveLength(0);

    const e2e = {
      event_name: 'SiteLanding',
      ref_code: 'VIRAL-DEMOCODE',
      metadata: { client_ip: '8.8.4.4' },
    };
    expect(filterExcludedVisitorFunnelEvents([e2e])).toHaveLength(0);
  });

  it('isTestVisitorFunnelRefCode matches smoke/E2E patterns only', () => {
    expect(isTestVisitorFunnelRefCode('VIRAL-DEMOCODE')).toBe(true);
    expect(isTestVisitorFunnelRefCode('DEMO1234')).toBe(true);
    expect(isTestVisitorFunnelRefCode('VIRAL-97UWEGZ')).toBe(false);
  });

  it('formatVisitorIpLabel prefers metadata client_ip then ip_hash prefix', () => {
    expect(
      formatVisitorIpLabel({ metadata: { client_ip: '203.0.113.10' } }),
    ).toBe('203.0.113.10');
    expect(formatVisitorIpLabel({ ip_hash: 'abcdef0123456789' })).toBe('abcdef01…');
    expect(formatVisitorIpLabel({})).toBe('');
  });

  it('formatRecentVisitorEventDetail joins IP, ref, country, and platform', () => {
    const detail = formatRecentVisitorEventDetail({
      event_name: 'ShareReferral',
      metadata: { client_ip: '1.2.3.4', platform: 'x' },
      ref_code: 'VIRAL-ABC',
      country_code: 'US',
    });
    expect(detail).toContain('1.2.3.4');
    expect(detail).toContain('ref:VIRAL-ABC');
    expect(detail).toContain('US');
    expect(detail).toContain('x');
  });

  it('referral notifier helpers detect recent rows and IPs', () => {
    const recent = new Date().toISOString();
    const old = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(getReferralNotifierIp({ referred_ip: '9.9.9.9' })).toBe('9.9.9.9');
    expect(isRecentReferralNotifier(recent, 60)).toBe(true);
    expect(isRecentReferralNotifier(old, 60)).toBe(false);
    expect(
      countRecentReferralNotifiers([
        { referrer_code: 'VIRAL-1', referred_ip: '1.1.1.1', created_at: recent },
        { referrer_code: 'VIRAL-2', referred_ip: '2.2.2.2', created_at: old },
      ]),
    ).toBe(1);
  });
});