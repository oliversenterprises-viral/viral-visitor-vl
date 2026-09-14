import { describe, expect, it } from 'vitest';
import {
  CODE_RE,
  isReferralCode,
  newCode,
  buildBoard,
  createEmptyState,
  joinAndMaybeCredit,
  newActorId,
  nextActionFor,
  normalizeWebsiteUrl,
  utcWeekId,
} from '../functions/_lib/engine';

const now = Date.parse('2026-09-12T15:00:00.000Z');

function actor(seed: string): string {
  const hex = seed.replace(/[^a-f0-9]/g, 'a');
  return hex.padEnd(32, '0').slice(0, 32);
}

function mustJoin(...args: Parameters<typeof joinAndMaybeCredit>) {
  const outcome = joinAndMaybeCredit(...args);
  if (!('result' in outcome)) throw new Error(outcome.error);
  return outcome;
}

describe('referral codes', () => {
  it('mints live VIRAL- codes and still accepts a legacy VR- leftover', () => {
    const code = newCode(new Set());
    expect(code).toMatch(CODE_RE);
    expect(isReferralCode(code)).toBe(true);
    expect(isReferralCode('VIRAL-JL8QR8M')).toBe(true);
    expect(isReferralCode('VR-ABC234')).toBe(true);
    expect(isReferralCode('NOPE')).toBe(false);
  });
});

describe('nextActionFor', () => {
  it('always names the next unlock in friend-count language', () => {
    expect(nextActionFor({ credits: 0, weeklyCredits: 0, rung: 'entered' }).label).toBe(
      'Send to 1 friend to unlock Rising',
    );
    expect(nextActionFor({ credits: 1, weeklyCredits: 1, rung: 'rising' }).label).toBe(
      'Send to 1 more friend this week to unlock Challenger',
    );
    expect(nextActionFor({ credits: 2, weeklyCredits: 2, rung: 'challenger' }).label).toBe(
      'Send to 1 more friend this week to unlock the #1 banner',
    );
    expect(nextActionFor({ credits: 3, weeklyCredits: 3, rung: 'banner' }).label).toBe(
      'Hold #1 this week. Keep sharing.',
    );
    expect(nextActionFor({ credits: 0, weeklyCredits: 0, rung: 'entered' }).nearMiss).toBe('1 friend from Rising');
    expect(nextActionFor({ credits: 1, weeklyCredits: 1, rung: 'rising' }).nearMiss).toBe('1 friend from Challenger');
    expect(nextActionFor({ credits: 2, weeklyCredits: 2, rung: 'challenger' }).nearMiss).toBe('1 friend from #1');
  });
});

describe('normalizeWebsiteUrl', () => {
  it('accepts bare hosts and https', () => {
    expect(normalizeWebsiteUrl('https://example.com/x')).toBe('https://example.com/x');
    expect(normalizeWebsiteUrl('example.com')).toBe('https://example.com/');
  });

  it('rejects private and non-http URLs', () => {
    expect(normalizeWebsiteUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeWebsiteUrl('http://127.0.0.1')).toBeNull();
    expect(normalizeWebsiteUrl('http://192.168.1.4')).toBeNull();
    expect(normalizeWebsiteUrl('not a url')).toBeNull();
  });
});

describe('join without a site (live Get my link)', () => {
  it('mints a VIRAL- code with no URL, then attaches a site later', () => {
    const minted = mustJoin(createEmptyState(), { url: '', actorId: actor('aa'), now });
    expect(minted.result.player.code).toMatch(CODE_RE);
    expect(minted.result.site).toBeNull();
    expect(minted.result.isNewSite).toBe(false);
    expect(Object.keys(minted.state.sites)).toHaveLength(0);

    const friend = mustJoin(minted.state, {
      url: '',
      ref: minted.result.player.code,
      actorId: actor('bb'),
      now: now + 1000,
    });
    expect(friend.result.credited).toBe(true);
    expect(friend.result.player.code).toMatch(CODE_RE);

    const attached = mustJoin(minted.state, {
      url: 'https://later.test',
      actorId: actor('aa'),
      now: now + 2000,
    });
    expect(attached.result.site?.host).toBe('later.test');
    expect(attached.result.isNewSite).toBe(true);
    expect(attached.state.sites['later.test'].ownerCode).toBe(minted.result.player.code);
  });
});

describe('join + unique credit climb', () => {
  it('does not count visits or self taps, only unique friend joins', () => {
    let state = createEmptyState();
    const a = mustJoin(state, { url: 'https://alpha.test', actorId: actor('aa'), now });
    state = a.state;
    expect(a.result.player.code).toMatch(CODE_RE);
    expect(a.result.isNewSite).toBe(true);
    expect(state.sites['alpha.test'].creditTimes).toHaveLength(0);

    const self = mustJoin(state, {
      url: 'https://alpha.test',
      ref: a.result.player.code,
      actorId: actor('aa'),
      now: now + 1000,
    });
    state = self.state;
    expect(self.result.selfJoin).toBe(true);
    expect(self.result.credited).toBe(false);

    const f1 = mustJoin(state, {
      url: 'https://friend.test',
      ref: a.result.player.code,
      actorId: actor('bb'),
      now: now + 2000,
    });
    state = f1.state;
    expect(f1.result.credited).toBe(true);
    expect(f1.result.unlock?.rung).toBe('rising');

    const again = mustJoin(state, {
      url: 'https://friend2.test',
      ref: a.result.player.code,
      actorId: actor('bb'),
      now: now + 3000,
    });
    state = again.state;
    expect(again.result.alreadyCredited).toBe(true);
    expect(again.result.credited).toBe(false);
    expect(state.sites['alpha.test'].creditTimes).toHaveLength(1);
  });

  it('does not let TE-tagged Get-my-link write a verified credit', () => {
    let state = createEmptyState();
    const a = mustJoin(state, { url: 'https://alpha.test', actorId: actor('aa'), now });
    state = a.state;
    const te = mustJoin(state, {
      url: 'https://bot.test',
      ref: a.result.player.code,
      actorId: actor('cc'),
      now: now + 4000,
      trafficExchange: true,
    });
    expect(te.result.teIgnored).toBe(true);
    expect(te.result.credited).toBe(false);
    expect(te.state.sites['alpha.test'].creditTimes).toHaveLength(0);
    const real = mustJoin(te.state, {
      url: 'https://human.test',
      ref: a.result.player.code,
      actorId: actor('dd'),
      now: now + 5000,
    });
    expect(real.result.credited).toBe(true);
    expect(real.state.sites['alpha.test'].creditTimes).toHaveLength(1);
  });

  it('promotes challenger then banner and records a kingmaker', () => {
    let state = createEmptyState();
    const owner = mustJoin(state, { url: 'https://champ.test', actorId: actor('aa'), now });
    state = owner.state;

    const referrer = mustJoin(state, { url: 'https://maker.test', actorId: actor('cc'), now: now + 10 });
    state = referrer.state;
    state.players[owner.result.player.code].referredBy = referrer.result.player.code;

    for (let i = 0; i < 3; i++) {
      const r = mustJoin(state, {
        url: `https://f${i}.test`,
        ref: owner.result.player.code,
        actorId: actor(`d${i}`),
        now: now + 1000 * (i + 1),
      });
      state = r.state;
      expect(r.result.credited).toBe(true);
    }

    const board = buildBoard(state, now + 4000, false);
    expect(board.banner?.host).toBe('champ.test');
    expect(board.weekId).toBe(utcWeekId(now));
    expect(state.kingmakers[0]?.code).toBe(referrer.result.player.code);
    expect(state.kingmakers[0]?.winnerHost).toBe('champ.test');
  });
});

describe('newActorId', () => {
  it('is 32 hex chars', () => {
    expect(newActorId()).toMatch(/^[a-f0-9]{32}$/);
  });
});
