/**
 * Optimizer-controlled flags — stored in site_content key `optimizer_flags`.
 * Applied on bootstrap; admin can update via Viral Optimizer tab.
 */

import type { ShareAbVariant } from './share-ab';

export type HeroCtaVariant = 'control' | 'prize';

export interface OptimizerFlags {
  /** Promoted share message variant (overrides code-hash split, not user override). */
  share_ab_default?: ShareAbVariant | null;
  /** On referred landings, scroll to share panel after get-link on mobile. */
  referred_share_first?: boolean;
  /** Hero headline/CTA emphasis — prize variant leads with Cash App + homepage win. */
  hero_cta_variant?: HeroCtaVariant | null;
  /** Visitor slim layout — reduces noise per segment (default on). */
  visitor_slim?: boolean;
  /** Floating Viral Coach chat widget (default on). */
  funnel_coach?: boolean;
  /** Phase 3a: auto-promote confirmed A/B winner (default off). */
  auto_pilot?: boolean;
  auto_pilot_last_run_at?: string | null;
  auto_pilot_last_action_at?: string | null;
  auto_pilot_last_result?: string | null;
  /** Cron schedule label (informational, set by migration/admin). */
  autopilot_schedule?: string | null;
  autopilot_via?: string | null;
  /** Phase 3b: closed measure → decide → act loop (share-first auto-fix). */
  growth_engine?: boolean;
  growth_engine_status?: 'collecting' | 'optimizing' | 'acting' | 'paused' | null;
  growth_engine_k_score?: number | null;
  growth_engine_last_run_at?: string | null;
  growth_engine_last_action?: string | null;
  growth_engine_version?: string | null;
}

const SITE_CONTENT_KEY = 'optimizer_flags';

let cached: OptimizerFlags = {};

export function getOptimizerFlags(): OptimizerFlags {
  return { ...cached };
}

export function getOptimizerShareAbDefault(): ShareAbVariant | null {
  const v = cached.share_ab_default;
  return v === 'a' || v === 'b' ? v : null;
}

export function isReferredShareFirstEnabled(): boolean {
  return cached.referred_share_first === true;
}

export function getHeroCtaVariant(): HeroCtaVariant {
  return cached.hero_cta_variant === 'prize' ? 'prize' : 'control';
}

export function isFunnelCoachSiteFlagEnabled(): boolean {
  return cached.funnel_coach !== false;
}

export function parseOptimizerFlagsFromContent(
  content: Record<string, unknown>,
): OptimizerFlags {
  const raw = content[SITE_CONTENT_KEY];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeFlags(raw as Record<string, unknown>);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return normalizeFlags(parsed);
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeFlags(raw: Record<string, unknown>): OptimizerFlags {
  const out: OptimizerFlags = {};
  if (raw.share_ab_default === 'a' || raw.share_ab_default === 'b') {
    out.share_ab_default = raw.share_ab_default;
  }
  if (raw.referred_share_first === true) out.referred_share_first = true;
  if (raw.referred_share_first === false) out.referred_share_first = false;
  if (raw.hero_cta_variant === 'prize' || raw.hero_cta_variant === 'control') {
    out.hero_cta_variant = raw.hero_cta_variant;
  }
  if (raw.visitor_slim === true) out.visitor_slim = true;
  if (raw.visitor_slim === false) out.visitor_slim = false;
  if (raw.funnel_coach === true) out.funnel_coach = true;
  if (raw.funnel_coach === false) out.funnel_coach = false;
  if (raw.auto_pilot === true) out.auto_pilot = true;
  if (raw.auto_pilot === false) out.auto_pilot = false;
  if (typeof raw.auto_pilot_last_run_at === 'string') {
    out.auto_pilot_last_run_at = raw.auto_pilot_last_run_at;
  }
  if (typeof raw.auto_pilot_last_action_at === 'string') {
    out.auto_pilot_last_action_at = raw.auto_pilot_last_action_at;
  }
  if (typeof raw.auto_pilot_last_result === 'string') {
    out.auto_pilot_last_result = raw.auto_pilot_last_result;
  }
  if (typeof raw.autopilot_schedule === 'string') {
    out.autopilot_schedule = raw.autopilot_schedule;
  }
  if (typeof raw.autopilot_via === 'string') {
    out.autopilot_via = raw.autopilot_via;
  }
  if (raw.growth_engine === true) out.growth_engine = true;
  if (raw.growth_engine === false) out.growth_engine = false;
  if (typeof raw.growth_engine_status === 'string') {
    out.growth_engine_status = raw.growth_engine_status as OptimizerFlags['growth_engine_status'];
  }
  if (typeof raw.growth_engine_k_score === 'number') {
    out.growth_engine_k_score = raw.growth_engine_k_score;
  }
  if (typeof raw.growth_engine_last_run_at === 'string') {
    out.growth_engine_last_run_at = raw.growth_engine_last_run_at;
  }
  if (typeof raw.growth_engine_last_action === 'string') {
    out.growth_engine_last_action = raw.growth_engine_last_action;
  }
  if (typeof raw.growth_engine_version === 'string') {
    out.growth_engine_version = raw.growth_engine_version;
  }
  return out;
}

export function isGrowthEngineEnabled(): boolean {
  return cached.growth_engine === true || cached.auto_pilot === true;
}

export function isAutoPilotEnabled(): boolean {
  return cached.auto_pilot === true;
}

export function serializeOptimizerFlags(flags: OptimizerFlags): OptimizerFlags {
  return normalizeFlags(flags as Record<string, unknown>);
}

export function siteContentKeyForOptimizerFlags(): string {
  return SITE_CONTENT_KEY;
}

/** Merge flags and apply to document (idempotent). */
export function setOptimizerFlags(flags: OptimizerFlags): void {
  cached = { ...cached, ...normalizeFlags(flags as Record<string, unknown>) };
  applyOptimizerFlagsToDom();
}

export function initOptimizerFlagsFromContent(content: Record<string, unknown>): void {
  cached = parseOptimizerFlagsFromContent(content);
  applyOptimizerFlagsToDom();
}

export function applyOptimizerFlagsToDom(): void {
  const root = document.documentElement;
  const ab = getOptimizerShareAbDefault();
  if (ab) root.setAttribute('data-vr-ab-default', ab);
  else root.removeAttribute('data-vr-ab-default');

  if (isReferredShareFirstEnabled()) root.setAttribute('data-vr-opt-share-first', '1');
  else root.removeAttribute('data-vr-opt-share-first');

  const heroVariant = getHeroCtaVariant();
  root.setAttribute('data-vr-hero-cta', heroVariant);

  if (isFunnelCoachSiteFlagEnabled()) root.removeAttribute('data-vr-funnel-coach-site');
  else root.setAttribute('data-vr-funnel-coach-site', 'off');

  if (import.meta.env.MODE === 'test') return;

  void import('./funnel-coach-chat').then((m) => m.refreshFunnelCoachVisibility?.());
  void import('./growth-command-center').then((m) => m.syncGrowthCommandCenter?.());
  void import('./hero-cta-variant').then((m) => m.applyHeroCtaVariant?.());
}

/** After get-link on referred mobile, optionally scroll share panel into view. */
export function maybeOptimizerScrollToShare(): void {
  if (!isReferredShareFirstEnabled()) return;
  if (window.innerWidth > 640) return;
  const panel = document.getElementById('share-buttons-panel');
  panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}