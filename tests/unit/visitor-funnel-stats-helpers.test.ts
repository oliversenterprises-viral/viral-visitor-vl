import { describe, it, expect } from 'vitest';
import {
  countryLabel,
  filterCountryRowsForDisplay,
  sortSourceEntries,
  shouldShowUtmSources,
  computeFunnelTotals,
  topCountries,
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

  it('computeFunnelTotals sums events and computes conversion', () => {
    const funnel = [
      funnelRow('SiteLanding', 100),
      funnelRow('SubmitPrizeClaim', 25),
      funnelRow('Other', 10),
    ];
    const totals = computeFunnelTotals(funnel);
    expect(totals.totalEvents).toBe(135);
    expect(totals.landings).toBe(100);
    expect(totals.claims).toBe(25);
    expect(totals.conversion).toBe('25.0%');
  });

  it('topCountries returns at most limit rows', () => {
    const rows = Array.from({ length: 12 }, (_, i) => countryRow(`C${i}`, i + 1));
    expect(topCountries(rows, 5)).toHaveLength(5);
    expect(topCountries(rows, 5)[0].country).toBe('C0');
  });
});