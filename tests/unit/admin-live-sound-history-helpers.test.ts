import { describe, it, expect } from 'vitest';
import {
  appendSoundHistoryEntry,
  buildSoundHistoryEntry,
  buildSoundHistoryHtml,
  formatSoundHistoryTimestamp,
  parseSoundHistoryJson,
} from '../../src/admin/admin-live-sound-history-helpers';

describe('admin-live-sound-history-helpers', () => {
  const ev = {
    id: 'evt-1',
    kind: 'visitor' as const,
    tab: 2,
    icon: 'fa-chart-line',
    label: 'Funnel · GetReferralLink',
    detail: 'reddit',
    funnelStep: 'GetReferralLink',
    at: '2026-07-05T12:00:00Z',
  };

  it('buildSoundHistoryEntry captures profile and time', () => {
    const row = buildSoundHistoryEntry(ev, 'funnel', '2026-07-05T12:01:00.000Z');
    expect(row.profile).toBe('funnel');
    expect(row.playedAt).toBe('2026-07-05T12:01:00.000Z');
    expect(row.funnelStep).toBe('GetReferralLink');
  });

  it('appendSoundHistoryEntry prepends and caps', () => {
    const a = buildSoundHistoryEntry(ev, 'funnel', '2026-07-05T12:00:00Z');
    const b = buildSoundHistoryEntry({ ...ev, id: 'evt-2' }, 'referral', '2026-07-05T12:02:00Z');
    const merged = appendSoundHistoryEntry([a], b, 10);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.id).toBe(b.id);
  });

  it('formatSoundHistoryTimestamp shows Just now for recent', () => {
    const now = Date.parse('2026-07-05T12:00:30Z');
    expect(formatSoundHistoryTimestamp('2026-07-05T12:00:00Z', now, 'en-US')).toBe('Just now');
  });

  it('buildSoundHistoryHtml renders rows', () => {
    const html = buildSoundHistoryHtml([
      buildSoundHistoryEntry(ev, 'funnel', '2026-07-05T12:00:00Z'),
    ]);
    expect(html).toContain('admin-sound-history-row');
    expect(html).toContain('GetReferralLink');
  });

  it('parseSoundHistoryJson tolerates bad input', () => {
    expect(parseSoundHistoryJson(null)).toEqual([]);
    expect(parseSoundHistoryJson('not-json')).toEqual([]);
    const valid = JSON.stringify([
      {
        id: '1',
        playedAt: '2026-07-05T12:00:00Z',
        profile: 'funnel',
        kind: 'visitor',
        label: 'Funnel',
        detail: 'x',
      },
    ]);
    expect(parseSoundHistoryJson(valid)).toHaveLength(1);
  });
});