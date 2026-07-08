import { describe, it, expect } from 'vitest';
import {
  adminLiveSoundProfileForEvent,
  isImportantFunnelStep,
  shouldPlayAdminLiveSound,
} from '../../src/admin/admin-live-sound-helpers';
import { DEFAULT_ADMIN_LIVE_FILTERS } from '../../src/admin/admin-live-helpers';

describe('admin-live-sound-helpers', () => {
  it('isImportantFunnelStep matches conversion steps only', () => {
    expect(isImportantFunnelStep('GetReferralLink')).toBe(true);
    expect(isImportantFunnelStep('CopyReferralLink')).toBe(true);
    expect(isImportantFunnelStep('ShareReferral')).toBe(true);
    expect(isImportantFunnelStep('OpenPrizeClaim')).toBe(true);
    expect(isImportantFunnelStep('SubmitPrizeClaim')).toBe(true);
    expect(isImportantFunnelStep('SiteLanding')).toBe(false);
    expect(isImportantFunnelStep('landing')).toBe(false);
  });

  it('adminLiveSoundProfileForEvent maps kinds', () => {
    expect(
      adminLiveSoundProfileForEvent({
        id: '1',
        kind: 'referral',
        tab: 0,
        icon: 'fa-user-plus',
        label: 'New referral',
        detail: 'VIRAL-A',
        at: '2026-06-30T12:00:00Z',
      }),
    ).toBe('referral');

    expect(
      adminLiveSoundProfileForEvent({
        id: '2',
        kind: 'visitor',
        tab: 2,
        icon: 'fa-chart-line',
        label: 'Funnel · GetReferralLink',
        detail: 'reddit',
        funnelStep: 'GetReferralLink',
        at: '2026-06-30T12:00:00Z',
      }),
    ).toBe('funnel');

    expect(
      adminLiveSoundProfileForEvent({
        id: '3',
        kind: 'visitor',
        tab: 2,
        icon: 'fa-chart-line',
        label: 'Funnel · SiteLanding',
        detail: 'visitor',
        funnelStep: 'SiteLanding',
        at: '2026-06-30T12:00:00Z',
      }),
    ).toBeNull();
  });

  it('shouldPlayAdminLiveSound respects filters and claim insert-only', () => {
    const funnelEv = {
      id: 'f',
      kind: 'visitor' as const,
      tab: 2,
      icon: 'fa-chart-line',
      label: 'Funnel · GetReferralLink',
      detail: 'x',
      funnelStep: 'GetReferralLink',
      at: '2026-06-30T12:00:00Z',
    };
    expect(shouldPlayAdminLiveSound(funnelEv, DEFAULT_ADMIN_LIVE_FILTERS)).toBe(true);
    expect(
      shouldPlayAdminLiveSound(
        funnelEv,
        { ...DEFAULT_ADMIN_LIVE_FILTERS, visitor: false },
      ),
    ).toBe(false);

    const claimEv = {
      id: 'c',
      kind: 'claim' as const,
      tab: 3,
      icon: 'fa-trophy',
      label: 'Claim approved',
      detail: 'prize',
      at: '2026-06-30T12:00:00Z',
    };
    expect(shouldPlayAdminLiveSound(claimEv, DEFAULT_ADMIN_LIVE_FILTERS, 'INSERT')).toBe(true);
    expect(shouldPlayAdminLiveSound(claimEv, DEFAULT_ADMIN_LIVE_FILTERS, 'UPDATE')).toBe(false);
  });

  it('shouldPlayAdminLiveSound respects traffic segment on funnel events', () => {
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
    const referredOnly = { ...DEFAULT_ADMIN_LIVE_FILTERS, trafficSegment: 'referred' as const };
    const directOnly = { ...DEFAULT_ADMIN_LIVE_FILTERS, trafficSegment: 'direct' as const };
    expect(shouldPlayAdminLiveSound(referred, referredOnly)).toBe(true);
    expect(shouldPlayAdminLiveSound(referred, directOnly)).toBe(false);
    expect(shouldPlayAdminLiveSound(direct, directOnly)).toBe(true);
    expect(shouldPlayAdminLiveSound(direct, referredOnly)).toBe(false);
  });
});