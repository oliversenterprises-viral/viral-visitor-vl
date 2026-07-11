import { describe, it, expect } from 'vitest';
import {
  buildShareMessage,
  buildPlatformShareUrl,
  buildRedditShareTitle,
  buildQrImageUrl,
  buildEmbedCode,
  buildTrackedShareLink,
  buildMarkdownShareMessage,
  extractReferralCodeFromLink,
  shouldCopyShareMessage,
  isNativeShareSupported,
} from '../../src/lib/share-power';

const LINK = 'https://www.viralrefer.app/r/VIRAL-TEST01';

describe('share-power', () => {
  it('buildShareMessage substitutes {link} from admin template', () => {
    const msg = buildShareMessage(LINK, {
      template: 'Check this out: {link}',
    });
    expect(msg).toBe(`Check this out: ${LINK}`);
  });

  it('buildShareMessage uses platform-optimized defaults', () => {
    const wa = buildShareMessage(LINK, { platform: 'whatsapp' });
    expect(wa).toContain('🏆');
    expect(wa).toMatch(/beat me|leaderboard/i);
    expect(wa).toContain(LINK);

    const reddit = buildShareMessage(LINK, { platform: 'reddit' });
    expect(reddit).not.toContain(LINK);
    expect(reddit).toContain('ViralRefer');
  });

  it('boost message uses challenge status language', () => {
    const boost = buildShareMessage(LINK, { platform: 'boost', trackUtm: false });
    expect(boost).toMatch(/challenge|beat/i);
    expect(boost).toContain(LINK);
  });

  it('buildRedditShareTitle stays short and link-free', () => {
    const title = buildRedditShareTitle(LINK);
    expect(title.length).toBeLessThanOrEqual(280);
    expect(title).not.toContain('http');
  });

  it('buildPlatformShareUrl encodes reddit and bluesky intents', () => {
    const text = buildShareMessage(LINK, { platform: 'bluesky' });
    const bsky = buildPlatformShareUrl('bluesky', LINK, text);
    expect(bsky).toMatch(/^https:\/\/bsky\.app\/intent\/compose/);
    expect(bsky).toContain(encodeURIComponent(LINK));

    const reddit = buildPlatformShareUrl('reddit', LINK, text);
    expect(reddit).toMatch(/^https:\/\/www\.reddit\.com\/submit/);
    expect(reddit).toContain(encodeURIComponent(LINK));
  });

  it('buildPlatformShareUrl covers legacy platforms', () => {
    const text = buildShareMessage(LINK);
    expect(buildPlatformShareUrl('whatsapp', LINK, text)).toContain('wa.me');
    expect(buildPlatformShareUrl('x', LINK, text)).toContain('x.com/intent/tweet');
    expect(buildPlatformShareUrl('native', LINK, text)).toBeNull();
  });

  it('buildQrImageUrl encodes link', () => {
    const url = buildQrImageUrl(LINK, 200);
    expect(url).toContain('qrserver.com');
    expect(url).toContain(encodeURIComponent(LINK));
  });

  it('isNativeShareSupported is boolean', () => {
    expect(typeof isNativeShareSupported()).toBe('boolean');
  });

  it('buildPlatformShareUrl encodes threads and pinterest', () => {
    const text = buildShareMessage(LINK, { platform: 'threads' });
    expect(buildPlatformShareUrl('threads', LINK, text)).toContain('threads.net/intent/post');

    const pin = buildPlatformShareUrl('pinterest', LINK, text);
    expect(pin).toContain('pinterest.com/pin/create');
  });

  it('shouldCopyShareMessage is true for clipboard platforms', () => {
    expect(shouldCopyShareMessage('discord')).toBe(true);
    expect(shouldCopyShareMessage('tiktok')).toBe(true);
    expect(shouldCopyShareMessage('snapchat')).toBe(true);
    expect(shouldCopyShareMessage('whatsapp')).toBe(false);
  });

  it('buildTrackedShareLink appends UTM params per platform', () => {
    const tracked = buildTrackedShareLink(LINK, 'whatsapp');
    expect(tracked).toContain('utm_source=whatsapp');
    expect(tracked).toContain('utm_medium=referral_share');
    expect(tracked).toContain('utm_campaign=viralrefer');
  });

  it('buildShareMessage prefixes referral count when provided', () => {
    const msg = buildShareMessage(LINK, { platform: 'sms', referralCount: 3, trackUtm: false });
    expect(msg).toContain('3 referrals');
    expect(msg).toContain(LINK);
  });

  it('buildShareMessage prefixes leaderboard rank when provided', () => {
    const msg = buildShareMessage(LINK, {
      platform: 'whatsapp',
      leaderboardRank: 2,
      trackUtm: false,
    });
    expect(msg).toContain('#2');
    expect(msg).toContain(LINK);
  });

  it('buildShareMessage includes gap nudge when chasing rank', () => {
    const msg = buildShareMessage(LINK, {
      platform: 'whatsapp',
      leaderboardRank: 3,
      gapToNextRank: 2,
      trackUtm: false,
    });
    expect(msg).toContain('2 more referrals');
    expect(msg).toContain('#3');
  });

  it('buildShareMessage uses abTemplate when no admin template', () => {
    const msg = buildShareMessage(LINK, {
      platform: 'other',
      abTemplate: 'AB test message {link}',
      trackUtm: false,
    });
    expect(msg).toBe(`AB test message ${LINK}`);
  });

  it('buildMarkdownShareMessage produces markdown link', () => {
    const md = buildMarkdownShareMessage(LINK, { referralCount: 0 });
    expect(md).toContain('### Join ViralRefer');
    expect(md).toContain('](http');
    expect(md).toContain('VIRAL-TEST01');
  });

  it('buildShareMessage includes TikTok hashtags', () => {
    const msg = buildShareMessage(LINK, { platform: 'tiktok' });
    expect(msg).toContain('#fyp');
    expect(msg).toContain(LINK);
  });

  it('buildEmbedCode and extractReferralCodeFromLink', () => {
    expect(extractReferralCodeFromLink(LINK)).toBe('VIRAL-TEST01');
    const embed = buildEmbedCode(LINK);
    expect(embed).toContain(LINK);
    expect(embed).toContain('VIRAL-TEST01');
    expect(embed).toContain('<a href=');
  });
});