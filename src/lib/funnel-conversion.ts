/**
 * Referred-landing funnel UX — clarity, trust, guided steps, funnel-gated crediting UI.
 */

import { getStoredLandingRef, parseRefFromLocation } from './referral-url';
import { initFunnelCoachChat } from './funnel-coach-chat';
import { initFunnelGuide, syncFunnelGuide } from './funnel-guide';

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
  if (line1) line1.textContent = 'One tap credits your visit.';

  const subtitle = document.getElementById('hero-subtitle');
  if (subtitle) {
    subtitle.textContent =
      `You landed via ${ref} — that alone does not count. Tap Get my link (Step 1), then copy and share to join the same contest.`;
  }

  const badge = document.getElementById('hero-badge');
  if (badge) badge.textContent = 'REFERRED VISITOR • STEP 1 REQUIRED';

  const trust = document.getElementById('hero-trust-line');
  if (trust) {
    trust.innerHTML =
      '<strong class="text-amber-300">Visiting alone does not credit them.</strong> Tap the button below to count as a real referral.';
  }
}

function tuneAttributionBanner(ref: string): void {
  const headline = document.getElementById('referrer-invite-headline');
  if (headline) {
    headline.textContent = 'Step 1 required — tap Get my link to credit this visit';
  }

  const hint = document.getElementById('referrer-invite-hint');
  if (hint) {
    hint.textContent = `Only counts for ${ref} after you generate YOUR link (same contest, ~30 sec).`;
    hint.classList.remove('hidden');
  }

  const inline = document.getElementById('referrer-code-inline');
  if (inline) inline.textContent = ref;
}

function revealFunnelCreditGate(ref: string): void {
  const gate = document.getElementById('funnel-credit-gate');
  if (!gate) return;
  gate.classList.remove('hidden');
  gate.dataset.status = 'required';

  const gateRef = document.getElementById('funnel-gate-ref');
  if (gateRef) gateRef.textContent = ref;
}

/** Pulse the primary hero CTA — referred (step 1) and direct (P1 conversion boost). */
export function highlightHeroGetLink(): void {
  const btn = document.getElementById('hero-get-link-btn');
  if (!btn) return;
  btn.classList.add('hero-get-link-pulse');
  window.setTimeout(() => btn.classList.remove('hero-get-link-pulse'), 12_000);
}

/** Direct landing: draw attention to get-link without funnel credit gate. */
export function initDirectLandingConversionBoost(loc: Location = location): void {
  if (resolveLandingReferrerCode(loc)) return;
  highlightHeroGetLink();
}

function scrollToReferralSection(): void {
  const section = document.getElementById('referral-section');
  if (!section) return;
  window.setTimeout(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 400);
}

/** Call at bootstrap after attribution banner is revealed. */
export function initFunnelConversion(loc: Location = location): void {
  setFunnelStep(1);
  initFunnelGuide();
  initFunnelCoachChat();

  const ref = resolveLandingReferrerCode(loc);
  if (!ref) return;

  document.documentElement.setAttribute('data-vr-referred-landing', '1');
  document.documentElement.setAttribute('data-vr-credit-pending', '1');
  revealFunnelCreditGate(ref);
  highlightHeroGetLink();
  wireExpandToggle();
  scrollToReferralSection();
}

/** Referred-landing copy overrides — run after CMS content is applied. */
export function applyReferredLandingOverrides(loc: Location = location): void {
  const ref = resolveLandingReferrerCode(loc);
  if (!ref) return;
  tuneHeroForReferred(ref);
  tuneAttributionBanner(ref);
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
  syncFunnelGuide(active);
}

function highlightPrimaryShare(): void {
  const primary = document.getElementById('share-whatsapp-primary');
  if (!primary) return;
  primary.classList.add('share-primary-pulse');
  window.setTimeout(() => primary.classList.remove('share-primary-pulse'), 3200);
}

function updateCreditGate(status: 'required' | 'pending' | 'credited' | 'failed', message?: string): void {
  const gate = document.getElementById('funnel-credit-gate');
  if (!gate) return;
  gate.classList.remove('hidden');
  gate.dataset.status = status;

  const desc = document.getElementById('funnel-credit-gate-desc');
  if (desc && message) desc.textContent = message;
}

/** Step 1 clicked — referral credit request in flight. */
export function onReferralCreditPending(): void {
  document.documentElement.setAttribute('data-vr-credit-status', 'pending');
  updateCreditGate(
    'pending',
    'Crediting your visit… stay on this page for a few seconds.',
  );
}

/** Server confirmed referral credit (or duplicate within 24h). */
export function onReferralCredited(): void {
  document.documentElement.setAttribute('data-vr-credit-status', 'credited');
  document.documentElement.removeAttribute('data-vr-credit-pending');

  const title = document.getElementById('funnel-credit-gate-title');
  if (title) title.textContent = 'Referral credited — you counted!';

  updateCreditGate(
    'credited',
    'Step 1 complete. Now COPY your link (Step 2), then SHARE (Step 3).',
  );

  window.setTimeout(() => {
    const gate = document.getElementById('funnel-credit-gate');
    if (gate?.dataset.status === 'credited') {
      gate.classList.add('funnel-credit-gate-fade');
      window.setTimeout(() => gate.classList.add('hidden'), 600);
    }
  }, 5000);
}

/** All funnel credit retries exhausted. */
export function onReferralCreditFailed(): void {
  document.documentElement.setAttribute('data-vr-credit-status', 'failed');
  updateCreditGate(
    'failed',
    'Could not credit — tap Get my link again or refresh the page.',
  );
}

/** Server rejected credit (e.g. self-referral on same code). */
export function onReferralSelfReferralBlocked(): void {
  document.documentElement.setAttribute('data-vr-credit-status', 'failed');
  document.documentElement.removeAttribute('data-vr-credit-pending');
  updateCreditGate(
    'failed',
    'You cannot credit a visit to your own link. Share with someone else or use a fresh browser.',
  );
}

/** After #ref-link is populated — guide visitor to COPY. */
export function onReferralLinkReady(): void {
  document.documentElement.removeAttribute('data-vr-credit-pending');
  setFunnelStep(2);
  highlightCopyButton();
  import('./visitor-slim').then((m) => m.refreshVisitorSlimState()).catch(() => {});
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