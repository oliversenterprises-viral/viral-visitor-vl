import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  formatRelayStat,
  statusBadgeClass,
  summarizeRelayHealth,
} from '../../src/admin/relay-admin-helpers';

describe('relay-admin-helpers', () => {
  it('escapes HTML', () => {
    expect(escapeHtml('<script>"x"')).toContain('&lt;');
    expect(escapeHtml('<script>"x"')).toContain('&quot;');
  });

  it('formats stats safely', () => {
    expect(formatRelayStat(12.7)).toBe('12');
    expect(formatRelayStat(undefined)).toBe('0');
    expect(formatRelayStat(-3)).toBe('0');
  });

  it('summarizes health', () => {
    expect(summarizeRelayHealth({}, { enabled: false })).toMatch(/PAUSED/i);
    expect(summarizeRelayHealth({ views_24h: 0, enqueues_24h: 0 }, { enabled: true })).toMatch(
      /Quiet/i,
    );
    expect(summarizeRelayHealth({ views_24h: 4, enqueues_24h: 2 }, { enabled: true })).toMatch(
      /Active/i,
    );
  });

  it('maps status badge classes', () => {
    expect(statusBadgeClass('live')).toMatch(/emerald/);
    expect(statusBadgeClass('queued')).toMatch(/violet/);
    expect(statusBadgeClass('rejected')).toMatch(/rose/);
  });
});
