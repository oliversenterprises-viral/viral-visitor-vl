/** Pure helpers for visitor funnel smart indicators and coach copy. */

import type { FunnelStep } from './funnel-conversion';
import { getFunnelCopy } from './funnel-copy';
import { t } from './i18n';

export type FunnelArrowState = 'idle' | 'flow' | 'done';

export interface FunnelGuideCopy {
  message: string;
  icon: 'up' | 'down' | 'right' | 'check';
}

export function resolveFunnelGuideTargetId(
  step: FunnelStep,
  opts: { attributionBannerVisible?: boolean } = {},
): string {
  if (step === 1) {
    if (opts.attributionBannerVisible) return 'attribution-get-link-btn';
    return 'hero-get-link-btn';
  }
  if (step === 2) return 'copy-link-btn';
  return 'share-first-strip';
}

const DEFAULT_GUIDE_ICON: Record<FunnelStep, FunnelGuideCopy['icon']> = {
  1: 'up',
  2: 'down',
  3: 'down',
};

function cmsGuideIsSafe(raw: string, step: FunnelStep): boolean {
  const lower = raw.toLowerCase();
  if (/copy\s*→\s*share|hit copy|copy now|every click counts|visits?\s+count/i.test(raw)) {
    return false;
  }
  if (step === 2 && /\bcopy\b/i.test(lower) && !/\bsend\b|\block\b|get my link/i.test(lower)) {
    return false;
  }
  return true;
}

export function getFunnelGuideCopy(step: FunnelStep): FunnelGuideCopy {
  const cmsKey =
    step === 1 ? 'funnel_guide_step1' : step === 2 ? 'funnel_guide_step2' : 'funnel_guide_step3';
  const override = getFunnelCopy(cmsKey);
  const key = step === 1 ? 'funnel.guide_1' : step === 2 ? 'funnel.guide_2' : 'funnel.guide_3';
  const base: FunnelGuideCopy = {
    message: t(key),
    icon: DEFAULT_GUIDE_ICON[step] ?? 'down',
  };
  if (override && cmsGuideIsSafe(override, step)) {
    return { ...base, message: override };
  }
  return base;
}

export function getFunnelShareCompleteCopy(): FunnelGuideCopy {
  return {
    message: getFunnelCopy('funnel_guide_complete') ?? t('funnel.guide_complete'),
    icon: 'check',
  };
}

/** Arrow between step N and N+1 — flows when visitor is on step N, done once N completes. */
export function funnelArrowState(arrowAfterStep: 1 | 2, activeStep: FunnelStep): FunnelArrowState {
  if (arrowAfterStep < activeStep) return 'done';
  if (arrowAfterStep === activeStep) return 'flow';
  return 'idle';
}

export function funnelGuideIconClass(icon: FunnelGuideCopy['icon']): string {
  switch (icon) {
    case 'up':
      return 'fa-arrow-up';
    case 'right':
      return 'fa-arrow-right';
    case 'check':
      return 'fa-circle-check';
    default:
      return 'fa-arrow-down';
  }
}