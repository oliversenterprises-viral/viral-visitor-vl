import { describe, expect, it } from 'vitest';
import {
  closeStaleJuneHomepageBanners,
  computeDiedWaiting,
  computeOwnerFunnelDeskMetrics,
  formatOwnerRate,
  isStaleJuneHomepageBanner,
  parseDeskBanners,
} from '../../src/admin/owner-funnel-desk-helpers';
import { renderOwnerFunnelDeskView } from '../../src/admin/owner-funnel-desk';

const now = Date.parse('2026-08-16T18:00:00Z');

function landing(id: string, extra: Record<string, unknown> = {}) {
  return { event_name: 'SiteLanding', visitor_id: id, created_at: '2026-08-16T10:00:00Z', ...extra };
}
function getLink(id: string, extra: Record<string, unknown> = {}) {
  return { event_name: 'GetReferralLink', visitor_id: id, created_at: '2026-08-16T11:00:00Z', ...extra };
}
function share(id: string, platform: string) {
  return {
    event_name: 'ShareReferral',
    visitor_id: id,
    created_at: '2026-08-16T12:00:00Z',
    metadata: { platform },
  };
}

describe('owner funnel desk metrics', () => {
  it('formats rates and never uses claims/landings', () => {
    expect(formatOwnerRate(2, 4)).toBe('50.0%');
    expect(formatOwnerRate(0, 0)).toBe('—');
    const metrics = computeOwnerFunnelDeskMetrics({
      events: [
        landing('a'),
        landing('b'),
        getLink('a'),
        share('a', 'whatsapp'),
        share('a', 'copy'),
        { event_name: 'SubmitPrizeClaim', visitor_id: 'a', created_at: '2026-08-16T13:00:00Z' },
      ],
      shares: [
        { platform: 'whatsapp', referrer_code: 'VIRAL-REAL1' },
        { platform: 'copy', referrer_code: 'VIRAL-REAL1' },
      ],
      referrals: [{ referrer_code: 'VIRAL-REAL1', referred_ip: '8.8.8.8', user_agent: 'Mozilla' }],
      claims: [{ status: 'pending' }, { status: 'approved' }],
      now,
    });
    expect(metrics.landings).toBe(2);
    expect(metrics.getLink).toBe(1);
    expect(metrics.getLinkRate).toBe('50.0%');
    expect(metrics.share).toBe(1);
    expect(metrics.shareRate).toBe('100.0%');
    expect(metrics.lock).toBe(1);
    expect(metrics.lockRate).toBe('100.0%');
    expect(metrics.heroGetLinkRate).toBe('50.0%');
    expect(metrics.heroLockRate).toBe('100.0%');
    expect(metrics.heroGetLinkRate).not.toBe('50.0%X');
    expect(metrics.pendingClaims).toBe(1);
    expect(metrics.heroGetLinkRate).toBe(metrics.getLinkRate);
  });

  it('excludes copy shares and test/owner locks', () => {
    const metrics = computeOwnerFunnelDeskMetrics({
      events: [landing('a'), getLink('a'), share('a', 'copy')],
      shares: [{ platform: 'copy', referrer_code: 'VIRAL-REAL1' }],
      referrals: [
        { referrer_code: 'VIRAL-SMOKETEST', referred_ip: '1.1.1.1' },
        { referrer_code: 'VIRAL-REAL1', referred_ip: '161.38.136.60' },
      ],
      now,
    });
    expect(metrics.share).toBe(0);
    expect(metrics.lock).toBe(0);
  });

  it('counts died waiting from expired / 48h-old unlocked links', () => {
    const died = computeDiedWaiting({
      getLinkEvents: [getLink('old', { created_at: '2026-08-10T10:00:00Z' })],
      referrals: [],
      referrerLinks: [
        { referrer_code: 'VIRAL-WAIT1', status: 'expired', created_at: '2026-08-10T10:00:00Z' },
        { referrer_code: 'VIRAL-WAIT2', status: 'pending_share', created_at: '2026-08-10T10:00:00Z' },
        { referrer_code: 'VIRAL-LIVE1', status: 'active', created_at: '2026-08-10T10:00:00Z' },
        { referrer_code: 'VIRAL-SMOKETEST', status: 'expired', created_at: '2026-08-10T10:00:00Z' },
      ],
      now,
    });
    expect(died).toBe(2);
  });

  it('falls back to aged get-link without a lock when link rows are missing', () => {
    const died = computeDiedWaiting({
      getLinkEvents: [
        getLink('old', {
          created_at: '2026-08-10T10:00:00Z',
          metadata: { referrer_code: 'VIRAL-WAIT1' },
        }),
        getLink('locked', {
          created_at: '2026-08-10T10:00:00Z',
          metadata: { referrer_code: 'VIRAL-LIVE1' },
        }),
        getLink('fresh', { created_at: '2026-08-16T17:00:00Z' }),
      ],
      referrals: [{ referrer_code: 'VIRAL-LIVE1', referred_ip: '8.8.8.8', user_agent: 'Mozilla' }],
      referrerLinks: [],
      now,
    });
    expect(died).toBe(1);
  });

  it('counts promoter links plus credited friend Get-links', () => {
    const metrics = computeOwnerFunnelDeskMetrics({
      events: [
        getLink('p1', { metadata: { aff_code: 'ALICE' } }),
        getLink('p1b', { metadata: { aff_code: 'ALICE' } }),
        getLink('other'),
      ],
      affiliates: {
        affiliates: [{ code: 'ALICE', name: 'Alice', created_at: '2026-08-01T00:00:00Z', active: true }],
      },
      now,
    });
    expect(metrics.promoterLinks).toBe(1);
    expect(metrics.creditedGetLinks).toBe(2);
  });

  it('closes June #1 stale banners and hides CTR unless another banner is live', () => {
    const banners = parseDeskBanners([
      {
        imageUrl: 'https://cdn.example/june.png',
        redirectUrl: 'https://winner.example',
        label: 'June #1',
        enabled: true,
      },
      {
        imageUrl: 'https://cdn.example/fresh.png',
        redirectUrl: 'https://fresh.example',
        label: 'Live winner',
        enabled: true,
      },
    ]);
    expect(isStaleJuneHomepageBanner(banners[0]!)).toBe(true);
    expect(isStaleJuneHomepageBanner(banners[1]!)).toBe(false);
    const closed = closeStaleJuneHomepageBanners(banners);
    expect(closed.closed).toHaveLength(1);
    expect(closed.banners[0]?.enabled).toBe(false);
    expect(closed.banners[1]?.enabled).toBe(true);

    const juneOnly = computeOwnerFunnelDeskMetrics({
      banners: [banners[0]],
      bannerEvents: [
        { type: 'impression', label: 'June #1', redirect_url: 'https://winner.example' },
        { type: 'click', label: 'June #1', redirect_url: 'https://winner.example' },
      ],
      now,
    });
    expect(juneOnly.staleJuneBanners).toHaveLength(1);
    expect(juneOnly.liveBanner).toBe(false);
    expect(juneOnly.bannerCtr).toBeNull();

    const withLive = computeOwnerFunnelDeskMetrics({
      banners,
      bannerEvents: [
        { type: 'impression', label: 'Live winner', redirect_url: 'https://fresh.example' },
        { type: 'impression', label: 'Live winner', redirect_url: 'https://fresh.example' },
        { type: 'click', label: 'Live winner', redirect_url: 'https://fresh.example' },
      ],
      now,
    });
    expect(withLive.liveBanner).toBe(true);
    expect(withLive.bannerCtr?.impressions).toBe(2);
    expect(withLive.bannerCtr?.clicks).toBe(1);
    expect(withLive.bannerCtr?.ctr).toBe('50.0%');
  });

  it('renders the seven tiles and hero rates, not claims/landings', () => {
    const el = document.createElement('div');
    const metrics = computeOwnerFunnelDeskMetrics({
      events: [landing('a'), landing('b'), getLink('a'), share('a', 'whatsapp')],
      referrals: [{ referrer_code: 'VIRAL-REAL1', referred_ip: '8.8.8.8', user_agent: 'Mozilla' }],
      claims: [{ status: 'pending' }],
      now,
    });
    renderOwnerFunnelDeskView(el, metrics);
    expect(el.textContent).toMatch(/Hero conversion/i);
    expect(el.textContent).toMatch(/Get-link 50\.0%/);
    expect(el.textContent).toMatch(/Lock 100\.0%/);
    expect(el.textContent).toMatch(/Landings/);
    expect(el.textContent).toMatch(/Died waiting/);
    expect(el.textContent).toMatch(/Promoters/);
    expect(el.textContent).toMatch(/Claims/);
    expect(el.textContent).toMatch(/Copy is not success/);
    expect(el.textContent).not.toMatch(/Viral Power|quests|A-B/i);
    expect(el.querySelectorAll('article').length).toBe(7);
  });
});
