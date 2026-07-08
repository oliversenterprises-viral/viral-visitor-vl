import { describe, it, expect } from 'vitest';
import {
  appendCompliance,
  buildOwnerAdUrl,
  buildEmbedAdUrl,
  buildUtmUrl,
  buildWeekQueue,
  buildXSafeTweet,
  truncateForX,
  COMPLIANCE_FOOTER,
  PAGERANKCAFE_LISTING,
  TRAFFICADBAR_LISTING,
  SHARE_PATH,
} from '../../scripts/growth-post-queue-helpers.mjs';

describe('growth-post-queue-helpers', () => {
  const stats = {
    landings7d: 340,
    getLink7d: 4,
    getLinkRatePct: 1,
    totalReferrals: 6,
    uniqueReferrers: 1,
    leaderCode: 'VIRAL-97UWEGZ',
    leaderCount: 6,
    shareUrl: 'https://www.viralrefer.app/r/VIRAL-97UWEGZ',
  };

  it('buildUtmUrl tracks campaign params on /r path', () => {
    const url = buildUtmUrl({
      source: 'x',
      campaign: 'referral-automation',
      content: 'hook',
      path: SHARE_PATH,
    });
    expect(url).toContain('/r/VIRAL-97UWEGZ');
    expect(url).toContain('utm_source=x');
    expect(url).toContain('utm_campaign=referral-automation');
  });

  it('appendCompliance adds footer when missing', () => {
    const out = appendCompliance('Hello world');
    expect(out).toContain(COMPLIANCE_FOOTER);
  });

  it('truncateForX respects 280 chars', () => {
    const long = 'a'.repeat(300);
    expect(truncateForX(long).length).toBeLessThanOrEqual(280);
  });

  it('buildWeekQueue creates 7 items with manual reddit/linkedin', () => {
    const q = buildWeekQueue(stats);
    expect(q.items).toHaveLength(7);
    expect(q.items.filter((i) => i.platform === 'reddit' && i.mode === 'manual').length).toBe(1);
    expect(q.items.filter((i) => i.platform === 'telegram' && i.mode === 'api').length).toBe(1);
    expect(q.items.every((i) => i.copy?.text?.length > 0)).toBe(true);
  });

  it('buildXSafeTweet has no URLs (X domain block)', () => {
    const tweet = buildXSafeTweet('Free contest — climb the board.');
    expect(tweet).not.toMatch(/viralrefer\.app|https?:\/\//i);
    expect(tweet).toContain('QR');
  });

  it('buildWeekQueue X items use no-url policy', () => {
    const q = buildWeekQueue(stats);
    const xItems = q.items.filter((i) => i.platform === 'x');
    expect(xItems.every((i) => i.xLinkPolicy === 'no-url')).toBe(true);
    expect(xItems.every((i) => !/viralrefer\.app|https?:\/\//i.test(i.copy?.text || ''))).toBe(true);
  });

  it('buildOwnerAdUrl uses homepage not /r path', () => {
    const url = buildOwnerAdUrl({ source: 'telegram', content: 'channel-broadcast' });
    expect(url).toBe(
      'https://www.viralrefer.app/?utm_source=telegram&utm_medium=social&utm_campaign=referral-automation&utm_content=channel-broadcast',
    );
    expect(url).not.toContain('/r/');
  });

  it('buildWeekQueue telegram uses owner ad URL (direct landing)', () => {
    const q = buildWeekQueue(stats);
    const tg = q.items.find((i) => i.platform === 'telegram');
    expect(tg?.url).not.toContain('/r/');
    expect(tg?.url).toContain('utm_source=telegram');
    expect(tg?.copy?.text).not.toContain('/r/VIRAL');
  });

  it('PAGERANKCAFE_LISTING uses traffic_exchange UTMs on homepage', () => {
    expect(PAGERANKCAFE_LISTING.url).toContain('utm_source=pagerankcafe');
    expect(PAGERANKCAFE_LISTING.url).toContain('utm_medium=traffic_exchange');
    expect(PAGERANKCAFE_LISTING.url).not.toContain('/r/');
  });

  it('buildEmbedAdUrl uses /embed path for iframe traffic exchanges', () => {
    const url = buildEmbedAdUrl({ source: 'pagerankcafe' });
    expect(url).toBe(
      'https://www.viralrefer.app/embed?utm_source=pagerankcafe&utm_medium=traffic_exchange&utm_campaign=embed&utm_content=iframe',
    );
  });

  it('TRAFFICADBAR_LISTING uses traffic_exchange UTMs on homepage', () => {
    expect(TRAFFICADBAR_LISTING.url).toBe(
      'https://www.viralrefer.app/?utm_source=trafficadbar&utm_medium=traffic_exchange&utm_campaign=link_post&utm_content=feed',
    );
    expect(TRAFFICADBAR_LISTING.url).not.toContain('/r/');
  });
});