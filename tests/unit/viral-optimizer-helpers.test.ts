import { describe, it, expect } from 'vitest';
import {
  computeDataReadiness,
  computeViralHealth,
  computeZoneHeat,
  detectOptimizerOpportunities,
  formatPct,
  rate,
} from '../../src/lib/viral-optimizer-helpers';
import type { ShareEvent } from '../../src/admin/share-analytics-helpers';

function visitorEvent(
  name: string,
  visitorId: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    event_name: name,
    visitor_id: visitorId,
    ref_code: extra.ref_code,
    metadata: extra.metadata ?? {},
    created_at: new Date().toISOString(),
  };
}

const share = (overrides: Partial<ShareEvent>): ShareEvent => ({
  platform: 'whatsapp',
  referrer_code: 'VIRAL-REAL01',
  created_at: new Date().toISOString(),
  ab_variant: 'a',
  ...overrides,
});

describe('viral-optimizer-helpers', () => {
  it('computes viral health rates from unique visitors', () => {
    const events = [
      ...Array.from({ length: 10 }, (_, i) => visitorEvent('SiteLanding', `v${i}`)),
      ...Array.from({ length: 4 }, (_, i) => visitorEvent('GetReferralLink', `g${i}`)),
      ...Array.from({ length: 2 }, (_, i) => visitorEvent('ShareReferral', `s${i}`)),
    ];
    const health = computeViralHealth(events, [], {});
    expect(health.landings).toBe(10);
    expect(health.getLink).toBe(4);
    expect(health.shares).toBe(2);
    expect(health.getLinkRate).toBeCloseTo(0.4);
    expect(health.shareAfterGetLinkRate).toBeCloseTo(0.5);
  });

  it('detects referred hero leak when referred get-link rate is low', () => {
    const events = [
      ...Array.from({ length: 20 }, (_, i) =>
        visitorEvent('SiteLanding', `r${i}`, { ref_code: 'FRIEND1', metadata: { path: '/r/FRIEND1' } }),
      ),
      visitorEvent('GetReferralLink', 'only-one', { ref_code: 'FRIEND1' }),
    ];
    const opps = detectOptimizerOpportunities(events, [], []);
    expect(opps.some((o) => o.id === 'referred-hero-leak')).toBe(true);
  });

  it('shows early signal with smaller samples', () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) =>
        visitorEvent('SiteLanding', `r${i}`, { ref_code: 'FRIEND1' }),
      ),
      visitorEvent('GetReferralLink', 'g1', { ref_code: 'FRIEND1' }),
    ];
    const opps = detectOptimizerOpportunities(events, [], []);
    expect(opps.some((o) => o.confidence === 'early')).toBe(true);
  });

  it('computes data readiness progress', () => {
    const health = computeViralHealth(
      Array.from({ length: 10 }, (_, i) => visitorEvent('SiteLanding', `v${i}`)),
      [],
      {},
    );
    const rows = computeDataReadiness(health, [], []);
    expect(rows.find((r) => r.id === 'landings')?.current).toBe(10);
    expect(rows.find((r) => r.id === 'landings')?.status).toBe('early');
  });

  it('detects share panel leak when get-link is high but sharing is low', () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => visitorEvent('SiteLanding', `l${i}`)),
      ...Array.from({ length: 12 }, (_, i) => visitorEvent('GetReferralLink', `g${i}`)),
      visitorEvent('ShareReferral', 's1'),
    ];
    const opps = detectOptimizerOpportunities(events, [], []);
    expect(opps.some((o) => o.id === 'share-panel-leak')).toBe(true);
  });

  it('aggregates zone click heat', () => {
    const rows = [
      { event_type: 'click', zone_id: 'hero-get-link' },
      { event_type: 'click', zone_id: 'hero-get-link' },
      { event_type: 'click', zone_id: 'share-whatsapp' },
      { event_type: 'scroll_depth', zone_id: 'page', scroll_depth_pct: 50 },
    ];
    const heat = computeZoneHeat(rows);
    expect(heat[0]?.zoneId).toBe('hero-get-link');
    expect(heat[0]?.clicks).toBe(2);
    expect(heat.find((z) => z.zoneId === 'share-whatsapp')?.clicks).toBe(1);
  });

  it('flags A/B winner when conversion gap is meaningful', () => {
    const shares = [
      share({ referrer_code: 'VIRAL-A1', ab_variant: 'a' }),
      share({ referrer_code: 'VIRAL-A2', ab_variant: 'a' }),
      share({ referrer_code: 'VIRAL-A3', ab_variant: 'a' }),
      share({ referrer_code: 'VIRAL-A4', ab_variant: 'a' }),
      share({ referrer_code: 'VIRAL-A5', ab_variant: 'a' }),
      share({ referrer_code: 'VIRAL-B1', ab_variant: 'b' }),
      share({ referrer_code: 'VIRAL-B2', ab_variant: 'b' }),
      share({ referrer_code: 'VIRAL-B3', ab_variant: 'b' }),
      share({ referrer_code: 'VIRAL-B4', ab_variant: 'b' }),
      share({ referrer_code: 'VIRAL-B5', ab_variant: 'b' }),
    ];
    const counts = {
      'VIRAL-A1': 2,
      'VIRAL-A2': 2,
      'VIRAL-A3': 1,
      'VIRAL-A4': 1,
      'VIRAL-A5': 1,
      'VIRAL-B1': 0,
      'VIRAL-B2': 0,
      'VIRAL-B3': 0,
      'VIRAL-B4': 0,
      'VIRAL-B5': 0,
    };
    const opps = detectOptimizerOpportunities([], shares, counts);
    const winner = opps.find((o) => o.id === 'share-ab-winner');
    expect(winner).toBeTruthy();
    expect(winner?.actionId).toBe('promote-ab');
  });

  it('formats rates as percentages', () => {
    expect(formatPct(rate(1, 4))).toBe('25.0%');
  });
});