import { afterEach, describe, expect, it } from 'vitest';
import {
  JOIN_ACTOR_MAX,
  JOIN_GLOBAL_MAX,
  JOIN_IP_MAX,
  allowJoin,
  hitLimit,
  resetLimits,
} from '../functions/_lib/limit';

afterEach(() => resetLimits());

describe('hitLimit', () => {
  it('allows up to max then blocks without throwing', () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      const r = hitLimit('k', 3, 60_000, now + i);
      expect(r.ok).toBe(true);
    }
    const blocked = hitLimit('k', 3, 60_000, now + 10);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('resets after the window', () => {
    const now = 1_000_000;
    hitLimit('w', 1, 1_000, now);
    expect(hitLimit('w', 1, 1_000, now + 1).ok).toBe(false);
    expect(hitLimit('w', 1, 1_000, now + 1_001).ok).toBe(true);
  });
});

describe('allowJoin', () => {
  it('caps per IP and per actor', () => {
    const t0 = 5_000_000;
    for (let i = 0; i < JOIN_IP_MAX; i++) {
      expect(allowJoin('1.1.1.1', `a${i}`.padEnd(32, '0'), t0 + i).ok).toBe(true);
    }
    expect(allowJoin('1.1.1.1', 'bb'.padEnd(32, '0'), t0 + 20).ok).toBe(false);

    resetLimits();
    const actor = 'cc'.padEnd(32, '0');
    for (let i = 0; i < JOIN_ACTOR_MAX; i++) {
      expect(allowJoin(`9.9.9.${i}`, actor, t0 + i).ok).toBe(true);
    }
    expect(allowJoin('8.8.8.8', actor, t0 + 10).ok).toBe(false);
  });

  it('sheds a global join spike', () => {
    const t0 = 9_000_000;
    let blocked = 0;
    for (let i = 0; i < JOIN_GLOBAL_MAX + 5; i++) {
      const r = allowJoin(`10.0.${i % 250}.${i % 200}`, `f${i}`.padEnd(32, '0'), t0);
      if (!r.ok) blocked += 1;
    }
    expect(blocked).toBeGreaterThan(0);
  });
});
