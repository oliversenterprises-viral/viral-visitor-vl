import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindFunnelTicker,
  buildFunnelTickerHtml,
  ensureFunnelTickerDom,
  formatFunnelTickerLabel,
  FUNNEL_TICKER_FAIL_FAST_MS,
  isTickerFunnelStep,
  mergeFunnelTickerRows,
  normalizeFunnelTickerRows,
  publicActivityToTickerRows,
  shouldShowFunnelTicker,
  withFunnelTickerFailFast,
} from '../../src/lib/funnel-ticker';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

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

  it('homepage ships vr-funnel-ticker markup with LIVE WORLDWIDE', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('id="vr-funnel-ticker"');
    expect(html).toContain('id="vr-funnel-ticker-track"');
    expect(html).toContain('LIVE WORLDWIDE');
    expect(html).toContain('bindFunnelTicker()');
    expect(html).toContain('Your site here');
    const tickerAt = html.indexOf('id="vr-funnel-ticker"');
    const navEnd = html.indexOf('</nav>');
    const shellAt = html.indexOf('class="vr-page-shell');
    expect(tickerAt).toBeGreaterThan(navEnd);
    expect(shellAt).toBeGreaterThan(tickerAt);
  });

  it('bindFunnelTicker binds existing LIVE WORLDWIDE markup and does not duplicate', () => {
    document.body.innerHTML = `
      <nav id="vr-nav"></nav>
      <div id="vr-funnel-ticker" class="vr-funnel-ticker hidden" hidden>
        <div class="vr-funnel-ticker-bar">
          <span class="vr-funnel-ticker-live">LIVE WORLDWIDE</span>
          <div class="vr-funnel-ticker-viewport">
            <div class="vr-funnel-ticker-track" id="vr-funnel-ticker-track"></div>
          </div>
        </div>
      </div>`;
    const el = bindFunnelTicker();
    expect(el?.id).toBe('vr-funnel-ticker');
    expect(el?.textContent).toContain('LIVE WORLDWIDE');
    expect(el?.querySelector('#vr-funnel-ticker-track')).toBeTruthy();
    expect(document.querySelectorAll('#vr-funnel-ticker')).toHaveLength(1);
    expect(ensureFunnelTickerDom()).toBe(el);
    expect(document.querySelectorAll('#vr-funnel-ticker')).toHaveLength(1);
  });

  it('bindFunnelTicker repairs a missing track on the existing root', () => {
    document.body.innerHTML = `<div id="vr-funnel-ticker" class="vr-funnel-ticker hidden"></div>`;
    const el = bindFunnelTicker();
    expect(el?.id).toBe('vr-funnel-ticker');
    expect(el?.querySelector('#vr-funnel-ticker-track')).toBeTruthy();
    expect(el?.textContent).toContain('LIVE WORLDWIDE');
  });

  it('fail-fast is 2 seconds and yields fallback when the promise hangs', async () => {
    expect(FUNNEL_TICKER_FAIL_FAST_MS).toBe(2000);
    vi.useFakeTimers();
    try {
      const hung = new Promise<string>(() => {});
      const pending = withFunnelTickerFailFast(hung, 'fallback');
      await vi.advanceTimersByTimeAsync(1999);
      let settled: string | undefined;
      void pending.then((value) => {
        settled = value;
      });
      await Promise.resolve();
      expect(settled).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toBe('fallback');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fail-fast keeps a fast resolve and does not wait the full 2s', async () => {
    await expect(withFunnelTickerFailFast(Promise.resolve('ok'), 'fallback')).resolves.toBe('ok');
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('vr-has-funnel-ticker');
});
