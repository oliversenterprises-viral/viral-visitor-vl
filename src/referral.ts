/**
 * Referral system utilities
 * Handles link generation, QR, sharing, and custom base URL support
 */

import { registerGlobal } from './lib';
import { supabase } from './lib/supabase';
import { recordShareEvent } from './lib/record-share';
import { trackRedditFunnel } from './lib/reddit-tracking';
import { trackVisitorFunnel } from './lib/visitor-tracking';
import {
  buildReferralLinkFromBase,
  captureReferralAttribution,
  parseRefFromLocation,
} from './lib/referral-url';
import { parseEdgeFunctionBody } from './lib/edge-response';
import { ensureTurnstileReady, getTurnstileToken } from './lib/turnstile';
import { escapeHtml } from './content';
import { showToast } from './ui';
import { getReferralBaseUrl, getQrModalTitle, getMyReferralCode, setMyReferralCode } from './public/globals';

// Track attribution for the current page load
let pendingReferrerCode: string | null = null;
let referralRecordedThisSession = false;
let referralRecordingInFlight = false;
let referralSuccessToastShown = false;
let referralFailureToastShown = false;

export type ReferralRecordOutcome = 'success' | 'duplicate' | 'skipped' | 'failed' | 'in_flight';

/**
 * Robustly builds a referral link, properly handling custom base URLs
 * that may already contain query parameters.
 */
export function buildReferralLink(code: string): string {
  const rawBase = getReferralBaseUrl() || location.origin;
  return buildReferralLinkFromBase(code, rawBase, location.origin);
}

/**
 * Detects and stores pending referrer code from the current URL (?ref=).
 * Called on page load / when attribution banner is shown.
 */
export function detectAndStoreAttribution(): void {
  if (pendingReferrerCode) return;
  const ref = captureReferralAttribution() || parseRefFromLocation();
  if (ref) pendingReferrerCode = ref;
}

function notifyReferralOutcome(outcome: ReferralRecordOutcome, allowFailureRetryToast = false): void {
  if (outcome === 'success' && !referralSuccessToastShown) {
    showToast('Referral credited — thanks for joining!', 'success');
    referralSuccessToastShown = true;
    return;
  }
  if (outcome === 'failed' && (!referralFailureToastShown || allowFailureRetryToast)) {
    showToast("Couldn't credit referral — complete the check below or refresh", 'info');
    referralFailureToastShown = true;
  }
}

function prepareReferralTurnstileContainer(): HTMLElement | null {
  const container = document.getElementById('referral-turnstile-container');
  if (!container) return null;

  const wrap = document.getElementById('referral-turnstile-wrap');
  if (wrap) wrap.classList.remove('hidden');

  container.classList.remove('hidden');
  container.style.cssText = '';
  return container;
}

/**
 * Records the referral for the current attribution (if any) via the Edge Function.
 * Requires Turnstile. Retries on failure until success/duplicate (same page session).
 */
async function recordReferralIfAttributed(options: {
  notify?: boolean;
  allowFailureRetryToast?: boolean;
} = {}): Promise<ReferralRecordOutcome> {
  const notify = options.notify !== false;

  if (!pendingReferrerCode || referralRecordedThisSession) {
    return 'skipped';
  }
  if (referralRecordingInFlight) {
    return 'in_flight';
  }

  const container = prepareReferralTurnstileContainer();
  if (!container) {
    console.warn('[ViralRefer] Turnstile container not found — will retry');
    return 'failed';
  }

  referralRecordingInFlight = true;
  try {
    await ensureTurnstileReady();

    const token = await getTurnstileToken(container, undefined, 'Turnstile for recording', {
      size: 'compact',
      theme: 'dark',
      appearance: 'interaction-only',
      action: 'referral-record',
      timeoutMs: 30_000,
    });

    const visitorCode = getMyReferralCode() || localStorage.getItem('vr_my_ref_code') || null;
    const referredCode =
      visitorCode && visitorCode.toUpperCase() !== pendingReferrerCode.toUpperCase()
        ? visitorCode
        : null;

    const { data, error } = await supabase.functions.invoke('record-referral', {
      body: {
        referrerCode: pendingReferrerCode,
        turnstileToken: token,
        ...(referredCode ? { referredCode } : {}),
      },
    });

    const responseBody = await parseEdgeFunctionBody(data, error);
    const errorText = String(
      responseBody?.error ?? responseBody?.details ?? error?.message ?? '',
    );

    if (errorText.includes('Self-referral')) {
      referralRecordedThisSession = true;
      return 'skipped';
    }

    if (responseBody?.success) {
      referralRecordedThisSession = true;
      if (notify) {
        notifyReferralOutcome(responseBody.duplicate ? 'duplicate' : 'success');
      }
      return responseBody.duplicate ? 'duplicate' : 'success';
    }

    console.error('[ViralRefer] record-referral failed:', {
      error: error?.message,
      body: responseBody,
      referrerCode: pendingReferrerCode,
    });

    if (notify) {
      notifyReferralOutcome('failed', options.allowFailureRetryToast);
    }
    return 'failed';
  } catch (err) {
    console.warn('[ViralRefer] Turnstile / record-referral failed (continuing):', err);
    if (notify) {
      notifyReferralOutcome('failed', options.allowFailureRetryToast);
    }
    return 'failed';
  } finally {
    referralRecordingInFlight = false;
  }
}

const LANDING_RECORD_MAX_CONTAINER_POLLS = 24;
const LANDING_RECORD_MAX_ATTEMPTS = 6;
const LANDING_RECORD_RETRY_MS = [0, 2000, 4000, 8000, 12000, 20000] as const;

async function waitForReferralTurnstileContainer(maxPolls = LANDING_RECORD_MAX_CONTAINER_POLLS): Promise<boolean> {
  for (let polls = 0; polls < maxPolls; polls++) {
    if (document.getElementById('referral-turnstile-container')) return true;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return Boolean(document.getElementById('referral-turnstile-container'));
}

async function runLandingReferralRecording(): Promise<void> {
  await waitForReferralTurnstileContainer();

  for (let attempt = 0; attempt < LANDING_RECORD_MAX_ATTEMPTS; attempt++) {
    if (referralRecordedThisSession) return;

    const delay = LANDING_RECORD_RETRY_MS[attempt] ?? 20_000;
    if (delay > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
    }
    if (referralRecordedThisSession) return;

    const outcome = await recordReferralIfAttributed({
      notify: attempt === 0,
      allowFailureRetryToast: attempt === LANDING_RECORD_MAX_ATTEMPTS - 1,
    });

    if (outcome === 'success' || outcome === 'duplicate' || outcome === 'skipped') return;
  }
}

/**
 * Record attributed visits on landing (background Turnstile), not only on button click.
 * Safe to call once per page load from main.ts bootstrap.
 */
export function initAttributedReferralRecording(): void {
  detectAndStoreAttribution();
  if (!pendingReferrerCode || referralRecordedThisSession) return;

  const start = () => void runLandingReferralRecording();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

/** Vitest-only reset for per-session recording flags. */
export function resetReferralRecordingStateForTests(): void {
  pendingReferrerCode = null;
  referralRecordedThisSession = false;
  referralRecordingInFlight = false;
  referralSuccessToastShown = false;
  referralFailureToastShown = false;
}

/**
 * Generates or retrieves the user's referral code and populates the UI
 */
/** Populate #ref-link, QR, stats — synchronous so the visitor sees value immediately. */
function populateReferralLinkUI(code: string, link: string): void {
  const refInput = document.getElementById('ref-link') as HTMLInputElement | null;
  if (refInput) refInput.value = link;

  const qrImg = document.getElementById('qr-code') as HTMLImageElement | null;
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
  }

  const nextStepHint = document.getElementById('referral-next-step');
  if (nextStepHint) {
    nextStepHint.classList.remove('hidden');
    if (pendingReferrerCode) {
      nextStepHint.textContent =
        'Your link is ready — tap COPY and share to climb the leaderboard.';
    }
  }

  if ((window as any).renderMyStats) {
    (window as any).renderMyStats(code);
  }

  const sharePanel = document.getElementById('share-buttons-panel');
  if (sharePanel) sharePanel.classList.add('share-ready');

  highlightCopyButton();
}

function highlightCopyButton(): void {
  const btn = document.getElementById('copy-link-btn');
  if (!btn) return;
  btn.classList.add('copy-link-pulse');
  window.setTimeout(() => btn.classList.remove('copy-link-pulse'), 2400);
}

/** Current value in #ref-link (empty until generated). */
export function getReferralLinkFromInput(): string {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return input?.value?.trim() || '';
}

/** Generate link if missing — safe for copy/share/QR/claim entry points. */
export async function ensureReferralLinkReady(): Promise<string> {
  const existing = getReferralLinkFromInput();
  if (existing && /\/r\/VIRAL-/i.test(existing)) return existing;

  const code = getMyReferralCode();
  if (code) {
    const link = buildReferralLink(code);
    populateReferralLinkUI(code, link);
    return link;
  }

  await getMyReferralLinkInstant();
  return getReferralLinkFromInput();
}

/** Restore UI for returning visitors who already have a code in localStorage. */
export function applyExistingReferralLink(code: string): void {
  populateReferralLinkUI(code, buildReferralLink(code));
  syncMobileReferralCta();
}

/** Sticky mobile CTA — hidden once #ref-link has a value. */
export function syncMobileReferralCta(): void {
  const bar = document.getElementById('mobile-referral-cta');
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  if (!bar) return;
  if (input?.value?.trim()) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
}

/**
 * Gets or generates a referral code for the current user and pre-fills the referral input.
 * Link + funnel events fire first (conversion); Turnstile recording runs in the background.
 */
export async function getMyReferralLinkInstant(): Promise<void> {
  let code = getMyReferralCode();

  if (!code) {
    code = 'VIRAL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem('vr_my_ref_code', code);
    setMyReferralCode(code);
  }

  const link = buildReferralLink(code);
  populateReferralLinkUI(code, link);

  trackRedditFunnel('GetReferralLink');
  trackVisitorFunnel('GetReferralLink');

  if (pendingReferrerCode) {
    showToast('Your link is ready — copy and share to start referring', 'success');
  } else {
    showToast('Link ready — tap COPY to share', 'success');
  }

  syncMobileReferralCta();

  const refSection = document.getElementById('referral-section');
  if (refSection) refSection.scrollIntoView({ behavior: 'smooth' });

  if (pendingReferrerCode && !referralRecordedThisSession) {
    void recordReferralIfAttributed({ allowFailureRetryToast: true });
  }
}

/**
 * Generates a brand new referral code
 */
/**
 * Generates a new random referral code for the user and updates the UI.
 */
export async function generateNewCode(): Promise<void> {
  const code = 'VIRAL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  localStorage.setItem('vr_my_ref_code', code);
  setMyReferralCode(code);
  await getMyReferralLinkInstant();
}

/**
 * Copies the current referral link to clipboard
 */
/**
 * Copies the current referral link to the clipboard.
 * Shows a temporary "Copied!" feedback on the copy button.
 * Robust implementation that finds the copy button via ID + data attribute
 * instead of fragile sibling traversal.
 */
function performCopyToClipboard(link: string): void {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;

  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copied — paste it anywhere to refer', 'success');
    const code = getMyReferralCode();
    if (code) recordShareEvent({ platform: 'copy', referrer_code: code, referral_link: link });
    trackRedditFunnel('CopyReferralLink');
    trackVisitorFunnel('CopyReferralLink');
    const btn =
      (document.getElementById('copy-link-btn') as HTMLElement | null) ||
      (input?.parentElement?.querySelector('button') as HTMLElement | null) ||
      (input?.nextElementSibling as HTMLElement | null);

    if (btn) {
      const origHTML = btn.innerHTML;
      const origText = btn.textContent;

      btn.innerHTML = '<i class="fa-solid fa-check"></i> COPIED!';
      btn.setAttribute('aria-label', 'Copied to clipboard');

      setTimeout(() => {
        if (btn) {
          btn.innerHTML = origHTML || 'COPY';
          if (origText) btn.textContent = origText;
          btn.removeAttribute('aria-label');
        }
      }, 1400);
    }
  }).catch(() => {
    if (!input) return;
    try {
      input.value = link;
      input.select();
      document.execCommand('copy');
      showToast('Link copied', 'success');
      const code = getMyReferralCode();
      if (code) recordShareEvent({ platform: 'copy', referrer_code: code, referral_link: link });
      trackRedditFunnel('CopyReferralLink');
      trackVisitorFunnel('CopyReferralLink');
    } catch {
      alert('Copy failed. Link: ' + link);
    }
  });
}

export function copyLink(): void {
  void (async () => {
    const link = await ensureReferralLinkReady();
    if (!link) {
      showToast('Could not generate your link — tap Get my referral link', 'info');
      return;
    }
    performCopyToClipboard(link);
  })();
}

/**
 * Opens the QR code modal
 */
/**
 * Shows a modal with a QR code for the user's referral link.
 * The modal title can be customized via site_content.
 */
export function showQRModal(): void {
  void (async () => {
    await ensureReferralLinkReady();
    const code = getMyReferralCode();
    if (!code) {
      showToast('Get your referral link first', 'info');
      return;
    }

    const input = document.getElementById('ref-link') as HTMLInputElement | null;
    const link = input?.value || buildReferralLink(code);
    openQrModalWithLink(link);
  })();
}

function openQrModalWithLink(link: string): void {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(link)}`;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/90 z-[900] flex items-center justify-center';
  modal.innerHTML = `
    <div onclick="event.target.remove()" class="glass border border-white/10 rounded-3xl p-8 max-w-sm w-full mx-4 text-center">
      <div class="text-xl font-bold mb-4">${escapeHtml(getQrModalTitle() || 'Scan to Get Your Link')}</div>
      <img src="${qrUrl}" class="mx-auto rounded-2xl border border-white/10" alt="QR Code" />
      <div class="text-xs text-zinc-400 mt-4 break-all">${escapeHtml(link)}</div>
      <button class="mt-6 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-2xl">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
}

/**
 * Debug helper that logs the current referral state to the console.
 * Exposed globally as `debugReferral`.
 */
export function debugReferral(): void {
  console.group('%c[ViralRefer Debug] Referral State', 'color:#34d399');
  // Debug logs silenced for prod (full audit cleanup)
  // console.log('referralBaseUrl:', getReferralBaseUrl());
  // console.log('myReferralCode:', getMyReferralCode());
  // const refInput = document.getElementById('ref-link') as HTMLInputElement | null;
  // console.log('#ref-link value:', refInput?.value);
  // console.log('Current page URL:', window.location.href);
  console.groupEnd();
}

// Register for onclick compatibility + namespaced access (via central helper)
registerGlobal('getMyReferralLinkInstant', getMyReferralLinkInstant);
registerGlobal('generateNewCode', generateNewCode);
registerGlobal('copyLink', copyLink);
registerGlobal('showQRModal', showQRModal);
registerGlobal('debugReferral', debugReferral);
registerGlobal('buildReferralLink', buildReferralLink);

// Auto-detect attribution on module load (so the first call to getMyReferralLinkInstant can record)
detectAndStoreAttribution();
