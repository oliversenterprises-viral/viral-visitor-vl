import { describe, expect, it } from 'vitest';
import { computeFunnelTotals } from '../../src/admin/visitor-funnel-stats-helpers';
import {
  assembleOwnerFunnelDeskFromServer,
  computeOwnerFunnelDeskMetrics,
  formatOwnerRate,
  isDeskVerifiedShare,
  isLockedReferrer,
  parseOwnerFunnelDeskCounts,
  resolveOwnerFunnelVia,
} from '../../src/admin/owner-funnel-desk-helpers';
import { renderOwnerFunnelDeskView } from '../../src/admin/owner-funnel-desk';

const now = Date.parse('2026-08-16T18:00:00Z');

function landing(id: string, extra: Record<string, unknown> = {}) {
  return {
    event_name: 'SiteLanding',
    visitor_id: id,
    created_at: '2026-08-16T10:00:00Z',
    ...extra,
  };
}
function getLink(id: string, extra: Record<string, unknown> = {}) {
  return {
    event_name: 'GetReferralLink',
    visitor_id: id,
    created_at: '2026-08-16T11:00:00Z',
    ...extra,
  };
}

describe('owner funnel desk metrics', () => {
  it('counts five numbers: unique landings, unique get-link, verified shares, unique locked, get-link rate', () => {
    expect(formatOwnerRate(1, 2)).toBe('50.0%');
    expect(formatOwnerRate(0, 0)).toBe('0%');

    const metrics = computeOwnerFunnelDeskMetrics({
      events: [
        landing('a', { metadata: { path: '/' } }),
        landing('a', { created_at: '2026-08-16T10:05:00Z' }),
        landing('b', { ref_code: 'VIRAL-REAL1', metadata: { path: '/r/VIRAL-REAL1' } }),
        getLink('a'),
        getLink('a', { created_at: '2026-08-16T11:10:00Z' }),
        { event_name: 'CopyReferralLink', visitor_id: 'a', created_at: '2026-08-16T12:00:00Z' },
        { event_name: 'SubmitPrizeClaim', visitor_id: 'a', created_at: '2026-08-16T13:00:00Z' },
      ],
      shares: [
        { platform: 'native', referrer_code: 'VIRAL-REAL1', created_at: '2026-08-16T12:00:00Z' },
        { platform: 'copy', referrer_code: 'VIRAL-REAL1', created_at: '2026-08-16T12:01:00Z' },
        { platform: 'whatsapp', referrer_code: 'VIRAL-REAL1', created_at: '2026-08-16T12:02:00Z' },
      ],
      referrals: [
        {
          referrer_code: 'VIRAL-REAL1',
          referred_code: 'VIRAL-FRIEND1',
          created_at: '2026-08-16T12:30:00Z',
          referred_ip: '8.8.8.8',
          user_agent: 'Mozilla',
        },
        {
          referrer_code: 'VIRAL-REAL1',
          created_at: '2026-08-16T13:00:00Z',
          referred_ip: '9.9.9.9',
          user_agent: 'Mozilla',
        },
      ],
      referrerLinks: [
        { referrer_code: 'VIRAL-REAL1', status: 'active', created_at: '2026-08-16T12:30:00Z' },
        { referrer_code: 'VIRAL-WAIT', status: 'pending_share', created_at: '2026-08-16T12:00:00Z' },
        { referrer_code: 'VIRAL-OLD', status: 'expired', created_at: '2026-08-10T12:00:00Z' },
      ],
      now,
    });

    expect(metrics.landings).toBe(2);
    expect(metrics.getLink).toBe(1);
    expect(metrics.share).toBe(1);
    expect(metrics.locked).toBe(1);
    expect(metrics.getLinkRate).toBe('50.0%');
    expect(metrics.windowDays).toBe(7);
    expect(metrics.feed.some((row) => row.kind === 'locked' && row.code === 'VIRAL-REAL1')).toBe(true);
    expect(metrics.feed.some((row) => row.kind === 'locked' && row.friendCode === 'VIRAL-FRIEND1')).toBe(true);
    expect(metrics.feed.some((row) => row.label === 'Landed')).toBe(true);
    expect(metrics.feed.some((row) => row.label === 'Got a link')).toBe(true);
    expect(metrics.feed.some((row) => row.label === 'Shared')).toBe(true);
    expect(JSON.stringify(metrics)).not.toMatch(/8\.8\.8\.8|9\.9\.9\.9/);
  });

  it('excludes owner IP, test codes, webdriver, copy, and clipboard', () => {
    const metrics = computeOwnerFunnelDeskMetrics({
      events: [
        landing('owner', { metadata: { client_ip: '161.38.136.60' } }),
        landing('bot', { metadata: { webdriver: true } }),
        landing('ok', { metadata: { client_ip: '8.8.8.8' } }),
        getLink('ok'),
        {
          event_name: 'SiteLanding',
          visitor_id: 'e2e',
          ref_code: 'VIRAL-DEMOCODE',
          created_at: '2026-08-16T10:00:00Z',
        },
      ],
      shares: [
        { platform: 'copy', referrer_code: 'VIRAL-REAL1', created_at: '2026-08-16T12:00:00Z' },
        { platform: 'discord', referrer_code: 'VIRAL-REAL1', created_at: '2026-08-16T12:01:00Z' },
        { platform: 'native', referrer_code: 'VIRAL-SMOKETEST', created_at: '2026-08-16T12:02:00Z' },
      ],
      referrals: [
        { referrer_code: 'VIRAL-SMOKETEST', referred_ip: '1.1.1.1', created_at: '2026-08-16T12:00:00Z' },
        { referrer_code: 'VIRAL-REAL1', referred_ip: '161.38.136.60', created_at: '2026-08-16T12:00:00Z' },
      ],
      now,
    });
    expect(metrics.landings).toBe(1);
    expect(metrics.getLink).toBe(1);
    expect(metrics.share).toBe(0);
    expect(metrics.locked).toBe(0);
  });

  it('does not count pending or expired links as locked without a referral', () => {
    expect(isLockedReferrer({ status: 'pending_share', referralCount: 0 })).toBe(false);
    expect(isLockedReferrer({ status: 'expired', referralCount: 0 })).toBe(false);
    expect(isLockedReferrer({ status: 'active', referralCount: 0 })).toBe(true);
    expect(isLockedReferrer({ status: 'pending_share', referralCount: 1 })).toBe(true);

    const metrics = computeOwnerFunnelDeskMetrics({
      referrerLinks: [
        { referrer_code: 'VIRAL-WAIT', status: 'pending_share', created_at: '2026-08-16T12:00:00Z' },
        { referrer_code: 'VIRAL-DEAD', status: 'expired', created_at: '2026-08-16T12:00:00Z' },
        { referrer_code: 'VIRAL-LIVE', status: 'active', created_at: '2026-08-16T12:00:00Z' },
      ],
      now,
    });
    expect(metrics.locked).toBe(1);
  });

  it('ignores events older than 7 days', () => {
    const metrics = computeOwnerFunnelDeskMetrics({
      events: [
        landing('old', { created_at: '2026-08-01T10:00:00Z' }),
        landing('new', { created_at: '2026-08-16T10:00:00Z' }),
        getLink('old', { created_at: '2026-08-01T11:00:00Z' }),
      ],
      now,
    });
    expect(metrics.landings).toBe(1);
    expect(metrics.getLink).toBe(0);
    expect(metrics.getLinkRate).toBe('0.0%');
  });

  it('labels via as direct, friend /r/, or promoter /a/', () => {
    expect(resolveOwnerFunnelVia({ metadata: { path: '/' } })).toBe('direct');
    expect(resolveOwnerFunnelVia({ ref_code: 'VIRAL-A', metadata: { path: '/r/VIRAL-A' } })).toBe('friend');
    expect(resolveOwnerFunnelVia({ metadata: { path: '/a/ALICE', aff_code: 'ALICE' } })).toBe('promoter');
    expect(isDeskVerifiedShare('native')).toBe(true);
    expect(isDeskVerifiedShare('whatsapp')).toBe(true);
    expect(isDeskVerifiedShare('copy')).toBe(false);
    expect(isDeskVerifiedShare('copy-message')).toBe(false);
    expect(isDeskVerifiedShare('clipboard')).toBe(false);
    expect(isDeskVerifiedShare('intent-open')).toBe(false);
    expect(isDeskVerifiedShare('first_referral')).toBe(false);
  });

  it('renders five tiles and one feed, never seven-tile leftovers', () => {
    const el = document.createElement('div');
    const metrics = computeOwnerFunnelDeskMetrics({
      events: [
        landing('a'),
        landing('b', { ref_code: 'VIRAL-REAL1', metadata: { path: '/r/VIRAL-REAL1' } }),
        getLink('a'),
      ],
      shares: [{ platform: 'native', referrer_code: 'VIRAL-REAL1', created_at: '2026-08-16T12:00:00Z' }],
      referrals: [
        {
          referrer_code: 'VIRAL-REAL1',
          referred_code: 'VIRAL-FRIEND1',
          created_at: '2026-08-16T12:30:00Z',
          referred_ip: '8.8.8.8',
          user_agent: 'Mozilla',
        },
      ],
      referrerLinks: [{ referrer_code: 'VIRAL-REAL1', status: 'active', created_at: '2026-08-16T12:30:00Z' }],
      now,
    });
    renderOwnerFunnelDeskView(el, metrics);
    expect(el.querySelectorAll('[data-owner-desk-tiles] article').length).toBe(5);
    expect(el.textContent).toMatch(/Landings/);
    expect(el.textContent).toMatch(/Get-link/);
    expect(el.textContent).toMatch(/Share/);
    expect(el.textContent).toMatch(/Locked/);
    expect(el.textContent).toMatch(/Get-link rate/);
    expect(el.textContent).toMatch(/50\.0%/);
    expect(el.textContent).toMatch(/Landed/);
    expect(el.textContent).toMatch(/Got a link/);
    expect(el.textContent).toMatch(/Shared/);
    expect(el.textContent).toMatch(/VIRAL-REAL1/);
    expect(el.textContent).toMatch(/VIRAL-FRIEND1/);
    expect(el.textContent).toMatch(/friend's \/r\//);
    expect(el.querySelector('[data-owner-desk-tiles]')?.textContent).not.toMatch(/Died waiting|Promoters|Claims|Hero conversion|banner CTR/i);
    expect(el.innerHTML).not.toContain('8.8.8.8');
    expect(el.innerHTML).not.toMatch(/LOCAL/i);
  });

  it('shows can’t load when the server misses', () => {
    const el = document.createElement('div');
    renderOwnerFunnelDeskView(
      el,
      { windowDays: 7, landings: 0, getLink: 0, share: 0, locked: 0, getLinkRate: '0%', feed: [] },
      'Admin session required',
    );
    expect(el.textContent).toMatch(/can.t load/i);
    expect(el.textContent).not.toMatch(/Died waiting|Promoters|Claims/);
  });

  it('takes tile counts from the RPC, not a paged event dump', () => {
    expect(parseOwnerFunnelDeskCounts(null)).toBeNull();
    expect(parseOwnerFunnelDeskCounts({ landings: 1 })).toBeNull();
    const assembled = assembleOwnerFunnelDeskFromServer({
      counts: { landings: 99, get_link: 40, share: 7, locked: 3, window_days: 7 },
      events: [landing('a'), getLink('a')],
      shares: [],
      referrals: [],
      now,
    });
    expect(assembled).not.toBeNull();
    expect(assembled!.landings).toBe(99);
    expect(assembled!.getLink).toBe(40);
    expect(assembled!.share).toBe(7);
    expect(assembled!.locked).toBe(3);
    expect(assembled!.getLinkRate).toBe('40.4%');
    expect(assembleOwnerFunnelDeskFromServer({ counts: null, events: [landing('a')] })).toBeNull();
  });

  it('does not use computeFunnelTotals (claims/landings) as the desk conversion', () => {
    const claimsOverLandings = '20.0%';
    const desk = assembleOwnerFunnelDeskFromServer({
      counts: { landings: 50, get_link: 20, share: 0, locked: 0 },
    });
    expect(desk!.getLinkRate).toBe('40.0%');
    expect(desk!.getLinkRate).not.toBe(claimsOverLandings);
  });
});

