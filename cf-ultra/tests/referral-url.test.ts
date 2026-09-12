import { describe, expect, it } from 'vitest';
import { isSocialCrawler } from '../functions/_lib/crawler';
import {
  buildAffiliateStyleLink,
  buildCleanReferralLink,
  buildRefQueryLink,
  parseRefFromLocation,
  parseRefFromPathname,
} from '../functions/_lib/referral-url';
import { crawlerOgHtml, ogImageSvg } from '../functions/_lib/og';

describe('live referral identity', () => {
  it('parses /r/CODE, /a/CODE, and ?ref= as the same VIRAL- code', () => {
    expect(parseRefFromLocation({ pathname: '/r/VIRAL-JL8QR8M', search: '' })).toBe('VIRAL-JL8QR8M');
    expect(parseRefFromLocation({ pathname: '/a/viral-jl8qr8m/', search: '' })).toBe('VIRAL-JL8QR8M');
    expect(parseRefFromLocation({ pathname: '/', search: '?ref=VIRAL-JL8QR8M' })).toBe('VIRAL-JL8QR8M');
    expect(parseRefFromLocation({ pathname: '/r/VIRAL-PATH', search: '?ref=VIRAL-QUERY' })).toBe('VIRAL-QUERY');
    expect(parseRefFromPathname('/te')).toBeNull();
    expect(parseRefFromPathname('/admin/')).toBeNull();
  });

  it('builds the live /r/ share link and keeps /a/ + ?ref= as aliases', () => {
    expect(buildCleanReferralLink('viral-jl8qr8m', 'https://demo.example')).toBe(
      'https://demo.example/r/VIRAL-JL8QR8M',
    );
    expect(buildAffiliateStyleLink('VIRAL-JL8QR8M', 'https://demo.example')).toBe(
      'https://demo.example/a/VIRAL-JL8QR8M',
    );
    expect(buildRefQueryLink('VIRAL-JL8QR8M', 'https://demo.example')).toBe(
      'https://demo.example/?ref=VIRAL-JL8QR8M',
    );
  });

  it('rejects alien VR-style leftovers from path parse unless they match the engine', () => {
    expect(parseRefFromPathname('/r/VR-ABC234')).toBe('VR-ABC234');
    expect(parseRefFromPathname('/r/NOPE')).toBeNull();
    expect(parseRefFromPathname('/r/ULTRA-XXXX')).toBeNull();
  });
});

describe('referral OG', () => {
  it('puts the VIRAL- code on the card and crawler HTML', () => {
    const svg = ogImageSvg({
      code: 'VIRAL-JL8QR8M',
      host: 'example.com',
      rung: 'rising',
      credits: 1,
      weekly: 1,
      demoMode: false,
      origin: 'https://demo.example',
    });
    expect(svg).toContain('VIRAL-JL8QR8M');
    expect(svg).toContain('Join via VIRAL-JL8QR8M');
    expect(svg).not.toContain('DEMO MODE');

    const page = crawlerOgHtml({
      origin: 'https://demo.example',
      code: 'VIRAL-JL8QR8M',
      canonicalUrl: 'https://demo.example/r/VIRAL-JL8QR8M',
      ogUrl: 'https://demo.example/a/VIRAL-JL8QR8M',
      host: 'example.com',
      label: 'example.com',
      credits: 1,
      weekly: 1,
      demoMode: false,
    });
    expect(page).toContain('referrer-code');
    expect(page).toContain('VIRAL-JL8QR8M');
    expect(page).toContain('/r/VIRAL-JL8QR8M');
    expect(page).toContain('Get my link');
  });

  it('detects social crawlers the same way live does', () => {
    expect(isSocialCrawler('Twitterbot/1.0')).toBe(true);
    expect(isSocialCrawler('facebookexternalhit/1.1')).toBe(true);
    expect(isSocialCrawler('Mozilla/5.0 (iPhone) Safari')).toBe(false);
  });
});
