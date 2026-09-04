import { describe, expect, it } from 'vitest';
import {
  ENTERED_TTL_MS,
  RISING_TTL_MS,
  applySiteDropClimb,
  enqueuePendingEntered,
  expireSiteDrops,
  parseSiteDrops,
  promoteChallengerDrop,
  promoteEnteredDrop,
  promoteRisingDrop,
  publicChallengerDrops,
  publicEnteredDrops,
  publicPendingEntered,
  publicRisingDrops,
  rememberDropSite,
  siteForCode,
} from '../../src/lib/site-drops';

const AUG_PENDING = [
  { code: 'VIRAL-V7VH0BW', earned_at: '2026-08-29T01:14:25.203Z' },
  { code: 'VIRAL-3P5QIIN', earned_at: '2026-08-31T21:49:43.453Z' },
];

describe('site-drops promotion', () => {
  it('parses live-shaped pending without inventing live drops', () => {
    const state = parseSiteDrops({
      drops: [],
      pending_entered: AUG_PENDING,
    });
    expect(state.drops).toEqual([]);
    expect(state.pending_entered).toHaveLength(2);
    expect(publicEnteredDrops(state, new Date('2026-09-02T10:40:00Z'))).toEqual([]);
    expect(publicPendingEntered(state)).toEqual([]);
  });

  it('expires August pending and does not publish them as Just entered', () => {
    const now = new Date('2026-09-02T10:40:00Z');
    const expired = expireSiteDrops(
      parseSiteDrops({ drops: [], pending_entered: AUG_PENDING }),
      now,
    );
    expect(expired.pending_entered).toEqual([]);
    expect(expired.drops).toEqual([]);
    expect(publicEnteredDrops(expired, now)).toEqual([]);
  });

  it('stale pending cannot block a new qualifying entered drop', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const clogged = parseSiteDrops({ drops: [], pending_entered: AUG_PENDING });
    const next = promoteEnteredDrop(
      clogged,
      { code: 'VIRAL-NEWCODE1', url: 'https://example.com/racer', label: 'Example' },
      now,
    );
    expect(next.pending_entered).toEqual([]);
    const live = publicEnteredDrops(next, now);
    expect(live).toHaveLength(1);
    expect(live[0].code).toBe('VIRAL-NEWCODE1');
    expect(live[0].url).toContain('example.com');
    expect(Date.parse(live[0].expires_at) - now.getTime()).toBe(ENTERED_TTL_MS);
    expect(live.map((d) => d.code)).not.toContain('VIRAL-V7VH0BW');
  });

  it('enqueue then expire keeps only fresh pending', () => {
    const t0 = new Date('2026-09-02T12:00:00Z');
    let state = enqueuePendingEntered({ drops: [], pending_entered: AUG_PENDING }, 'VIRAL-FRESH01', t0);
    expect(state.pending_entered.map((p) => p.code)).toEqual(['VIRAL-FRESH01']);
    state = expireSiteDrops(state, new Date(t0.getTime() + ENTERED_TTL_MS + 1));
    expect(state.pending_entered).toEqual([]);
  });

  it('rising requires a verified friend lock', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const empty = parseSiteDrops({ drops: [], pending_entered: [] });
    const denied = promoteRisingDrop(
      empty,
      { code: 'VIRAL-RISE01', url: 'https://rise.example', locks: 0 },
      now,
    );
    expect(publicRisingDrops(denied, now)).toEqual([]);
    const ok = promoteRisingDrop(
      empty,
      { code: 'VIRAL-RISE01', url: 'https://rise.example', locks: 1 },
      now,
    );
    expect(publicRisingDrops(ok, now)).toHaveLength(1);
  });

  it('does not promote test codes', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const next = promoteEnteredDrop(
      { drops: [], pending_entered: [] },
      { code: 'VIRAL-SMOKETEST', url: 'https://example.com' },
      now,
    );
    expect(next.drops).toEqual([]);
  });

  it('remembers a website after Just entered expires', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const live = promoteEnteredDrop(
      { drops: [], pending_entered: [] },
      { code: 'VIRAL-KEEPURL', url: 'mysite.com', label: 'Mine' },
      now,
    );
    expect(siteForCode(live, 'VIRAL-KEEPURL')?.url).toContain('mysite.com');
    const later = expireSiteDrops(live, new Date(now.getTime() + ENTERED_TTL_MS + 1));
    expect(publicEnteredDrops(later, new Date(now.getTime() + ENTERED_TTL_MS + 1))).toEqual([]);
    expect(siteForCode(later, 'VIRAL-KEEPURL')?.url).toContain('mysite.com');
    expect(siteForCode(later, 'VIRAL-KEEPURL')?.label).toBe('Mine');
  });

  it('parses remembered sites from stored JSON', () => {
    const state = parseSiteDrops({
      drops: [],
      pending_entered: [],
      sites: [{ code: 'VIRAL-SITE01', url: 'https://keep.example', label: 'Keep', updated_at: '2026-09-02T12:00:00Z' }],
    });
    expect(siteForCode(state, 'VIRAL-SITE01')?.url).toContain('keep.example');
  });

  it('climbs 0 friends to Just entered and 1 friend to Rising', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const entered = applySiteDropClimb(
      { drops: [], pending_entered: [] },
      { code: 'VIRAL-CLIMB1', url: 'https://climb.example', locks: 0 },
      now,
    );
    expect(publicEnteredDrops(entered, now)).toHaveLength(1);
    expect(publicRisingDrops(entered, now)).toEqual([]);
    const rising = applySiteDropClimb(entered, {
      code: 'VIRAL-CLIMB1',
      url: 'https://climb.example',
      locks: 1,
    }, now);
    expect(publicEnteredDrops(rising, now)).toEqual([]);
    expect(publicRisingDrops(rising, now)).toHaveLength(1);
    expect(publicRisingDrops(rising, now)[0].locks).toBe(1);
  });

  it('climbs board #2 to Challenger with a remembered URL', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const next = applySiteDropClimb(
      { drops: [], pending_entered: [] },
      { code: 'VIRAL-CHAL02', url: 'https://chal.example', locks: 2, rank: 2 },
      now,
    );
    expect(publicRisingDrops(next, now)).toHaveLength(1);
    expect(publicChallengerDrops(next, now).map((d) => d.rank)).toEqual([2]);
  });

  it('does not invent a chip when there is no URL', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const next = applySiteDropClimb(
      { drops: [], pending_entered: [] },
      { code: 'VIRAL-NOURL1', url: '', locks: 3, rank: 2 },
      now,
    );
    expect(next.drops).toEqual([]);
    expect(siteForCode(next, 'VIRAL-NOURL1')).toBeNull();
  });

  it('does not extend Rising time on a same-lock refresh', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const first = promoteRisingDrop(
      { drops: [], pending_entered: [] },
      { code: 'VIRAL-HOLD01', url: 'https://hold.example', locks: 1 },
      now,
    );
    const later = new Date(now.getTime() + 10 * 60 * 1000);
    const second = promoteRisingDrop(first, {
      code: 'VIRAL-HOLD01',
      url: 'https://hold.example',
      locks: 1,
    }, later);
    expect(second.drops[0].expires_at).toBe(first.drops[0].expires_at);
    const more = promoteRisingDrop(second, {
      code: 'VIRAL-HOLD01',
      url: 'https://hold.example',
      locks: 2,
    }, later);
    expect(Date.parse(more.drops[0].expires_at) - later.getTime()).toBe(RISING_TTL_MS);
  });

  it('falls back to a live drop URL when sites[] is empty', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const live = promoteEnteredDrop(
      { drops: [], pending_entered: [] },
      { code: 'VIRAL-FALL01', url: 'https://fall.example' },
      now,
    );
    const stripped = { ...live, sites: [] };
    expect(siteForCode(stripped, 'VIRAL-FALL01')?.url).toContain('fall.example');
    expect(rememberDropSite(stripped, { code: 'VIRAL-FALL01', url: 'https://fall.example' }, now).sites?.length).toBe(1);
  });

  it('promoteChallengerDrop ignores ranks other than 2 and 3', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    const denied = promoteChallengerDrop(
      { drops: [], pending_entered: [] },
      { code: 'VIRAL-RANK1', url: 'https://one.example', rank: 1, locks: 4 },
      now,
    );
    expect(publicChallengerDrops(denied, now)).toEqual([]);
  });
});
