import { describe, expect, it } from 'vitest';
import { campaignFromSearch, parseCampaign, teDestination, teIframeSnippet } from '../functions/_lib/campaign';
import { teSplashHtml } from '../functions/_lib/te-splash';

describe('TE campaign tags', () => {
  it('marks src=te and /te?c= as traffic_exchange', () => {
    expect(parseCampaign({ src: 'te', camp: 'rotator-1' })).toEqual({ src: 'te', camp: 'rotator-1', te: true });
    expect(campaignFromSearch('c=summer&src=hit-exchange').te).toBe(true);
    expect(campaignFromSearch('utm_source=organic').te).toBe(false);
  });

  it('builds a TE destination that keeps src=te', () => {
    const url = teDestination('https://demo.example', { ref: 'VR-ABC234', camp: 'box' });
    expect(url).toContain('/te?');
    expect(url).toContain('src=te');
    expect(url).toContain('camp=box');
    expect(url).toContain('ref=VR-ABC234');
  });

  it('iframe snippet and splash keep target=_top plus campaign tags without reading window.top', () => {
    const snip = teIframeSnippet('https://demo.example', { ref: 'VR-ABC234', camp: 'box', width: 300, height: 250 });
    expect(snip).toContain('iframe');
    expect(snip).toContain('src=te');
    expect(snip).toContain('width="300"');
    const html = teSplashHtml({
      origin: 'https://demo.example',
      url: new URL('https://demo.example/te?src=te&camp=rotator&ref=VR-ABC234&size=468x60'),
    });
    expect(html).toContain('target="_top"');
    expect(html).toContain('src=te');
    expect(html).toContain('camp=rotator');
    expect(html).toContain('ref=VR-ABC234');
    expect(html).toContain('>Open<');
    expect(html).not.toContain('window.top');
    expect(html).toContain('sz-468x60');
  });
});
