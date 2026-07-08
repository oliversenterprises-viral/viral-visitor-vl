import { describe, it, expect } from 'vitest';
import {
  GROWTH_MIN_GET_LINK,
  GROWTH_SHARE_LEAK_THRESHOLD,
  computeGrowthHealth,
  evaluateGrowthShareFirst,
  mergeGrowthEngineRunFlags,
  resolveGrowthEngineCycle,
} from '../../supabase/functions/_shared/growth-engine';
import {
  AUTOPILOT_MIN_SHARES_PER_VARIANT,
  computeAutopilotConversion,
} from '../../supabase/functions/_shared/optimizer-autopilot';

const visitor = (
  eventName: string,
  visitorId: string,
  opts: { ref?: string } = {},
): Record<string, unknown> => ({
  event_name: eventName,
  visitor_id: visitorId,
  ref_code: opts.ref ?? null,
});

describe('growth-engine', () => {
  it('computeGrowthHealth counts unique visitors and rates', () => {
    const events = [
      visitor('SiteLanding', 'v1'),
      visitor('SiteLanding', 'v2'),
      visitor('SiteLanding', 'v3', { ref: 'VIRAL-A' }),
      visitor('GetReferralLink', 'v1'),
      visitor('GetReferralLink', 'v2'),
      visitor('GetReferralLink', 'v3', { ref: 'VIRAL-A' }),
      visitor('ShareReferral', 'v1'),
    ];
    const health = computeGrowthHealth(events, 10, 5);
    expect(health.landings).toBe(3);
    expect(health.getLink).toBe(3);
    expect(health.shares).toBe(1);
    expect(health.referredLandings).toBe(1);
    expect(health.shareAfterGetLinkRate).toBeCloseTo(1 / 3);
    expect(health.referralsPerShare).toBe(0.5);
  });

  it('evaluateGrowthShareFirst enables share-first on leak', () => {
    const health = computeGrowthHealth(
      Array.from({ length: GROWTH_MIN_GET_LINK }, (_, i) =>
        visitor('GetReferralLink', `g${i}`),
      ),
      0,
      0,
    );
    const decision = evaluateGrowthShareFirst({
      flags: { auto_pilot: true, growth_engine: true },
      health,
    });
    expect(decision.action).toBe('enable_share_first');
    expect(decision.wouldUpdateFlags).toBe(true);
  });

  it('skips share-first when rate is healthy', () => {
    const events = [
      ...Array.from({ length: GROWTH_MIN_GET_LINK }, (_, i) =>
        visitor('GetReferralLink', `g${i}`),
      ),
      ...Array.from(
        { length: Math.ceil(GROWTH_MIN_GET_LINK * GROWTH_SHARE_LEAK_THRESHOLD) },
        (_, i) => visitor('ShareReferral', `g${i}`),
      ),
    ];
    const health = computeGrowthHealth(events, 0, 0);
    const decision = evaluateGrowthShareFirst({
      flags: { auto_pilot: true },
      health,
    });
    expect(decision.action).toBe('none');
    expect(decision.reason).toContain('healthy');
  });

  it('resolveGrowthEngineCycle prioritizes A/B promote over share-first', () => {
    const shares = [
      ...Array.from({ length: AUTOPILOT_MIN_SHARES_PER_VARIANT }, (_, i) => ({
        referrer_code: `VIRAL-A${i}`,
        ab_variant: 'a',
      })),
      ...Array.from({ length: AUTOPILOT_MIN_SHARES_PER_VARIANT }, (_, i) => ({
        referrer_code: `VIRAL-B${i}`,
        ab_variant: 'b',
      })),
    ];
    const counts: Record<string, number> = {};
    shares.forEach((s) => {
      counts[s.referrer_code!] = s.ab_variant === 'a' ? 3 : 0;
    });
    const conversion = computeAutopilotConversion(shares, counts);
    const leakEvents = Array.from({ length: GROWTH_MIN_GET_LINK }, (_, i) =>
      visitor('GetReferralLink', `leak${i}`),
    );
    const health = computeGrowthHealth(leakEvents, shares.length, 0);

    const cycle = resolveGrowthEngineCycle({
      flags: { auto_pilot: true, growth_engine: true },
      conversion,
      health,
    });

    expect(cycle.finalDecision.action).toBe('promote_ab');
    expect(cycle.engineStatus).toBe('acting');
  });

  it('mergeGrowthEngineRunFlags records k-score and share-first apply', () => {
    const health = computeGrowthHealth([], 0, 0);
    const cycle = resolveGrowthEngineCycle({
      flags: { auto_pilot: true },
      conversion: { rows: [], leaderVariant: null, insight: '' },
      health,
    });
    cycle.finalDecision = {
      action: 'enable_share_first',
      reason: 'test',
      wouldUpdateFlags: true,
      phase: '3b',
    };
    cycle.engineStatus = 'acting';

    const merged = mergeGrowthEngineRunFlags(
      { auto_pilot: true },
      cycle,
      '2026-07-04T12:00:00.000Z',
      true,
    );
    expect(merged.referred_share_first).toBe(true);
    expect(merged.growth_engine_last_action).toBe('enable_share_first');
    expect(merged.growth_engine_k_score).toBe(0);
    expect(merged.growth_engine_status).toBe('acting');
  });
});