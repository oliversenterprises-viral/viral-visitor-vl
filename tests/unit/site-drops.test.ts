import { describe, expect, it } from 'vitest';
import {
  ENTERED_TTL_MS,
  enqueuePendingEntered,
  expireSiteDrops,
  parseSiteDrops,
  promoteEnteredDrop,
  promoteRisingDrop,
  publicEnteredDrops,
  publicPendingEntered,
  publicRisingDrops,
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
});
