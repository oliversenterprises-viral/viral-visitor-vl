import { describe, it, expect } from 'vitest';
import {
  broadcastMessageId,
  formatBroadcastBodyHtml,
  isSafeHttpUrl,
  linkifyEscapedText,
  parseOwnerBroadcast,
} from '../../src/lib/owner-broadcast';

describe('owner-broadcast', () => {
  it('returns null when disabled or empty body without sponsor', () => {
    expect(parseOwnerBroadcast(null)).toBeNull();
    expect(parseOwnerBroadcast({})).toBeNull();
    expect(
      parseOwnerBroadcast({
        owner_broadcast_enabled: '1',
        owner_broadcast_body: '   ',
      }),
    ).toBeNull();
    expect(
      parseOwnerBroadcast({
        owner_broadcast_enabled: '0',
        owner_broadcast_body: 'Hello',
      }),
    ).toBeNull();
  });

  it('parses enabled broadcast with title and body', () => {
    const msg = parseOwnerBroadcast({
      owner_broadcast_enabled: 'true',
      owner_broadcast_title: 'Rule update',
      owner_broadcast_body: 'You have about 2 days (48h) for 1 friend to Get my link.',
      owner_broadcast_id: 'rules-v1',
    });
    expect(msg).not.toBeNull();
    expect(msg!.enabled).toBe(true);
    expect(msg!.title).toBe('Rule update');
    expect(msg!.body).toContain('48h');
    expect(msg!.id).toBe('rules-v1');
    expect(msg!.sponsor).toBeNull();
  });

  it('parses sponsor ad when URL is safe http(s)', () => {
    const msg = parseOwnerBroadcast({
      owner_broadcast_enabled: '1',
      owner_broadcast_body: 'Check our partner',
      owner_broadcast_sponsor_label: 'Partner Co',
      owner_broadcast_sponsor_url: 'https://example.com/offer',
      owner_broadcast_sponsor_image: 'https://example.com/ad.png',
      owner_broadcast_sponsor_cta: 'Learn more',
    });
    expect(msg!.sponsor).not.toBeNull();
    expect(msg!.sponsor!.label).toBe('Partner Co');
    expect(msg!.sponsor!.url).toBe('https://example.com/offer');
    expect(msg!.sponsor!.imageUrl).toBe('https://example.com/ad.png');
    expect(msg!.sponsor!.cta).toBe('Learn more');
  });

  it('allows sponsor-only broadcast (no body)', () => {
    const msg = parseOwnerBroadcast({
      owner_broadcast_enabled: '1',
      owner_broadcast_sponsor_url: 'https://sponsor.example/',
      owner_broadcast_sponsor_label: 'Sponsor',
    });
    expect(msg).not.toBeNull();
    expect(msg!.body).toBe('');
    expect(msg!.sponsor!.url).toBe('https://sponsor.example/');
  });

  it('rejects unsafe sponsor URLs', () => {
    const msg = parseOwnerBroadcast({
      owner_broadcast_enabled: '1',
      owner_broadcast_body: 'hi',
      owner_broadcast_sponsor_url: 'javascript:alert(1)',
    });
    expect(msg!.sponsor).toBeNull();
  });

  it('broadcastMessageId uses explicit id or stable hash', () => {
    expect(broadcastMessageId('A', 'B', 'custom')).toBe('custom');
    const a = broadcastMessageId('A', 'B');
    const b = broadcastMessageId('A', 'B');
    expect(a).toBe(b);
    expect(a.startsWith('bc_')).toBe(true);
  });

  it('isSafeHttpUrl only allows http(s)', () => {
    expect(isSafeHttpUrl('https://ok.com')).toBe(true);
    expect(isSafeHttpUrl('http://ok.com')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,x')).toBe(false);
    expect(isSafeHttpUrl('not a url')).toBe(false);
  });

  it('linkifies bare URLs after escape', () => {
    const html = linkifyEscapedText('Visit https://viralrefer.app/tools today');
    expect(html).toContain('href="https://viralrefer.app/tools"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('formatBroadcastBodyHtml supports markdown links and escapes HTML', () => {
    const html = formatBroadcastBodyHtml(
      'Go [here](https://example.com/x) and <script>alert(1)</script>',
    );
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('>here</a>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
