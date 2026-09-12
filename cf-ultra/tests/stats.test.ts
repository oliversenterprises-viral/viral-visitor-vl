import { describe, expect, it } from 'vitest';
import { applyEvent, daysBack, emptyBucket, funnelRates, mergeBuckets, topMap } from '../functions/_lib/stats';

const hints = {
  country: 'US',
  device: 'mobile' as const,
  browser: 'chrome',
  referrer: 't.co',
  utm: 'twitter',
  platform: 'x' as const,
};

describe('rollup merge', () => {
  it('adds conversion counters and maps', () => {
    const a = emptyBucket('2026-09-12T15');
    const b = emptyBucket('2026-09-12T15');
    applyEvent(a, 'land', hints);
    applyEvent(a, 'join', hints);
    applyEvent(b, 'share', hints);
    applyEvent(b, 'credit', hints);
    const m = mergeBuckets(a, b);
    expect(m.lands).toBe(1);
    expect(m.joins).toBe(1);
    expect(m.shares).toBe(1);
    expect(m.credits).toBe(1);
    expect(m.platforms.x).toBe(4);
    expect(m.geo.US).toBe(4);
  });

  it('computes funnel percents without inventing volume', () => {
    const b = emptyBucket('x');
    b.shares = 10;
    b.credits = 4;
    b.lands = 20;
    b.joins = 8;
    const f = funnelRates(b);
    expect(f.shareToCredit).toBe(40);
    expect(f.bounce).toBe(60);
  });
});

describe('daysBack', () => {
  it('returns today plus history', () => {
    expect(daysBack('today', Date.parse('2026-09-12T15:00:00Z'))).toEqual(['2026-09-12']);
    expect(daysBack('7d', Date.parse('2026-09-12T15:00:00Z'))).toHaveLength(7);
  });
});

describe('topMap', () => {
  it('sorts desc and caps', () => {
    expect(topMap({ a: 1, b: 5, c: 3 }, 2)).toEqual([
      { key: 'b', n: 5 },
      { key: 'c', n: 3 },
    ]);
  });
});
