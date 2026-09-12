import { describe, expect, it } from 'vitest';
import { campaignFromSearch, parseCampaign, teDestination } from '../functions/_lib/campaign';

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
});
