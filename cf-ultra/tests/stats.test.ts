import { describe, expect, it } from 'vitest';
import { applyEvent, daysBack, emptyBucket, funnelRates, hintsFromRequest, mergeBuckets, topMap } from '../functions/_lib/stats';

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

  it('counts TE lands and joins separately from credits', () => {
    const b = emptyBucket('2026-09-12T15');
    applyEvent(b, 'land', { ...hints, te: true, camp: 'rotator', utm: 'te' });
    applyEvent(b, 'join', { ...hints, te: true, camp: 'rotator', utm: 'te' });
    applyEvent(b, 'te_ignored', { ...hints, te: true, camp: 'rotator', utm: 'te' });
    expect(b.teLands).toBe(1);
    expect(b.teJoins).toBe(1);
    expect(b.teCreditsIgnored).toBe(1);
    expect(b.credits).toBe(0);
    expect(funnelRates(b).teToJoin).toBe(100);
  });

  it('counts splash views and CTA clicks without inventing credits', () => {
    const b = emptyBucket('2026-09-12T15');
    applyEvent(b, 'te_splash_view', { ...hints, te: true, camp: 'demo', utm: 'te', src: 'te' });
    applyEvent(b, 'te_splash_cta', { ...hints, te: true, camp: 'demo', utm: 'te', src: 'te' });
    expect(b.teSplashViews).toBe(1);
    expect(b.teSplashCtas).toBe(1);
    expect(b.teLands).toBe(1);
    expect(b.credits).toBe(0);
    expect(b.camps.demo).toBe(2);
    expect(b.srcs.te).toBe(2);
    expect(funnelRates(b).splashToCta).toBe(100);
  });

  it('rolls src tags the same way as camps, including empty → unknown', () => {
    const b = emptyBucket('2026-09-12T15');
    applyEvent(b, 'land', { ...hints, src: 'te', camp: 'rotator' });
    applyEvent(b, 'land', { ...hints, src: 'splash', camp: 'week1' });
    applyEvent(b, 'land', { ...hints, src: '', camp: '' });
    applyEvent(b, 'join', { ...hints, src: 'te', camp: 'rotator' });
    expect(b.srcs.te).toBe(2);
    expect(b.srcs.splash).toBe(1);
    expect(b.srcs.unknown).toBe(1);
    expect(b.camps.rotator).toBe(2);
    expect(b.camps.week1).toBe(1);
    const m = mergeBuckets(b, emptyBucket('2026-09-12T15'));
    expect(m.srcs.te).toBe(2);
    expect(m.srcs.unknown).toBe(1);
    const legacy = emptyBucket('2026-09-12T15');
    delete (legacy as { srcs?: Record<string, number> }).srcs;
    expect(mergeBuckets(b, legacy).srcs.te).toBe(2);
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

describe('hintsFromRequest src', () => {
  it('keeps src on land/track hints and collapses TE tags', () => {
    const req = new Request('https://demo.example/api/track', { headers: { 'user-agent': 'Mozilla/5.0' } });
    expect(hintsFromRequest(req, { src: 'te', camp: 'demo' })).toMatchObject({ src: 'te', camp: 'demo', te: true });
    expect(hintsFromRequest(req, { src: 'hit-exchange', camp: 'box' }).src).toBe('te');
    expect(hintsFromRequest(req, { src: 'splash', camp: 'week1' })).toMatchObject({ src: 'splash', camp: 'week1', te: false });
    expect(hintsFromRequest(req, {}).src).toBe('');
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
