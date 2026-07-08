import { describe, it, expect, beforeEach } from 'vitest';
import {
  getHeroCtaVariant,
  getOptimizerShareAbDefault,
  initOptimizerFlagsFromContent,
  isFunnelCoachSiteFlagEnabled,
  isGrowthEngineEnabled,
  isReferredShareFirstEnabled,
  parseOptimizerFlagsFromContent,
  setOptimizerFlags,
} from '../../src/lib/optimizer-flags';
import { resolveShareAbVariant } from '../../src/lib/share-ab';

describe('optimizer-flags', () => {
  beforeEach(() => {
    localStorage.clear();
    setOptimizerFlags({});
  });

  it('parses optimizer_flags from site_content', () => {
    const flags = parseOptimizerFlagsFromContent({
      optimizer_flags: { share_ab_default: 'b', referred_share_first: true },
    });
    expect(flags.share_ab_default).toBe('b');
    expect(flags.referred_share_first).toBe(true);
  });

  it('resolveShareAbVariant uses promoted default before code hash', () => {
    initOptimizerFlagsFromContent({
      optimizer_flags: { share_ab_default: 'a' },
    });
    expect(getOptimizerShareAbDefault()).toBe('a');
    expect(resolveShareAbVariant('VIRAL-WOULD-BE-B')).toBe('a');
  });

  it('user override still beats optimizer default', () => {
    initOptimizerFlagsFromContent({
      optimizer_flags: { share_ab_default: 'a' },
    });
    localStorage.setItem('vr_share_ab_variant', 'b');
    expect(resolveShareAbVariant('VIRAL-X')).toBe('b');
  });

  it('tracks share-first flag', () => {
    setOptimizerFlags({ referred_share_first: true });
    expect(isReferredShareFirstEnabled()).toBe(true);
  });

  it('parses and applies hero_cta_variant', () => {
    const flags = parseOptimizerFlagsFromContent({
      optimizer_flags: { hero_cta_variant: 'prize' },
    });
    expect(flags.hero_cta_variant).toBe('prize');
    setOptimizerFlags({ hero_cta_variant: 'prize' });
    expect(getHeroCtaVariant()).toBe('prize');
    expect(document.documentElement.getAttribute('data-vr-hero-cta')).toBe('prize');
  });

  it('parses funnel_coach flag', () => {
    expect(parseOptimizerFlagsFromContent({ optimizer_flags: { funnel_coach: false } }).funnel_coach).toBe(
      false,
    );
    expect(isFunnelCoachSiteFlagEnabled()).toBe(true);
    setOptimizerFlags({ funnel_coach: false });
    expect(isFunnelCoachSiteFlagEnabled()).toBe(false);
    expect(document.documentElement.getAttribute('data-vr-funnel-coach-site')).toBe('off');
  });

  it('parses visitor_slim flag', () => {
    expect(parseOptimizerFlagsFromContent({ optimizer_flags: { visitor_slim: false } }).visitor_slim).toBe(
      false,
    );
    expect(parseOptimizerFlagsFromContent({ optimizer_flags: { visitor_slim: true } }).visitor_slim).toBe(
      true,
    );
  });

  it('parses growth engine fields', () => {
    const flags = parseOptimizerFlagsFromContent({
      optimizer_flags: {
        growth_engine: true,
        growth_engine_version: '3b',
        growth_engine_status: 'optimizing',
        growth_engine_k_score: 0.42,
        growth_engine_last_action: 'enable_share_first',
      },
    });
    expect(flags.growth_engine).toBe(true);
    expect(flags.growth_engine_version).toBe('3b');
    expect(flags.growth_engine_status).toBe('optimizing');
    expect(flags.growth_engine_k_score).toBe(0.42);
    expect(flags.growth_engine_last_action).toBe('enable_share_first');
  });

  it('isGrowthEngineEnabled when auto_pilot or growth_engine on', () => {
    setOptimizerFlags({ growth_engine: true });
    expect(isGrowthEngineEnabled()).toBe(true);
    setOptimizerFlags({ auto_pilot: true, growth_engine: false });
    expect(isGrowthEngineEnabled()).toBe(true);
    setOptimizerFlags({ auto_pilot: false, growth_engine: false });
    expect(isGrowthEngineEnabled()).toBe(false);
  });
});