/**
 * Smart funnel indicators — animated step arrows, coach strip, and target highlights.
 */

import type { FunnelStep } from './funnel-conversion';
import {
  funnelArrowState,
  funnelGuideIconClass,
  getFunnelGuideCopy,
  getFunnelShareCompleteCopy,
  resolveFunnelGuideTargetId,
} from './funnel-guide-helpers';

const TARGET_RING_CLASS = 'funnel-guide-target-ring';
let lastTargetId: string | null = null;
let guideBound = false;

function isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el.classList.contains('hidden')) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function attributionBannerVisible(): boolean {
  const banner = document.getElementById('referral-attribution');
  return isElementVisible(banner);
}

function clearTargetRing(): void {
  if (lastTargetId) {
    document.getElementById(lastTargetId)?.classList.remove(TARGET_RING_CLASS);
    lastTargetId = null;
  }
}

function applyTargetRing(targetId: string): void {
  clearTargetRing();
  const el = document.getElementById(targetId);
  if (!el || !isElementVisible(el)) return;
  el.classList.add(TARGET_RING_CLASS);
  lastTargetId = targetId;
}

function updateArrows(active: FunnelStep): void {
  document.querySelectorAll<HTMLElement>('[data-funnel-arrow]').forEach((arrow) => {
    const after = Number(arrow.dataset.funnelArrow) as 1 | 2;
    if (after !== 1 && after !== 2) return;
    const state = funnelArrowState(after, active);
    arrow.classList.toggle('funnel-step-arrow--flow', state === 'flow');
    arrow.classList.toggle('funnel-step-arrow--done', state === 'done');
    arrow.classList.toggle('funnel-step-arrow--idle', state === 'idle');
  });
}

function renderCoach(active: FunnelStep): void {
  const coach = document.getElementById('funnel-guide-coach');
  const textEl = document.getElementById('funnel-guide-coach-text');
  const iconEl = coach?.querySelector('.funnel-guide-coach-icon i');
  if (!coach || !textEl) return;

  const copy = getFunnelGuideCopy(active);
  textEl.textContent = copy.message;
  if (iconEl) {
    iconEl.className = `fa-solid ${funnelGuideIconClass(copy.icon)}`;
  }
  coach.classList.remove('hidden');
  coach.dataset.guideStep = String(active);
}

function hideCoach(): void {
  const coach = document.getElementById('funnel-guide-coach');
  coach?.classList.add('hidden');
}

function scrollTargetIntoViewSoft(targetId: string): void {
  const el = document.getElementById(targetId);
  if (!el || !isElementVisible(el)) return;
  const rect = el.getBoundingClientRect();
  const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
  if (!inView) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/** Sync arrows, coach strip, and target ring for the active funnel step. */
export function syncFunnelGuide(active: FunnelStep): void {
  if (document.documentElement.hasAttribute('data-vr-funnel-complete')) return;

  document.documentElement.setAttribute('data-vr-funnel-guide-step', String(active));
  updateArrows(active);
  renderCoach(active);

  const targetId = resolveFunnelGuideTargetId(active, {
    attributionBannerVisible: attributionBannerVisible(),
  });
  applyTargetRing(targetId);
}

/** Visitor completed a share — celebrate and clear active guidance. */
export function onFunnelShareComplete(): void {
  document.documentElement.setAttribute('data-vr-funnel-complete', '1');
  document.documentElement.removeAttribute('data-vr-funnel-guide-step');
  clearTargetRing();

  document.querySelectorAll<HTMLElement>('[data-funnel-step]').forEach((el) => {
    el.classList.add('funnel-step-done');
    el.classList.remove('funnel-step-active', 'funnel-step-pending');
    el.removeAttribute('aria-current');
  });

  document.querySelectorAll<HTMLElement>('[data-funnel-arrow]').forEach((arrow) => {
    arrow.classList.remove('funnel-step-arrow--flow', 'funnel-step-arrow--idle');
    arrow.classList.add('funnel-step-arrow--done');
  });

  const coach = document.getElementById('funnel-guide-coach');
  const textEl = document.getElementById('funnel-guide-coach-text');
  const iconEl = coach?.querySelector('.funnel-guide-coach-icon i');
  const copy = getFunnelShareCompleteCopy();
  if (textEl) textEl.textContent = copy.message;
  if (iconEl) iconEl.className = `fa-solid ${funnelGuideIconClass(copy.icon)}`;
  coach?.classList.remove('hidden');
  if (coach) coach.dataset.guideStep = 'complete';

  window.setTimeout(() => hideCoach(), 6000);
}

function wireFunnelStepNavigation(): void {
  if (guideBound) return;
  guideBound = true;

  document.querySelectorAll<HTMLElement>('[data-funnel-step]').forEach((chip) => {
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    const go = () => {
      const step = Number(chip.dataset.funnelStep) as FunnelStep;
      const hasLink = document.documentElement.hasAttribute('data-vr-has-link');
      if (step > 1 && !hasLink) return;
      const targetId = resolveFunnelGuideTargetId(step, {
        attributionBannerVisible: attributionBannerVisible(),
      });
      scrollTargetIntoViewSoft(targetId);
    };
    chip.addEventListener('click', go);
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });
}

/** Idempotent bootstrap for funnel guide interactions. */
export function initFunnelGuide(): void {
  wireFunnelStepNavigation();
  const stepAttr = document.documentElement.getAttribute('data-vr-funnel-guide-step');
  if (stepAttr && !document.documentElement.hasAttribute('data-vr-funnel-complete')) {
    syncFunnelGuide(Number(stepAttr) as FunnelStep);
  }
}