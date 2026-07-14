import { describe, it, expect } from 'vitest';
import { summarizeReferrerLinkRows } from '../../src/admin/referrer-link-stats-helpers';

describe('summarizeReferrerLinkRows', () => {
  it('counts pending, active, expired and grace', () => {
    const now = Date.parse('2026-07-13T12:00:00.000Z');
    const s = summarizeReferrerLinkRows(
      [
        { status: 'pending_share', share_grace_count: 0, deadline_at: '2026-07-14T00:00:00.000Z' },
        { status: 'pending_share', share_grace_count: 1, deadline_at: '2026-07-13T18:00:00.000Z' },
        {
          status: 'active',
          first_share_platform: 'first_referral',
          share_grace_count: 0,
        },
        { status: 'expired', share_grace_count: 2 },
      ],
      now,
    );
    expect(s.total).toBe(4);
    expect(s.pending).toBe(2);
    expect(s.active).toBe(1);
    expect(s.expired).toBe(1);
    expect(s.lockedByFirstReferral).toBe(1);
    expect(s.withGrace).toBe(2);
    expect(s.graceExtensionsTotal).toBe(3);
    expect(s.expiringSoon24h).toBe(2);
    expect(s.plainEnglish).toMatch(/waiting/i);
  });

  it('empty list has friendly empty copy', () => {
    const s = summarizeReferrerLinkRows([]);
    expect(s.total).toBe(0);
    expect(s.plainEnglish).toMatch(/No link timers/i);
  });
});
