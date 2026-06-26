/**
 * Referred-landing funnel UX — clarity, trust, guided steps, focused first screen.
 * Pure helpers + DOM wiring; does not change referral recording or link generation.
 */

import { getStoredLandingRef, parseRefFromLocation } from './referral-url';

export type FunnelStep = 1 | 2 | 3;

/** Visitor arrived via someone else's /r/CODE or ?ref= link. */
export function isReferredLanding(loc: Location = location): boolean {
  return !!(parseRefFromLocation(loc) || getStoredLandingRef());
}

export function resolveLandingReferrerCode(loc: Location = location): string | null {
  return parseRefFromLocation(loc) || getStoredLandingRef();
}

/** Mark completed steps (1-based) for the guided progress strip. */
export function funnelStepStates(active: FunnelStep): {
  step: FunnelStep;
  done: boolean;
  active: boolean;
  pending: boolean;
}[] {
  return ([1, 2, 3] as const).map((step) => ({
    step,
    done: step < active,
    active: step === active,
    pending: step > active,
  }));
}

function wireExpandToggle(): void {
  const btn = document.getElementById('funnel-expand-btn');
  if (!btn || btn.dataset.vrExpandBound === '1') return;
  btn.dataset.vrExpandBound = '1';
  btn.addEventListener('click', () => {
    document.documentElement.setAttribute('data-vr-funnel-expanded', '1');
    btn.classList.add('hidden');
    const target = document.getElementById('prize') || document.getElementById('leaderboard');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function tuneHeroForReferred(ref: string): void {
  const line1 = document.getElementById('hero-title-line1');
  if (line1) line1.textContent = 'Same contest — get your own link.';

  const subtitle = document.getElementById('hero-subtitle');
  if (subtitle) {
    subtitle.textContent =
      `You helped ${ref} by visiting. Tap the button below, copy your link, and share anywhere to climb the leaderboard.`;
  }

  const badge = document.getElementById('hero-badge');
  if (badge) badge.textContent = 'REFERRED VISITOR • FREE • ~30 SEC';
}

function tuneAttributionBanner(ref: string): void {
  const headline = document.getElementById('referrer-invite-headline');
  if (headline) {
    headline.textContent = 'You helped them land — now compete for #1';
  }

  const hint = document.getElementById('referrer-invite-hint');
  if (hint) {
    hint.textContent = `Get YOUR link in one tap (same contest as ${ref}). No signup.`;
    hint.classList.remove('hidden');
  }

  const inline = document.getElementById('referrer-code-inline');
  if (inline) inline.textContent = ref;
}

/** Call at bootstrap after attribution banner is revealed. */
export function initFunnelConversion(loc: Location = location): void {
  setFunnelStep(1);

  const ref = resolveLandingReferrerCode(loc);
  if (!ref) return;

  document.documentElement.setAttribute('data-vr-referred-landing', '1');
  tuneHeroForReferred(ref);
  tuneAttributionBanner(ref);
  wireExpandToggle();
}

/** Update the 1 → 2 → 3 progress strip in #referral-section. */
export function setFunnelStep(active: FunnelStep): void {
  for (const { step, done, active: isActive, pending } of funnelStepStates(active)) {
    const el = document.querySelector<HTMLElement>(`[data-funnel-step="${step}"]`);
    if (!el) continue;
    el.classList.toggle('funnel-step-done', done);
    el.classList.toggle('funnel-step-active', isActive);
    el.classList.toggle('funnel-step-pending', pending);
    if (isActive) el.setAttribute('aria-current', 'step');
    else el.removeAttribute('aria-current');
  }
}

function highlightPrimaryShare(): void {
  const primary = document.getElementById('share-whatsapp-primary');
  if (!primary) return;
  primary.classList.add('share-primary-pulse');
  window.setTimeout(() => primary.classList.remove('share-primary-pulse'), 3200);
}

/** After #ref-link is populated — guide visitor to COPY. */
export function onReferralLinkReady(): void {
  setFunnelStep(2);
  highlightCopyButton();
}

/** After successful clipboard copy — guide visitor to SHARE. */
export function onReferralLinkCopied(): void {
  setFunnelStep(3);
  highlightPrimaryShare();

  const hint = document.getElementById('referral-next-step');
  if (hint) {
    hint.classList.remove('hidden');
    hint.textContent = 'Step 3: tap WhatsApp (or any share button) to send your link.';
  }
}

function highlightCopyButton(): void {
  const btn = document.getElementById('copy-link-btn');
  if (!btn) return;
  btn.classList.add('copy-link-pulse');
  window.setTimeout(() => btn.classList.remove('copy-link-pulse'), 2800);

  const hint = document.getElementById('referral-next-step');
  if (hint) {
    hint.classList.remove('hidden');
    hint.textContent = 'Step 2: tap COPY — then share your link below.';
  }
}