import { describe, it, expect } from 'vitest';
import {
  REDDIT_PIXEL_DISPLAY_ID,
  sortCampaignEntries,
  shouldShowCampaignBreakdown,
  computeRedditFunnelTotals,
  topCampaigns,
  type RedditFunnelRow,
} from '../../src/admin/reddit-campaign-stats-helpers';

const funnelRow = (name: string, count: number): RedditFunnelRow => ({ name, count });

describe('reddit campaign stats helpers (pure)', () => {
  it('exports stable Reddit pixel display id', () => {
    expect(REDDIT_PIXEL_DISPLAY_ID).toBe('a2_jr6jdbg2r4');
  });

  it('sortCampaignEntries orders by count descending', () => {
    const sorted = sortCampaignEntries({ alpha: 1, gamma: 9, beta: 4 });
    expect(sorted.map(([k]) => k)).toEqual(['gamma', 'beta', 'alpha']);
  });

  it('shouldShowCampaignBreakdown hides empty and lone (none)', () => {
    expect(shouldShowCampaignBreakdown({})).toBe(false);
    expect(shouldShowCampaignBreakdown({ '(none)': 3 })).toBe(false);
    expect(shouldShowCampaignBreakdown({ summer24: 2 })).toBe(true);
    expect(shouldShowCampaignBreakdown({ '(none)': 1, promo: 5 })).toBe(true);
  });

  it('computeRedditFunnelTotals sums events and computes conversion', () => {
    const funnel = [
      funnelRow('RedditLanding', 50),
      funnelRow('SubmitPrizeClaim', 10),
      funnelRow('Other', 5),
    ];
    const totals = computeRedditFunnelTotals(funnel);
    expect(totals.total).toBe(65);
    expect(totals.landings).toBe(50);
    expect(totals.claims).toBe(10);
    expect(totals.conversion).toBe('20.0%');
  });

  it('computeRedditFunnelTotals shows dash when no landings', () => {
    const totals = computeRedditFunnelTotals([funnelRow('SubmitPrizeClaim', 3)]);
    expect(totals.conversion).toBe('—');
  });

  it('topCampaigns slices to limit', () => {
    const entries: Array<[string, number]> = [
      ['a', 10],
      ['b', 8],
      ['c', 6],
      ['d', 4],
      ['e', 2],
      ['f', 1],
      ['g', 1],
    ];
    expect(topCampaigns(entries, 6)).toHaveLength(6);
    expect(topCampaigns(entries, 6).map(([k]) => k)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});