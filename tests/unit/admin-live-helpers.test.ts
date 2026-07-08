import { describe, it, expect } from 'vitest';
import {
  parseAdminLiveEvent,
  buildAdminLiveFeedHtml,
  formatAdminLiveTime,
  shouldPulseTabBadge,
  isTextColorsContentKey,
  contentChangeTabIndex,
  adminLiveScopeForTable,
  mergeAdminLiveEvents,
  isNoisyVisitorFunnelStep,
  shouldShowAdminLiveEvent,
  filterAdminLiveFeed,
  DEFAULT_ADMIN_LIVE_FILTERS,
  toggleAdminLiveFilter,
  isAdminLiveReferredEvent,
  passesAdminLiveTrafficSegment,
  setAdminLiveTrafficSegment,
} from '../../src/admin/admin-live-helpers';

describe('admin-live-helpers', () => {
  it('parseAdminLiveEvent maps referral insert', () => {
    const ev = parseAdminLiveEvent('referrals', 'INSERT', {
      id: 'r1',
      referrer_code: 'VIRAL-ABC',
      created_at: '2026-06-30T12:00:00Z',
    });
    expect(ev?.kind).toBe('referral');
    expect(ev?.tab).toBe(0);
    expect(ev?.detail).toBe('VIRAL-ABC');
  });

  it('parseAdminLiveEvent maps share insert', () => {
    const ev = parseAdminLiveEvent('shares', 'INSERT', {
      id: 's1',
      platform: 'twitter',
      referrer_code: 'VIRAL-X',
      created_at: '2026-06-30T12:00:00Z',
    });
    expect(ev?.kind).toBe('share');
    expect(ev?.label).toContain('twitter');
  });

  it('parseAdminLiveEvent maps visitor funnel insert', () => {
    const ev = parseAdminLiveEvent('visitor_events', 'INSERT', {
      id: 1,
      event_name: 'landing',
      utm_source: 'reddit',
      created_at: '2026-06-30T12:00:00Z',
    });
    expect(ev?.kind).toBe('visitor');
    expect(ev?.label).toContain('landing');
    expect(ev?.detail).toContain('direct');
    expect(ev?.detail).toContain('reddit');
  });

  it('parseAdminLiveEvent maps referred visitor with ref_code', () => {
    const ev = parseAdminLiveEvent('visitor_events', 'INSERT', {
      id: 2,
      event_name: 'GetReferralLink',
      ref_code: 'VIRAL-ABC',
      created_at: '2026-06-30T12:00:00Z',
    });
    expect(ev?.refCode).toBe('VIRAL-ABC');
    expect(ev?.detail).toContain('ref:VIRAL-ABC');
    expect(isAdminLiveReferredEvent(ev!)).toBe(true);
  });

  it('buildAdminLiveFeedHtml marks first chip fresh', () => {
    const html = buildAdminLiveFeedHtml([
      {
        id: '1',
        kind: 'referral',
        tab: 0,
        icon: 'fa-user-plus',
        label: 'New referral',
        detail: 'VIRAL-A',
        at: new Date().toISOString(),
      },
    ]);
    expect(html).toContain('admin-live-chip--fresh');
    expect(html).toContain('VIRAL-A');
  });

  it('formatAdminLiveTime shows now for recent events', () => {
    const now = Date.now();
    expect(formatAdminLiveTime(new Date(now - 3000).toISOString(), now)).toBe('now');
  });

  it('shouldPulseTabBadge only when inactive tab has count', () => {
    expect(shouldPulseTabBadge(1, 0, 2)).toBe(true);
    expect(shouldPulseTabBadge(0, 0, 2)).toBe(false);
    expect(shouldPulseTabBadge(1, 0, 0)).toBe(false);
  });

  it('contentChangeTabIndex routes color keys to tab 4', () => {
    expect(isTextColorsContentKey('hero_title_color')).toBe(true);
    expect(contentChangeTabIndex('hero_title_color')).toBe(4);
    expect(contentChangeTabIndex('banners')).toBe(2);
  });

  it('adminLiveScopeForTable maps known tables', () => {
    expect(adminLiveScopeForTable('referrals')).toBe('referral');
    expect(adminLiveScopeForTable('visitor_events')).toBe('visitor');
    expect(adminLiveScopeForTable('unknown')).toBeNull();
  });

  it('mergeAdminLiveEvents sorts newest first and dedupes', () => {
    const merged = mergeAdminLiveEvents([
      [
        {
          id: 'a',
          kind: 'referral',
          tab: 0,
          icon: 'fa-user-plus',
          label: 'Old',
          detail: 'x',
          at: '2026-06-30T10:00:00Z',
        },
      ],
      [
        {
          id: 'b',
          kind: 'share',
          tab: 1,
          icon: 'fa-share-nodes',
          label: 'New',
          detail: 'y',
          at: '2026-06-30T12:00:00Z',
        },
        {
          id: 'a',
          kind: 'referral',
          tab: 0,
          icon: 'fa-user-plus',
          label: 'Dup',
          detail: 'z',
          at: '2026-06-30T11:00:00Z',
        },
      ],
    ]);
    expect(merged.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('isNoisyVisitorFunnelStep detects SiteLanding', () => {
    expect(isNoisyVisitorFunnelStep('SiteLanding')).toBe(true);
    expect(isNoisyVisitorFunnelStep('GetReferralLink')).toBe(false);
    expect(isNoisyVisitorFunnelStep('SprintBoardView')).toBe(true);
    expect(isNoisyVisitorFunnelStep('ChallengeDuelShared')).toBe(false);
  });

  it('parseAdminLiveEvent labels viral loop steps as Loop', () => {
    const ev = parseAdminLiveEvent('visitor_events', 'INSERT', {
      id: 3,
      event_name: 'ChallengeDuelShared',
      created_at: '2026-06-30T12:00:00Z',
    });
    expect(ev?.label).toContain('Loop');
    expect(ev?.label).toContain('ChallengeDuelShared');
  });

  it('shouldShowAdminLiveEvent hides landings by default', () => {
    const ev = {
      id: '1',
      kind: 'visitor' as const,
      tab: 2,
      icon: 'fa-chart-line',
      label: 'Funnel · SiteLanding',
      detail: 'visitor',
      funnelStep: 'SiteLanding',
      at: '2026-06-30T12:00:00Z',
    };
    expect(shouldShowAdminLiveEvent(ev, DEFAULT_ADMIN_LIVE_FILTERS)).toBe(false);
    expect(
      shouldShowAdminLiveEvent(ev, { ...DEFAULT_ADMIN_LIVE_FILTERS, showLandings: true }),
    ).toBe(true);
  });

  it('passesAdminLiveTrafficSegment filters funnel by ref code', () => {
    const referred = {
      id: 'r',
      kind: 'visitor' as const,
      tab: 2,
      icon: 'fa-chart-line',
      label: 'Funnel · GetReferralLink',
      detail: 'ref:VIRAL-A',
      funnelStep: 'GetReferralLink',
      refCode: 'VIRAL-A',
      at: '2026-06-30T12:00:00Z',
    };
    const direct = {
      id: 'd',
      kind: 'visitor' as const,
      tab: 2,
      icon: 'fa-chart-line',
      label: 'Funnel · GetReferralLink',
      detail: 'direct',
      funnelStep: 'GetReferralLink',
      at: '2026-06-30T11:00:00Z',
    };
    expect(passesAdminLiveTrafficSegment(referred, 'all')).toBe(true);
    expect(passesAdminLiveTrafficSegment(referred, 'referred')).toBe(true);
    expect(passesAdminLiveTrafficSegment(referred, 'direct')).toBe(false);
    expect(passesAdminLiveTrafficSegment(direct, 'direct')).toBe(true);
    expect(passesAdminLiveTrafficSegment(direct, 'referred')).toBe(false);
  });

  it('shouldShowAdminLiveEvent hides referrals in direct-only segment', () => {
    const signup = {
      id: 'ref',
      kind: 'referral' as const,
      tab: 0,
      icon: 'fa-user-plus',
      label: 'New referral',
      detail: 'VIRAL-A',
      at: '2026-06-30T12:00:00Z',
    };
    const directFilters = setAdminLiveTrafficSegment(DEFAULT_ADMIN_LIVE_FILTERS, 'direct');
    expect(shouldShowAdminLiveEvent(signup, DEFAULT_ADMIN_LIVE_FILTERS)).toBe(true);
    expect(shouldShowAdminLiveEvent(signup, directFilters)).toBe(false);
  });

  it('filterAdminLiveFeed respects kind toggles', () => {
    const rows = [
      {
        id: 'a',
        kind: 'referral' as const,
        tab: 0,
        icon: 'fa-user-plus',
        label: 'New referral',
        detail: 'X',
        at: '2026-06-30T12:00:00Z',
      },
      {
        id: 'b',
        kind: 'share' as const,
        tab: 1,
        icon: 'fa-share-nodes',
        label: 'Share',
        detail: 'Y',
        at: '2026-06-30T11:00:00Z',
      },
    ];
    const filtered = filterAdminLiveFeed(
      rows,
      toggleAdminLiveFilter(DEFAULT_ADMIN_LIVE_FILTERS, 'share'),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.kind).toBe('referral');
  });
});