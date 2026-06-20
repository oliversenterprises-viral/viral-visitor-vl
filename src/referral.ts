/**
 * Referral system utilities
 * Handles link generation, QR, sharing, and custom base URL support
 */

import { registerGlobal } from './lib';
import { trackRedditFunnel } from './lib/reddit-tracking';
import { getReferralBaseUrl, getQrModalTitle, getMyReferralCode, setMyReferralCode } from './public/globals';

// Turnstile site key (from Vercel env, falls back for local dev)
const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '';

// Track attribution for the current page load
let pendingReferrerCode: string | null = null;
let referralRecordedThisSession = false;

/**
 * Robustly builds a referral link, properly handling custom base URLs
 * that may already contain query parameters.
 */
export function buildReferralLink(code: string): string {
  const rawBase = getReferralBaseUrl() || `${location.origin}${location.pathname}`;

  try {
    const url = new URL(rawBase);
    url.searchParams.set('ref', code);
    return url.toString();
  } catch (e) {
    console.warn('%c[ViralRefer] Invalid referral_base_url detected — falling back to current origin', 'color:#f59e0b', rawBase);
    const cleanBase = rawBase.replace(/\/$/, '');
    return `${cleanBase}?ref=${code}`;
  }
}

/**
 * Detects and stores pending referrer code from the current URL (?ref=).
 * Called on page load / when attribution banner is shown.
 */
export function detectAndStoreAttribution(): void {
  if (pendingReferrerCode) return;

  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  if (ref) {
    pendingReferrerCode = ref.toUpperCase();
  }
}

/**
 * Loads the Turnstile script dynamically (if not already present).
 */
function ensureTurnstileScriptLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).turnstile) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve(); // fail open
    document.head.appendChild(script);
  });
}

/**
 * Shows a Turnstile widget in the given container and returns a promise that resolves with the token.
 */
function getTurnstileToken(container: HTMLElement): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!TURNSTILE_SITEKEY) {
      // No sitekey configured — allow in local/dev (Edge will still validate if secret is set)
      console.warn('[ViralRefer] VITE_TURNSTILE_SITEKEY not set — skipping Turnstile for recording');
      resolve('dev-bypass-token');
      return;
    }

    container.innerHTML = '';
    const widgetDiv = document.createElement('div');
    container.appendChild(widgetDiv);

    (window as any).turnstile.render(widgetDiv, {
      sitekey: TURNSTILE_SITEKEY,
      callback: (token: string) => {
        resolve(token);
      },
      'error-callback': () => {
        reject(new Error('Turnstile error'));
      },
      'expired-callback': () => {
        reject(new Error('Turnstile expired'));
      },
    });
  });
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
    await ensureTurnstileScriptLoaded();

    // Show a small label + widget
    container.style.display = 'block';
    container.innerHTML = '<div class="text-xs text-zinc-400 mb-1">Verifying you are not a bot...</div>';

    const token = await getTurnstileToken(container);

    const { data, error } = await (await import('./lib')).supabase.functions.invoke('record-referral', {
      body: {
        referrerCode: pendingReferrerCode,
        turnstileToken: token,
      },
    });

    if (error) {
      console.error('[ViralRefer] record-referral error:', error);
      // Still allow the user to continue (non-fatal for UX)
    } else if (data?.success) {
      console.log('[ViralRefer] Referral recorded for', pendingReferrerCode);
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
/**
 * Gets or generates a referral code for the current user and pre-fills the referral input.
 * Called when the user wants to join via referral or share their link.
 *
 * If the page was loaded with ?ref= (attribution), we record the referral for the original referrer
 * via the Edge Function (with Turnstile) before generating the new user's code.
 */
export async function getMyReferralLinkInstant(): Promise<void> {
  // First time on an attributed page — attempt to record the incoming referral
  if (pendingReferrerCode && !referralRecordedThisSession) {
    await recordReferralIfAttributed();
  }

  let code = getMyReferralCode();

  if (!code) {
    code = 'VIRAL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem('vr_my_ref_code', code);
    setMyReferralCode(code);
  }

  const link = buildReferralLink(code);

  const refInput = document.getElementById('ref-link') as HTMLInputElement | null;
  if (refInput) refInput.value = link;

  console.log('[ViralRefer] Generated referral link:', link);
  trackRedditFunnel('GetReferralLink');

  // Show referral section if it exists
  const refSection = document.getElementById('referral-section');
  if (refSection) refSection.scrollIntoView({ behavior: 'smooth' });

  // Also update QR if present
  const qrImg = document.getElementById('qr-code') as HTMLImageElement | null;
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
  }

  // Small "Next Step" hint for new users after generating their link
  const nextStepHint = document.getElementById('referral-next-step');
  if (nextStepHint) {
    nextStepHint.classList.remove('hidden');
  }

  // Re-render the richer Your Stats section now that a code exists
  if ((window as any).renderMyStats) {
    // console.log('[ViralRefer] Re-rendering stats with code:', code); // silenced
    (window as any).renderMyStats(code);
  }
}

/**
 * Generates a brand new referral code
 */
/**
 * Generates a new random referral code for the user and updates the UI.
 */
export function generateNewCode(): void {
  const code = 'VIRAL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  localStorage.setItem('vr_my_ref_code', code);
  setMyReferralCode(code);
  getMyReferralLinkInstant();
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
    trackRedditFunnel('CopyReferralLink');
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
        <div class="text-xl font-bold mb-4">${getQrModalTitle() || 'Scan to Get Your Link'}</div>
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
      <div class="text-xl font-bold mb-4">${getQrModalTitle() || 'Scan to Get Your Link'}</div>
      <img src="${qrUrl}" class="mx-auto rounded-2xl border border-white/10" alt="QR Code" />
      <div class="text-xs text-zinc-400 mt-4 break-all">${link}</div>
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
