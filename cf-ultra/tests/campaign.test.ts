import { describe, expect, it } from 'vitest';
import {
  breakoutUrl,
  campaignFromSearch,
  parseCampaign,
  splashDestination,
  teDestination,
  teIframeSnippet,
} from '../functions/_lib/campaign';
import { conversionSplashHtml } from '../functions/_lib/conversion-splash';
import { teSplashHtml } from '../functions/_lib/te-splash';

describe('TE campaign tags', () => {
  it('marks src=te and /te?c= as traffic_exchange', () => {
    expect(parseCampaign({ src: 'te', camp: 'rotator-1' })).toEqual({ src: 'te', camp: 'rotator-1', te: true });
    expect(campaignFromSearch('c=summer&src=hit-exchange').te).toBe(true);
    expect(campaignFromSearch('utm_source=organic').te).toBe(false);
  });

  it('builds a TE destination that keeps src=te', () => {
    const url = teDestination('https://demo.example', { ref: 'VIRAL-ABC2347', camp: 'box' });
    expect(url).toContain('/te?');
    expect(url).toContain('src=te');
    expect(url).toContain('camp=box');
    expect(url).toContain('ref=VIRAL-ABC2347');
  });

  it('iframe snippet and splash keep target=_top plus campaign tags without reading window.top', () => {
    const snip = teIframeSnippet('https://demo.example', { ref: 'VIRAL-ABC2347', camp: 'box', width: 300, height: 250 });
    expect(snip).toContain('iframe');
    expect(snip).toContain('src=te');
    expect(snip).toContain('width="300"');
    const html = teSplashHtml({
      origin: 'https://demo.example',
      url: new URL('https://demo.example/te?src=te&camp=rotator&ref=VIRAL-ABC2347&size=468x60'),
    });
    expect(html).toContain('target="_top"');
    expect(html).toContain('src=te');
    expect(html).toContain('camp=rotator');
    expect(html).toContain('ref=VIRAL-ABC2347');
    expect(html).toContain('>Open<');
    expect(html).not.toContain('window.top');
    expect(html).toContain('sz-468x60');
  });

  it('builds a full splash destination that keeps src, camp, ref, and UTM', () => {
    const url = splashDestination('https://demo.example', {
      ref: 'VIRAL-ABC2347',
      camp: 'demo',
      extra: { utm_source: 'te', utm_campaign: 'week1', size: 'full' },
    });
    expect(url).toContain('/splash?');
    expect(url).toContain('src=te');
    expect(url).toContain('camp=demo');
    expect(url).toContain('ref=VIRAL-ABC2347');
    expect(url).toContain('utm_source=te');
    expect(url).toContain('utm_campaign=week1');
  });

  it('keeps UTM and size on the homepage breakout when cookies are blocked', () => {
    const camp = campaignFromSearch('src=te&camp=rotator&utm_medium=cpc&utm_source=hx&size=468x60');
    const open = breakoutUrl(
      'https://demo.example',
      camp,
      'VIRAL-ABC2347',
      new URLSearchParams('src=te&camp=rotator&utm_medium=cpc&utm_source=hx&size=468x60'),
    );
    expect(open).toContain('src=te');
    expect(open).toContain('camp=rotator');
    expect(open).toContain('ref=VIRAL-ABC2347');
    expect(open).toContain('utm_medium=cpc');
    expect(open).toContain('utm_source=hx');
    expect(open).toContain('size=468x60');
  });

  it('renders a homepage-like conversion splash with tracking beacons and no fake counts', () => {
    const html = conversionSplashHtml({
      origin: 'https://demo.example',
      url: new URL('https://demo.example/splash?src=te&camp=DEMO&ref=VIRAL-ABC2347&utm_source=hx'),
    });
    expect(html).toContain('noindex');
    expect(html).toContain('Win the homepage.');
    expect(html).toContain('Get my link');
    expect(html).toContain('target="_top"');
    expect(html).toContain('src=te');
    expect(html).toContain('camp=demo');
    expect(html).toContain('ref=VIRAL-ABC2347');
    expect(html).toContain('utm_source=hx');
    expect(html).toContain('te_splash_view');
    expect(html).toContain('te_splash_cta');
    expect(html).toContain('/api/track');
    expect(html).toContain('/api/board');
    expect(html).toContain('No cash prize');
    expect(html).toContain('never writes a referral credit');
    expect(html).not.toContain('window.top');
    expect(html).not.toMatch(/\$10,000|4\.9 stars|1,000,000 users/i);
    expect(html).not.toContain('sz-468x60');
  });
});
