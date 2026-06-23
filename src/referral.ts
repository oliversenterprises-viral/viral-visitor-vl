/**
 * Referral system utilities
 * Handles link generation, QR, sharing, and custom base URL support
 */

import { registerGlobal } from './lib';
import { supabase } from './lib/supabase';
import { trackRedditFunnel } from './lib/reddit-tracking';
import { trackVisitorFunnel } from './lib/visitor-tracking';
import {
  buildReferralLinkFromBase,
  captureReferralAttribution,
  parseRefFromLocation,
} from './lib/referral-url';
import { ensureTurnstileReady, getTurnstileToken } from './lib/turnstile';
import { escapeHtml } from './content';
import { showToast } from './ui';
import { getReferralBaseUrl, getQrModalTitle, getMyReferralCode, setMyReferralCode } from './public/globals';

// Track attribution for the current page load
let pendingReferrerCode: string | null = null;
let referralRecordedThisSession = false;

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

/**
 * Records the referral for the current attribution (if any) via the Edge Function.
 * Requires Turnstile. Idempotent per page load.
 */
async function recordReferralIfAttributed(): Promise<boolean> {
  if (!pendingReferrerCode || referralRecordedThisSession) {
    return true; // nothing to record or already done
  }

  const container = document.getElementById('referral-turnstile-container');
  if (!container) {
    console.warn('[ViralRefer] Turnstile container not found — recording skipped');
    referralRecordedThisSession = true;
    return true;
  }

  try {
    await ensureTurnstileReady();

    // Show a small label + widget
    container.style.display = 'block';
    container.innerHTML =
      '<div class="text-xs text-zinc-400 mb-1">Securing referral credit for your inviter…</div>';

    const token = await getTurnstileToken(container, undefined, 'Turnstile for recording');

    const visitorCode = getMyReferralCode() || localStorage.getItem('vr_my_ref_code') || null;
    const { data, error } = await supabase.functions.invoke('record-referral', {
      body: {
        referrerCode: pendingReferrerCode,
        turnstileToken: token,
        ...(visitorCode ? { referredCode: visitorCode } : {}),
      },
    });

    if (error) {
      console.error('[ViralRefer] record-referral error:', error);
      // Still allow the user to continue (non-fatal for UX)
    } else if (data?.success) {
      // console.log('[ViralRefer] Referral recorded for', pendingReferrerCode); // silenced for prod (audit)
    }

    referralRecordedThisSession = true;
    container.style.display = 'none';
    container.innerHTML = '';
    return true;
  } catch (err) {
    console.warn('[ViralRefer] Turnstile / record-referral failed (continuing):', err);
    referralRecordedThisSession = true;
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
    return true;
  }
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
    void recordReferralIfAttributed();
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
export function copyLink(): void {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  if (!input || !input.value) return;

  navigator.clipboard.writeText(input.value).then(() => {
    showToast('Link copied', 'success');
    trackRedditFunnel('CopyReferralLink');
    trackVisitorFunnel('CopyReferralLink');
    // Robust button lookup — prefers the known copy button ID, falls back to
    // any adjacent button that was the original "COPY" control.
    const btn =
      (document.getElementById('copy-link-btn') as HTMLElement | null) ||
      (input.parentElement?.querySelector('button') as HTMLElement | null) ||
      (input.nextElementSibling as HTMLElement | null);

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
    // Graceful fallback for environments without clipboard API
    try {
      input.select();
      document.execCommand('copy');
    } catch {
      // Last resort: show the link for manual copy
      alert('Copy failed. Link: ' + input.value);
    }
  });
}

/**
 * Opens the QR code modal
 */
/**
 * Shows a modal with a QR code for the user's referral link.
 * The modal title can be customized via site_content.
 */
export function showQRModal(): void {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  const code = getMyReferralCode();

  // If no referral code has been generated yet, show a friendly message instead of a broken QR
  if (!code) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/90 z-[900] flex items-center justify-center';
    modal.innerHTML = `
      <div onclick="event.target.remove()" class="glass border border-white/10 rounded-3xl p-8 max-w-sm w-full mx-4 text-center">
        <div class="text-xl font-bold mb-4">${escapeHtml(getQrModalTitle() || 'Scan to Get Your Link')}</div>
        <div class="text-zinc-300">Please click "Get my referral link" first to see your QR code.</div>
        <button class="mt-6 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-2xl">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
    return;
  }

  const link = input?.value || buildReferralLink(code);
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
