import { describe, expect, it } from 'vitest';
import {
  buildFunnelTickerHtml,
  formatFunnelTickerLabel,
  isTickerFunnelStep,
  mergeFunnelTickerRows,
  normalizeFunnelTickerRows,
  publicActivityToTickerRows,
  shouldShowFunnelTicker,
} from '../../src/lib/funnel-ticker';

describe('funnel-ticker', () => {
  it('shouldShowFunnelTicker only for VIRAL- codes', () => {
    expect(shouldShowFunnelTicker('VIRAL-ABC123')).toBe(true);
    expect(shouldShowFunnelTicker('viral-xyz')).toBe(true);
    expect(shouldShowFunnelTicker('')).toBe(false);
    expect(shouldShowFunnelTicker(null)).toBe(false);
    expect(shouldShowFunnelTicker('not-a-code')).toBe(false);
  });

  it('isTickerFunnelStep allows important steps only', () => {
    expect(isTickerFunnelStep('GetReferralLink')).toBe(true);
    expect(isTickerFunnelStep('ShareReferral')).toBe(true);
    expect(isTickerFunnelStep('SiteLanding')).toBe(false);
  });

  it('formatFunnelTickerLabel anonymizes funnel steps', () => {
    expect(
      formatFunnelTickerLabel({
        kind: 'funnel',
        step: 'GetReferralLink',
        country_code: 'US',
        created_at: '2026-07-10T12:00:00Z',
      }),
    ).toBe('Someone in US just got their referral link');

    expect(
      formatFunnelTickerLabel({
        kind: 'funnel',
        step: 'CopyReferralLink',
        created_at: '2026-07-10T12:00:00Z',
      }),
    ).toBe('Someone just copied their link');

    expect(
      formatFunnelTickerLabel({
        kind: 'referral',
        referrer_code: 'VIRAL-TEST1',
        created_at: '2026-07-10T12:00:00Z',
      }),
    ).toContain('VIRAL-TEST1');

    expect(
      formatFunnelTickerLabel({
        kind: 'share',
        referrer_code: 'VIRAL-TEST1',
        platform: 'whatsapp',
        created_at: '2026-07-10T12:00:00Z',
      }),
    ).toMatch(/WhatsApp/i);
  });

  it('normalizeFunnelTickerRows drops SiteLanding and bad rows', () => {
    const rows = normalizeFunnelTickerRows([
      { kind: 'funnel', step: 'SiteLanding', created_at: '2026-07-10T12:00:00Z' },
      { kind: 'funnel', step: 'GetReferralLink', country_code: 'BR', created_at: '2026-07-10T12:01:00Z' },
      { kind: 'share', referrer_code: 'VIRAL-A', platform: 'x', created_at: '2026-07-10T12:02:00Z' },
      { kind: 'referral', created_at: '2026-07-10T12:03:00Z' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe('funnel');
    expect(rows[1].kind).toBe('share');
  });

  it('mergeFunnelTickerRows de-dupes and prefers newest', () => {
    const merged = mergeFunnelTickerRows(
      [
        {
          kind: 'funnel',
          step: 'GetReferralLink',
          created_at: '2026-07-10T12:00:00Z',
        },
      ],
      [
        {
          kind: 'funnel',
          step: 'GetReferralLink',
          created_at: '2026-07-10T12:00:30Z',
        },
        {
          kind: 'referral',
          referrer_code: 'VIRAL-X',
          created_at: '2026-07-10T13:00:00Z',
        },
      ],
      10,
    );
    expect(merged[0].kind).toBe('referral');
    // same label same minute → one funnel row
    expect(merged.filter((r) => r.kind === 'funnel')).toHaveLength(1);
  });

  it('buildFunnelTickerHtml duplicates track for seamless marquee', () => {
    const html = buildFunnelTickerHtml([
      {
        kind: 'funnel',
        step: 'ShareReferral',
        country_code: 'DE',
        created_at: '2026-07-10T12:00:00Z',
      },
    ]);
    expect(html).toContain('vr-funnel-ticker-seq');
    expect((html.match(/vr-funnel-ticker-seq/g) || []).length).toBe(2);
    expect(html).toContain('Someone in DE just shared');
  });

  it('publicActivityToTickerRows maps activity kinds', () => {
    const rows = publicActivityToTickerRows([
      { kind: 'referral', referrer_code: 'VIRAL-A', created_at: '2026-07-10T12:00:00Z' },
      {
        kind: 'share',
        referrer_code: 'VIRAL-B',
        platform: 'twitter',
        created_at: '2026-07-10T12:01:00Z',
      },
    ]);
    expect(rows[0].kind).toBe('referral');
    expect(rows[1].kind).toBe('share');
  });
});
