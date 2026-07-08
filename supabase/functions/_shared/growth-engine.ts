/**
 * Phase 3b — Self-optimizing growth engine (measure → decide → act).
 * Shared between optimizer-cron edge and unit tests.
 */

import type { OptimizerFlagsPayload } from './optimizer-autopilot.ts';
import {
  AUTOPILOT_COOLDOWN_MS,
  evaluateAutopilotAbPromote,
  type AutopilotConversionSummary,
  type AutopilotEvaluateResult,
} from './optimizer-autopilot.ts';
import { isTestVisitorFunnelEvent } from './visitor-funnel-test.ts';

export type GrowthEngineAction = 'none' | 'promote_ab' | 'enable_share_first';

export interface GrowthHealthMetrics {
  landings: number;
  getLink: number;
  shares: number;
  referredLandings: number;
  referredGetLink: number;
  getLinkRate: number;
  referredGetLinkRate: number;
  shareAfterGetLinkRate: number;
  kScore: number;
  referralsPerShare: number | null;
}

export interface GrowthEngineDecision {
  action: GrowthEngineAction;
  reason: string;
  variant?: 'a' | 'b';
  wouldUpdateFlags: boolean;
  phase: '3a' | '3b';
}

export interface GrowthEngineCycleResult {
  health: GrowthHealthMetrics;
  abDecision: AutopilotEvaluateResult;
  finalDecision: GrowthEngineDecision;
  engineStatus: 'collecting' | 'optimizing' | 'acting' | 'paused';
}

export const GROWTH_MIN_GET_LINK = 10;
export const GROWTH_SHARE_LEAK_THRESHOLD = 0.4;
export const GROWTH_REFERRED_GET_LINK_MIN = 15;

function eventName(e: Record<string, unknown>): string {
  return String(e.event_name || e.eventName || '');
}

function isReferredEvent(e: Record<string, unknown>): boolean {
  if (e.is_referred === true) return true;
  const ref = String(e.ref_code || e.refCode || '').trim();
  return ref.length > 0;
}

function uniqueVisitorsFor(
  events: readonly Record<string, unknown>[],
  name: string,
  referredOnly?: boolean,
): number {
  const ids = new Set<string>();
  for (const e of events) {
    if (eventName(e) !== name) continue;
    if (referredOnly !== undefined && isReferredEvent(e) !== referredOnly) continue;
    const id = String(e.visitor_id || e.visitorId || e.session_id || '').trim();
    if (!id) continue;
    ids.add(id);
  }
  return ids.size;
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export function filterGrowthVisitorEvents(
  raw: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  const clean = raw.filter((e) => !isTestVisitorFunnelEvent(e));
  return clean;
}

export function computeGrowthHealth(
  rawVisitorEvents: readonly Record<string, unknown>[],
  shareCount: number,
  totalReferralsFromShares: number,
): GrowthHealthMetrics {
  const events = filterGrowthVisitorEvents(rawVisitorEvents);

  const landings = uniqueVisitorsFor(events, 'SiteLanding');
  const getLink = uniqueVisitorsFor(events, 'GetReferralLink');
  const shareVisitors = uniqueVisitorsFor(events, 'ShareReferral');
  const referredLandings = uniqueVisitorsFor(events, 'SiteLanding', true);
  const referredGetLink = uniqueVisitorsFor(events, 'GetReferralLink', true);

  const referralsPerShare = shareCount > 0 ? totalReferralsFromShares / shareCount : null;
  const getLinkRate = rate(getLink, landings);
  const referredGetLinkRate = rate(referredGetLink, referredLandings);
  const shareAfterGetLinkRate = rate(shareVisitors, getLink);
  const kScore = referredGetLinkRate * shareAfterGetLinkRate * (referralsPerShare ?? 0);

  return {
    landings,
    getLink,
    shares: shareVisitors,
    referredLandings,
    referredGetLink,
    getLinkRate,
    referredGetLinkRate,
    shareAfterGetLinkRate,
    kScore,
    referralsPerShare,
  };
}

function inCooldown(flags: OptimizerFlagsPayload, nowMs: number): boolean {
  const lastAction = flags.auto_pilot_last_action_at
    ? Date.parse(flags.auto_pilot_last_action_at)
    : NaN;
  return Number.isFinite(lastAction) && nowMs - lastAction < AUTOPILOT_COOLDOWN_MS;
}

export function evaluateGrowthShareFirst(input: {
  flags: OptimizerFlagsPayload;
  health: GrowthHealthMetrics;
  nowMs?: number;
}): GrowthEngineDecision {
  const now = input.nowMs ?? Date.now();
  const flags = input.flags;
  const { health } = input;

  if (flags.auto_pilot !== true && flags.growth_engine !== true) {
    return {
      action: 'none',
      reason: 'Growth engine paused — enable auto-pilot in admin.',
      wouldUpdateFlags: false,
      phase: '3b',
    };
  }

  if (flags.referred_share_first === true) {
    return {
      action: 'none',
      reason: 'Share-first already enabled for referred mobile.',
      wouldUpdateFlags: false,
      phase: '3b',
    };
  }

  if (inCooldown(flags, now)) {
    return {
      action: 'none',
      reason: 'Cooldown active — wait 48h between auto actions.',
      wouldUpdateFlags: false,
      phase: '3b',
    };
  }

  if (health.getLink < GROWTH_MIN_GET_LINK) {
    return {
      action: 'none',
      reason: `Collecting funnel data — need ≥${GROWTH_MIN_GET_LINK} unique get-link events (${health.getLink} so far).`,
      wouldUpdateFlags: false,
      phase: '3b',
    };
  }

  if (health.shareAfterGetLinkRate >= GROWTH_SHARE_LEAK_THRESHOLD) {
    return {
      action: 'none',
      reason: `Share conversion healthy (${(health.shareAfterGetLinkRate * 100).toFixed(0)}% get-link → share).`,
      wouldUpdateFlags: false,
      phase: '3b',
    };
  }

  return {
    action: 'enable_share_first',
    reason: `Share leak detected: ${(health.shareAfterGetLinkRate * 100).toFixed(0)}% who get a link also share — enabling share-first on referred mobile.`,
    wouldUpdateFlags: true,
    phase: '3b',
  };
}

export function resolveGrowthEngineCycle(input: {
  flags: OptimizerFlagsPayload;
  conversion: AutopilotConversionSummary;
  health: GrowthHealthMetrics;
  nowMs?: number;
}): GrowthEngineCycleResult {
  const abDecision = evaluateAutopilotAbPromote({
    flags: input.flags,
    conversion: input.conversion,
    nowMs: input.nowMs,
  });

  if (abDecision.wouldUpdateFlags && abDecision.action === 'promote_ab') {
    return {
      health: input.health,
      abDecision,
      finalDecision: {
        action: 'promote_ab',
        reason: abDecision.reason,
        variant: abDecision.variant,
        wouldUpdateFlags: true,
        phase: '3a',
      },
      engineStatus: 'acting',
    };
  }

  const shareDecision = evaluateGrowthShareFirst({
    flags: input.flags,
    health: input.health,
    nowMs: input.nowMs,
  });

  const collecting =
    input.health.landings < 8 ||
    (input.health.getLink < GROWTH_MIN_GET_LINK && shareDecision.action === 'none');

  return {
    health: input.health,
    abDecision,
    finalDecision: shareDecision,
    engineStatus: shareDecision.wouldUpdateFlags
      ? 'acting'
      : collecting
        ? 'collecting'
        : 'optimizing',
  };
}

export function mergeGrowthEngineRunFlags(
  flags: OptimizerFlagsPayload,
  cycle: GrowthEngineCycleResult,
  ranAtIso: string,
  applied: boolean,
): OptimizerFlagsPayload {
  const { finalDecision, health, engineStatus } = cycle;
  const next: OptimizerFlagsPayload = {
    ...flags,
    growth_engine: flags.growth_engine !== false,
    auto_pilot_last_run_at: ranAtIso,
    auto_pilot_last_result: finalDecision.reason,
    growth_engine_k_score: Math.round(health.kScore * 1000) / 1000,
    growth_engine_status: engineStatus,
    growth_engine_last_run_at: ranAtIso,
  };

  if (applied && finalDecision.wouldUpdateFlags) {
    next.auto_pilot_last_action_at = ranAtIso;
    next.growth_engine_last_action = finalDecision.action;

    if (finalDecision.action === 'promote_ab' && finalDecision.variant) {
      next.share_ab_default = finalDecision.variant;
    }
    if (finalDecision.action === 'enable_share_first') {
      next.referred_share_first = true;
    }
  }

  return next;
}