/**
 * Referral system utilities
 * Handles link generation, QR, sharing, and custom base URL support
 */

import { registerGlobal } from './lib';
import { getReferralBaseUrl, getQrModalTitle, getMyReferralCode, setMyReferralCode } from './public/globals';

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
 * Generates or retrieves the user's referral code and populates the UI
 */
/**
 * Gets or generates a referral code for the current user and pre-fills the referral input.
 * Called when the user wants to join via referral or share their link.
 */
export function getMyReferralLinkInstant(): void {
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

  // Show referral section if it exists
  const refSection = document.getElementById('referral-section');
  if (refSection) refSection.scrollIntoView({ behavior: 'smooth' });

  // Also update QR if present
  const qrImg = document.getElementById('qr-code') as HTMLImageElement | null;
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
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
 */
export function copyLink(): void {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  if (input && input.value) {
    navigator.clipboard.writeText(input.value).then(() => {
      const btn = input.nextElementSibling as HTMLElement;
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'COPIED!';
        setTimeout(() => {
          if (btn && orig) btn.textContent = orig;
        }, 1200);
      }
    });
  }
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
  const code = getMyReferralCode() || 'DEMO';
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
  console.log('referralBaseUrl:', getReferralBaseUrl());
  console.log('myReferralCode:', getMyReferralCode());
  const refInput = document.getElementById('ref-link') as HTMLInputElement | null;
  console.log('#ref-link value:', refInput?.value);
  console.log('Current page URL:', window.location.href);
  console.groupEnd();
}

// Register for onclick compatibility + namespaced access (via central helper)
registerGlobal('getMyReferralLinkInstant', getMyReferralLinkInstant);
registerGlobal('generateNewCode', generateNewCode);
registerGlobal('copyLink', copyLink);
registerGlobal('showQRModal', showQRModal);
registerGlobal('debugReferral', debugReferral);
registerGlobal('buildReferralLink', buildReferralLink);