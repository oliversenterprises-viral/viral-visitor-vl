import { describe, it, expect } from 'vitest';
import {
  normalizeOgReferralCode,
  buildReferralOgMeta,
  buildReferralOgHtml,
  buildReferralOgImageUrl,
  buildReferralOgSvg,
  buildReferralCanonicalUrl,
  isSocialCrawler,
} from '../../src/lib/og-meta';

describe('og-meta', () => {
  it('normalizeOgReferralCode validates VIRAL codes', () => {
    expect(normalizeOgReferralCode('VIRAL-TEST01')).toBe('VIRAL-TEST01');
    expect(normalizeOgReferralCode('bad')).toBeNull();
    expect(normalizeOgReferralCode('VIRAL-AB')).toBeNull();
    expect(normalizeOgReferralCode('VIRAL-!@#$')).toBeNull();
  });

  it('buildReferralOgMeta personalizes title and description', () => {
    const meta = buildReferralOgMeta('VIRAL-ABC123');
    expect(meta).not.toBeNull();
    expect(meta!.title).toContain('VIRAL-ABC123');
    expect(meta!.description).toContain('VIRAL-ABC123');
    expect(meta!.canonicalUrl).toBe('https://www.viralrefer.app/r/VIRAL-ABC123');
    expect(meta!.image).toContain('/api/og-image?');
    expect(meta!.image).toContain('code=VIRAL-ABC123');
    expect(meta!.image).toContain('format=png');
  });

  it('buildReferralOgImageUrl points to dynamic API', () => {
    expect(buildReferralOgImageUrl('VIRAL-X')).toContain('/api/og-image?code=VIRAL-X');
  });

  it('buildReferralOgSvg includes QR and code', () => {
    const meta = buildReferralOgMeta('VIRAL-QRTEST')!;
    const svg = buildReferralOgSvg(meta);
    expect(svg).toContain('VIRAL-QRTEST');
    expect(svg).toContain('qrserver.com');
    expect(svg).toContain('<svg');
  });

  it('buildReferralOgImageUrl includes rank and referrals params', () => {
    const url = buildReferralOgImageUrl('VIRAL-RANK1', 'https://www.viralrefer.app', {
      rank: 1,
      referrals: 7,
    });
    expect(url).toContain('rank=1');
    expect(url).toContain('referrals=7');
  });

  it('buildReferralOgImageUrl supports PNG format for crawlers', () => {
    const url = buildReferralOgImageUrl('VIRAL-PNG01', 'https://www.viralrefer.app', {
      format: 'png',
    });
    expect(url).toContain('format=png');
  });

  it('buildReferralOgMeta uses PNG image for social crawlers', () => {
    const meta = buildReferralOgMeta('VIRAL-PNGMETA')!;
    expect(meta.image).toContain('format=png');
  });

  it('buildReferralOgSvg shows rank badge for leaders', () => {
    const meta = buildReferralOgMeta('VIRAL-LEAD01', { rank: 1, referrals: 2 })!;
    const svg = buildReferralOgSvg(meta);
    expect(svg).toContain('#1 ON LEADERBOARD');
    expect(svg).toContain('f59e0b');
  });

  it('buildReferralCanonicalUrl supports subpaths', () => {
    expect(buildReferralCanonicalUrl('VIRAL-X', 'join')).toBe(
      'https://www.viralrefer.app/join/r/VIRAL-X',
    );
  });

  it('buildReferralOgHtml includes og and twitter tags', () => {
    const meta = buildReferralOgMeta('VIRAL-OGTEST')!;
    const html = buildReferralOgHtml(meta);
    expect(html).toContain('og:title');
    expect(html).toContain('twitter:card');
    expect(html).toContain('VIRAL-OGTEST');
    expect(html).not.toContain('<script>');
  });

  it('isSocialCrawler detects major bots', () => {
    expect(isSocialCrawler('Twitterbot/1.0')).toBe(true);
    expect(isSocialCrawler('facebookexternalhit/1.1')).toBe(true);
    expect(isSocialCrawler('Mozilla/5.0 Chrome/120')).toBe(false);
  });
});