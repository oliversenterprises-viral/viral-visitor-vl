/** Pure helpers for visitor funnel smart indicators and coach copy. */

import type { FunnelStep } from './funnel-conversion';
import { getFunnelCopy } from './funnel-copy';

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

const DEFAULT_GUIDE: Record<FunnelStep, FunnelGuideCopy> = {
  1: {
    message: 'Step 1: tap Get my link. You get a free link in a few seconds. No sign-up.',
    icon: 'up',
  },
  2: {
    message:
      'Step 2: your link is ready. You can copy it if you want — but you still need to send it to friends.',
    icon: 'down',
  },
  3: {
    message:
      'Step 3: share your link. It locks when a friend opens it and taps Get my link. That is how you climb!',
    icon: 'down',
  },
};

export function getFunnelGuideCopy(step: FunnelStep): FunnelGuideCopy {
  const cmsKey =
    step === 1 ? 'funnel_guide_step1' : step === 2 ? 'funnel_guide_step2' : 'funnel_guide_step3';
  const override = getFunnelCopy(cmsKey);
  const base = DEFAULT_GUIDE[step] ?? { message: '', icon: 'down' as const };
  return override ? { ...base, message: override } : base;
}

export function getFunnelShareCompleteCopy(): FunnelGuideCopy {
  return {
    message:
      getFunnelCopy('funnel_guide_complete') ??
      'Nice! Keep sharing. Your link locks when a friend gets their free link through you — then you climb the board.',
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