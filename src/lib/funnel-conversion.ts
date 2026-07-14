/**
 * Referred-landing funnel UX — clarity, trust, guided steps, funnel-gated crediting UI.
 */

import { getStoredLandingRef, parseRefFromLocation } from './referral-url';
import { triggerDuelInviteMoment } from './duel-invite';
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
  if (line1) line1.textContent = 'One tap so they get credit.';

  const subtitle = document.getElementById('hero-subtitle');
  if (subtitle) {
    subtitle.textContent =
      `You opened ${ref}'s invite. Visiting alone does not count — tap Get my link once, then send yours to play.`;
  }

  const badge = document.getElementById('hero-badge');
  if (badge) badge.textContent = 'REFERRED • TAP GET LINK';

  const trust = document.getElementById('hero-trust-line');
  if (trust) {
    trust.innerHTML =
      '<strong class="text-amber-300">Just visiting does not credit them.</strong> Tap <strong class="text-white">Get my link</strong> below — ~5 seconds.';
  }

  // Micro-flow: hide secondary hero CTAs noise
  const secondary = document.getElementById('hero-leaderboard-btn');
  if (secondary) secondary.classList.add('opacity-70');
}

function tuneAttributionBanner(ref: string): void {
  const headline = document.getElementById('referrer-invite-headline');
  if (headline) {
    headline.textContent = `Tap once to credit ${ref} — then you play too`;
  }

  const hint = document.getElementById('referrer-invite-hint');
  if (hint) {
    hint.textContent = `Step 1 only: Get YOUR link. Same contest. Free. ~30 seconds.`;
    hint.classList.remove('hidden');
  }

  const inline = document.getElementById('referrer-code-inline');
  if (inline) inline.textContent = ref;

  // Attribution CTA — make label unmistakable
  const attrBtn = document.getElementById('attribution-get-link-btn');
  const attrLabel = attrBtn?.querySelector('span');
  if (attrLabel) attrLabel.textContent = 'Get my link — credit this visit';
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
  document.documentElement.setAttribute('data-vr-referred-micro', '1');
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

  const ref = resolveLandingReferrerCode();
  const creditMsg = ref
    ? `You counted for ${ref}. Next: Share now (any app) so you can climb too.`
    : 'Step 1 complete. Next: Share now (any app) — copy alone does not lock your link.';

  updateCreditGate('credited', creditMsg);
  triggerDuelInviteMoment(ref);
  // Push into send mode (one primary: native / SMS / WhatsApp) — not clipboard
  void import('./send-mode')
    .then((m) => m.activateSendModeAfterGetLink({ autoCopied: false }))
    .catch(() => {
      void import('./share-first-ui')
        .then((m) => m.activateShareFirstAfterGetLink({ autoCopied: false }))
        .catch(() => {});
    });

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

/** After #ref-link is populated — guide visitor to COPY, then share. */
export function onReferralLinkReady(): void {
  document.documentElement.removeAttribute('data-vr-credit-pending');
  setFunnelStep(2);
  highlightCopyButton();
  triggerDuelInviteMoment(resolveLandingReferrerCode());
  import('./visitor-slim').then((m) => m.refreshVisitorSlimState()).catch(() => {});
}

/** After successful clipboard copy — guide visitor to SHARE (verified). */
export function onReferralLinkCopied(): void {
  setFunnelStep(3);
  highlightPrimaryShare();

  const hint = document.getElementById('referral-next-step');
  if (hint) {
    hint.classList.remove('hidden');
    hint.dataset.vrSharePrompted = '1';
    hint.textContent =
      'Copied — now Share now (any app). Clipboard alone does not lock your link.';
  }

  // Keep progressive share reminders in sync (toast/banner after copy)
  void import('./share-reminder-ui')
    .then((m) => m.onShareReminderLinkCopied())
    .catch(() => {});
}

function highlightCopyButton(): void {
  // Share-first: emphasize send path over copy after get-link
  const primary =
    document.getElementById('native-share-btn') ||
    document.getElementById('share-first-strip') ||
    document.getElementById('share-whatsapp-primary');
  if (primary) {
    primary.classList.add('share-first-pulse');
    window.setTimeout(() => primary.classList.remove('share-first-pulse'), 5200);
  }

  const hint = document.getElementById('referral-next-step');
  if (hint) {
    hint.classList.remove('hidden');
    if (!hint.dataset.vrSharePrompted) {
      hint.textContent =
        'Next: tap Share now (pick any app). Copy alone does not lock your link.';
    }
  }

  // Soft-highlight the share row so the full path is visible after get-link
  const sharePanel = document.getElementById('share-buttons-panel');
  if (sharePanel) {
    sharePanel.classList.add('share-ready', 'share-panel-awaiting');
    window.setTimeout(() => sharePanel.classList.remove('share-panel-awaiting'), 8000);
  }
}

function highlightPrimaryShare(): void {
  // Prefer visible send-mode controls over the (often hidden) multi-platform grid
  const candidates = [
    document.getElementById('native-share-btn'),
    document.getElementById('share-first-sms'),
    document.getElementById('share-first-whatsapp'),
    document.getElementById('share-first-strip'),
    document.getElementById('mobile-send-cta-btn'),
    document.getElementById('share-whatsapp-primary'),
  ];
  const primary = candidates.find((el) => el && !el.classList.contains('hidden'));
  if (!primary) return;
  primary.classList.add('share-primary-pulse', 'share-first-pulse');
  window.setTimeout(() => {
    primary.classList.remove('share-primary-pulse', 'share-first-pulse');
  }, 3200);
}