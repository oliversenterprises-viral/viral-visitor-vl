import { describe, expect, it } from 'vitest';
import {
  classifyReferralRow,
  FUNNEL_GATE_DEPLOY_ISO,
  isFunnelGatedReferral,
  isTestReferralRow,
  partitionReferrals,
} from '../../scripts/referral-cleanup-helpers.mjs';

describe('referral-cleanup-helpers', () => {
  it('flags owner IP and smoke patterns as test', () => {
    expect(
      isTestReferralRow({
        referrer_code: 'VIRAL-97UWEGZ',
        referred_ip: '161.38.136.60',
        user_agent: 'Mozilla/5.0 Chrome',
      }),
    ).toBe(true);
    expect(
      isTestReferralRow({
        referrer_code: 'VIRAL-SMOKETEST',
        referred_ip: '20.163.32.228',
        user_agent: 'node',
      }),
    ).toBe(true);
  });

  it('keeps post-deploy referrals with nearby GetReferralLink', () => {
    const row = {
      id: 'keep-me',
      referrer_code: 'VIRAL-97UWEGZ',
      referred_ip: '182.62.227.19',
      user_agent: 'Mozilla/5.0',
      created_at: '2026-06-26T22:09:10.312681+00:00',
    };
    const events = [
      {
        event_name: 'GetReferralLink',
        created_at: '2026-06-26T22:09:02.967+00:00',
        metadata: { client_ip: '182.62.227.19' },
      },
    ];
    expect(isFunnelGatedReferral(row, events)).toBe(true);
    expect(classifyReferralRow(row, events).keep).toBe(true);
  });

  it('removes pre-funnel passive landing credits', () => {
    const row = {
      id: 'old',
      referrer_code: 'VIRAL-97UWEGZ',
      referred_ip: '31.94.36.14',
      user_agent: 'Mozilla/5.0 iPhone',
      created_at: '2026-06-26T00:42:24.569681+00:00',
    };
    const verdict = classifyReferralRow(row, []);
    expect(verdict.keep).toBe(false);
    expect(verdict.reason).toBe('pre_funnel_passive_landing');
  });

  it('partitions mixed rows', () => {
    const referrals = [
      {
        id: '1',
        referrer_code: 'VIRAL-SMOKETEST',
        referred_ip: '20.1.1.1',
        user_agent: 'node',
        created_at: '2026-06-26T20:00:00Z',
      },
      {
        id: '2',
        referrer_code: 'VIRAL-97UWEGZ',
        referred_ip: '9.9.9.9',
        user_agent: 'Mozilla/5.0',
        created_at: '2026-06-25T12:00:00Z',
      },
      {
        id: '3',
        referrer_code: 'VIRAL-97UWEGZ',
        referred_ip: '182.62.227.19',
        user_agent: 'Mozilla/5.0',
        created_at: '2026-06-26T22:09:10Z',
      },
    ];
    const events = [
      {
        event_name: 'GetReferralLink',
        created_at: '2026-06-26T22:09:02Z',
        metadata: { client_ip: '182.62.227.19' },
      },
    ];
    const { kept, removed } = partitionReferrals(referrals, events, FUNNEL_GATE_DEPLOY_ISO);
    expect(kept.map((r) => r.id)).toEqual(['3']);
    expect(removed.map((r) => r.id).sort()).toEqual(['1', '2']);
  });
});