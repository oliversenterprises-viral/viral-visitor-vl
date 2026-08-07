import { describe, expect, it } from 'vitest';
import {
  acknowledgeNotice,
  buildComplianceBannerHtml,
  getReferrerComplianceNotice,
  isNoticeAcknowledged,
  normalizeNoticeCode,
  noticeAckStorageKey,
} from '../../src/lib/referrer-notices';

describe('referrer-notices', () => {
  it('normalizes codes', () => {
    expect(normalizeNoticeCode(' viral-jl8qr8m ')).toBe('VIRAL-JL8QR8M');
  });

  it('returns notice for VIRAL-JL8QR8M only', () => {
    const n = getReferrerComplianceNotice('VIRAL-JL8QR8M');
    expect(n?.id).toBe('jl8-same-ip-v1');
    expect(n?.body.toLowerCase()).toContain('same ip');
    expect(getReferrerComplianceNotice('VIRAL-OTHER')).toBeNull();
    expect(getReferrerComplianceNotice(null)).toBeNull();
  });

  it('ack storage key is stable', () => {
    expect(noticeAckStorageKey('jl8-same-ip-v1')).toBe('vr_ref_notice_ack_jl8-same-ip-v1');
  });

  it('tracks acknowledge in storage mock', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    expect(isNoticeAcknowledged('jl8-same-ip-v1', storage)).toBe(false);
    acknowledgeNotice('jl8-same-ip-v1', storage);
    expect(isNoticeAcknowledged('jl8-same-ip-v1', storage)).toBe(true);
  });

  it('builds escaped banner html', () => {
    const html = buildComplianceBannerHtml({
      id: 't',
      title: 'Title <script>',
      body: 'Body',
      banner: 'Banner & more',
    });
    expect(html).toContain('Title &lt;script&gt;');
    expect(html).toContain('Banner &amp; more');
    expect(html).not.toContain('<script>');
  });
});
