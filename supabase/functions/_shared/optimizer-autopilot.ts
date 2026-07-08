/**
 * Phase 3a — autopilot: auto-promote A/B winner only (shared edge + client tests).
 */

export type ShareAbVariant = 'a' | 'b';

export interface OptimizerFlagsPayload {
  share_ab_default?: ShareAbVariant | null;
  referred_share_first?: boolean;
  auto_pilot?: boolean;
  auto_pilot_last_run_at?: string | null;
  auto_pilot_last_action_at?: string | null;
  auto_pilot_last_result?: string | null;
  /** Phase 3b growth engine — defaults on when auto_pilot is on. */
  growth_engine?: boolean;
  growth_engine_status?: 'collecting' | 'optimizing' | 'acting' | 'paused' | null;
  growth_engine_k_score?: number | null;
  growth_engine_last_run_at?: string | null;
  growth_engine_last_action?: string | null;
  growth_engine_version?: string | null;
}

export interface ShareRow {
  referrer_code?: string;
  ab_variant?: string;
}

export interface VariantConversionRow {
  variant: ShareAbVariant;
  shareCount: number;
  totalReferrals: number;
  referralsPerShare: number;
}

export interface AutopilotConversionSummary {
  rows: VariantConversionRow[];
  leaderVariant: ShareAbVariant | null;
  insight: string;
}

export interface AutopilotEvaluateInput {
  flags: OptimizerFlagsPayload;
  conversion: AutopilotConversionSummary;
  nowMs?: number;
}

export interface AutopilotEvaluateResult {
  action: 'none' | 'promote_ab';
  reason: string;
  variant?: ShareAbVariant;
  wouldUpdateFlags: boolean;
}

export const AUTOPILOT_MIN_SHARES_PER_VARIANT = 5;
export const AUTOPILOT_MIN_GAP = 0.15;
export const AUTOPILOT_COOLDOWN_MS = 48 * 60 * 60 * 1000;

function isTestShareCode(code: string): boolean {
  const c = (code || '').trim().toUpperCase();
  if (!c || c === 'UNKNOWN') return true;
  if (c === 'VIRAL-READY') return true;
  if (/PROBE|SMOKETEST|DEMOCODE|TESTFIX/.test(c)) return true;
  if (/^DEMO\d+$/.test(c)) return true;
  return false;
}

export function parseOptimizerFlagsPayload(raw: unknown): OptimizerFlagsPayload {
  if (!raw) return {};
  let obj: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  const out: OptimizerFlagsPayload = {};
  if (obj.share_ab_default === 'a' || obj.share_ab_default === 'b') {
    out.share_ab_default = obj.share_ab_default;
  }
  if (obj.referred_share_first === true) out.referred_share_first = true;
  if (obj.referred_share_first === false) out.referred_share_first = false;
  if (obj.auto_pilot === true) out.auto_pilot = true;
  if (obj.auto_pilot === false) out.auto_pilot = false;
  if (typeof obj.auto_pilot_last_run_at === 'string') {
    out.auto_pilot_last_run_at = obj.auto_pilot_last_run_at;
  }
  if (typeof obj.auto_pilot_last_action_at === 'string') {
    out.auto_pilot_last_action_at = obj.auto_pilot_last_action_at;
  }
  if (typeof obj.auto_pilot_last_result === 'string') {
    out.auto_pilot_last_result = obj.auto_pilot_last_result;
  }
  if (obj.growth_engine === true) out.growth_engine = true;
  if (obj.growth_engine === false) out.growth_engine = false;
  if (typeof obj.growth_engine_status === 'string') {
    out.growth_engine_status = obj.growth_engine_status as OptimizerFlagsPayload['growth_engine_status'];
  }
  if (typeof obj.growth_engine_k_score === 'number') {
    out.growth_engine_k_score = obj.growth_engine_k_score;
  }
  if (typeof obj.growth_engine_last_run_at === 'string') {
    out.growth_engine_last_run_at = obj.growth_engine_last_run_at;
  }
  if (typeof obj.growth_engine_last_action === 'string') {
    out.growth_engine_last_action = obj.growth_engine_last_action;
  }
  if (typeof obj.growth_engine_version === 'string') {
    out.growth_engine_version = obj.growth_engine_version;
  }
  return out;
}

export function computeAutopilotConversion(
  shares: readonly ShareRow[],
  referralCounts: Readonly<Record<string, number>>,
): AutopilotConversionSummary {
  const cohorts: Record<ShareAbVariant, { shares: number; codes: Set<string> }> = {
    a: { shares: 0, codes: new Set() },
    b: { shares: 0, codes: new Set() },
  };

  for (const row of shares) {
    const v = String(row.ab_variant || '').toLowerCase();
    if (v !== 'a' && v !== 'b') continue;
    const code = String(row.referrer_code || '').trim().toUpperCase();
    if (!code || isTestShareCode(code)) continue;
    cohorts[v].shares += 1;
    cohorts[v].codes.add(code);
  }

  const rows: VariantConversionRow[] = (['a', 'b'] as const).map((variant) => {
    const { shares: shareCount, codes } = cohorts[variant];
    let totalReferrals = 0;
    codes.forEach((code) => {
      totalReferrals += referralCounts[code] ?? 0;
    });
    const referralsPerShare =
      shareCount > 0 ? Math.round((totalReferrals / shareCount) * 100) / 100 : 0;
    return { variant, shareCount, totalReferrals, referralsPerShare };
  });

  const withShares = rows.filter((r) => r.shareCount > 0);
  let leaderVariant: ShareAbVariant | null = null;
  if (withShares.length >= 2) {
    leaderVariant = [...withShares].sort(
      (a, b) => b.referralsPerShare - a.referralsPerShare,
    )[0]!.variant;
  }

  let insight = 'Insufficient A/B shares for autopilot.';
  if (withShares.length >= 2) {
    const a = rows.find((r) => r.variant === 'a')!;
    const b = rows.find((r) => r.variant === 'b')!;
    insight = `A: ${a.referralsPerShare}/share (${a.shareCount} shares) vs B: ${b.referralsPerShare}/share (${b.shareCount} shares)`;
    if (leaderVariant && a.referralsPerShare !== b.referralsPerShare) {
      insight += ` — leader ${leaderVariant.toUpperCase()}`;
    }
  }

  return { rows, leaderVariant, insight };
}

export function evaluateAutopilotAbPromote(
  input: AutopilotEvaluateInput,
): AutopilotEvaluateResult {
  const now = input.nowMs ?? Date.now();
  const flags = input.flags;
  const { conversion } = input;

  if (flags.auto_pilot !== true) {
    return {
      action: 'none',
      reason: 'Auto-pilot is off (default). Enable in admin when ready.',
      wouldUpdateFlags: false,
    };
  }

  const lastAction = flags.auto_pilot_last_action_at
    ? Date.parse(flags.auto_pilot_last_action_at)
    : NaN;
  if (Number.isFinite(lastAction) && now - lastAction < AUTOPILOT_COOLDOWN_MS) {
    return {
      action: 'none',
      reason: 'Cooldown active — wait 48h between auto actions.',
      wouldUpdateFlags: false,
    };
  }

  const a = conversion.rows.find((r) => r.variant === 'a');
  const b = conversion.rows.find((r) => r.variant === 'b');
  if (!a || !b) {
    return { action: 'none', reason: 'Missing variant cohort.', wouldUpdateFlags: false };
  }

  if (
    a.shareCount < AUTOPILOT_MIN_SHARES_PER_VARIANT ||
    b.shareCount < AUTOPILOT_MIN_SHARES_PER_VARIANT
  ) {
    return {
      action: 'none',
      reason: `Need ≥${AUTOPILOT_MIN_SHARES_PER_VARIANT} shares per variant (A:${a.shareCount}, B:${b.shareCount}).`,
      wouldUpdateFlags: false,
    };
  }

  const leader = conversion.leaderVariant;
  if (!leader) {
    return { action: 'none', reason: 'No clear leader variant.', wouldUpdateFlags: false };
  }

  const loser = leader === 'a' ? b : a;
  const leaderRow = leader === 'a' ? a : b;
  const gap = Math.abs(leaderRow.referralsPerShare - loser.referralsPerShare);
  if (gap < AUTOPILOT_MIN_GAP) {
    return {
      action: 'none',
      reason: `Gap ${gap.toFixed(2)} below minimum ${AUTOPILOT_MIN_GAP} referrals/share.`,
      wouldUpdateFlags: false,
    };
  }

  if (flags.share_ab_default === leader) {
    return {
      action: 'none',
      reason: `Variant ${leader.toUpperCase()} already promoted.`,
      wouldUpdateFlags: false,
    };
  }

  return {
    action: 'promote_ab',
    reason: `Promote ${leader.toUpperCase()}: ${conversion.insight}`,
    variant: leader,
    wouldUpdateFlags: true,
  };
}

export function mergeAutopilotRunFlags(
  flags: OptimizerFlagsPayload,
  result: AutopilotEvaluateResult,
  ranAtIso: string,
  applied: boolean,
): OptimizerFlagsPayload {
  const next: OptimizerFlagsPayload = {
    ...flags,
    auto_pilot_last_run_at: ranAtIso,
    auto_pilot_last_result: result.reason,
  };
  if (applied && result.action === 'promote_ab' && result.variant) {
    next.share_ab_default = result.variant;
    next.auto_pilot_last_action_at = ranAtIso;
  }
  return next;
}