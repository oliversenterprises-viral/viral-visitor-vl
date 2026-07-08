import { describe, it, expect } from 'vitest';
import {
  AUTOPILOT_COOLDOWN_MS,
  AUTOPILOT_MIN_GAP,
  AUTOPILOT_MIN_SHARES_PER_VARIANT,
  computeAutopilotConversion,
  evaluateAutopilotAbPromote,
  mergeAutopilotRunFlags,
} from '../../supabase/functions/_shared/optimizer-autopilot';

const sharesForVariant = (variant: 'a' | 'b', n: number, refBase: string) =>
  Array.from({ length: n }, (_, i) => ({
    referrer_code: `VIRAL-${refBase}${i}`,
    ab_variant: variant,
  }));

describe('optimizer-autopilot', () => {
  it('does nothing when auto_pilot is off', () => {
    const result = evaluateAutopilotAbPromote({
      flags: { auto_pilot: false },
      conversion: { rows: [], leaderVariant: 'a', insight: '' },
    });
    expect(result.action).toBe('none');
    expect(result.wouldUpdateFlags).toBe(false);
  });

  it('promotes leader when samples and gap pass', () => {
    const shares = [
      ...sharesForVariant('a', AUTOPILOT_MIN_SHARES_PER_VARIANT, 'A'),
      ...sharesForVariant('b', AUTOPILOT_MIN_SHARES_PER_VARIANT, 'B'),
    ];
    const counts: Record<string, number> = {};
    shares.forEach((s, i) => {
      counts[s.referrer_code!] = i < AUTOPILOT_MIN_SHARES_PER_VARIANT ? 3 : 0;
    });
    const conversion = computeAutopilotConversion(shares, counts);
    const result = evaluateAutopilotAbPromote({
      flags: { auto_pilot: true },
      conversion,
    });
    expect(result.action).toBe('promote_ab');
    expect(result.variant).toBe('a');
    expect(result.wouldUpdateFlags).toBe(true);
    expect(conversion.leaderVariant).toBe('a');
    const gap =
      conversion.rows.find((r) => r.variant === 'a')!.referralsPerShare -
      conversion.rows.find((r) => r.variant === 'b')!.referralsPerShare;
    expect(gap).toBeGreaterThanOrEqual(AUTOPILOT_MIN_GAP);
  });

  it('respects cooldown after last action', () => {
    const now = Date.now();
    const result = evaluateAutopilotAbPromote({
      flags: {
        auto_pilot: true,
        auto_pilot_last_action_at: new Date(now - 1000).toISOString(),
      },
      conversion: { rows: [], leaderVariant: 'b', insight: '' },
      nowMs: now,
    });
    expect(result.reason).toContain('Cooldown');
  });

  it('skips when already promoted', () => {
    const shares = sharesForVariant('a', 6, 'X').concat(sharesForVariant('b', 6, 'Y'));
    const counts: Record<string, number> = {};
    shares.forEach((s) => {
      counts[s.referrer_code!] = s.ab_variant === 'a' ? 2 : 0;
    });
    const conversion = computeAutopilotConversion(shares, counts);
    const result = evaluateAutopilotAbPromote({
      flags: { auto_pilot: true, share_ab_default: 'a' },
      conversion,
    });
    expect(result.action).toBe('none');
    expect(result.reason).toContain('already promoted');
  });

  it('mergeAutopilotRunFlags records run without apply when no action', () => {
    const merged = mergeAutopilotRunFlags(
      { auto_pilot: true },
      { action: 'none', reason: 'waiting', wouldUpdateFlags: false },
      '2026-07-02T12:00:00.000Z',
      false,
    );
    expect(merged.auto_pilot_last_run_at).toBe('2026-07-02T12:00:00.000Z');
    expect(merged.auto_pilot_last_result).toBe('waiting');
    expect(merged.share_ab_default).toBeUndefined();
  });

  it('cooldown constant is 48 hours', () => {
    expect(AUTOPILOT_COOLDOWN_MS).toBe(48 * 60 * 60 * 1000);
  });
});