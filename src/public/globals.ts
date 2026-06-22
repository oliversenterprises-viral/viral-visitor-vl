/**
 * Centralized storage for public-facing global configuration values.
 *
 * These values are set from the `site_content` table and are used across
 * multiple modules. Centralizing them reduces direct pollution of the
 * global `window` / `ViralRefer` objects.
 */

import { registerGlobal } from '../lib/global';

let _referralBaseUrl = 'https://www.viralrefer.app';
let _shareMessageTemplate = '';
let _qrModalTitle = 'Scan to Get Your Link';
let _myReferralCode = '';

/**
 * Sets the base URL used when constructing referral links.
 * Also updates the global `window.referralBaseUrl` and `ViralRefer.referralBaseUrl`
 * for legacy onclick compatibility.
 */
export function setReferralBaseUrl(url: string): void {
  _referralBaseUrl = url.replace(/\/$/, '');
  (window as any).referralBaseUrl = _referralBaseUrl;
  (window as any).ViralRefer = (window as any).ViralRefer || {};
  (window as any).ViralRefer.referralBaseUrl = _referralBaseUrl;
}

export function getReferralBaseUrl(): string {
  return _referralBaseUrl;
}

/**
 * Sets the default share message template used by the share buttons.
 * Exposed on the global object for onclick handlers.
 */
export function setShareMessageTemplate(template: string): void {
  _shareMessageTemplate = template;
  (window as any).shareMessageTemplate = _shareMessageTemplate;
  (window as any).ViralRefer = (window as any).ViralRefer || {};
  (window as any).ViralRefer.shareMessageTemplate = _shareMessageTemplate;
}

export function getShareMessageTemplate(): string {
  return _shareMessageTemplate;
}

/**
 * Sets the title shown in the QR code modal.
 * Exposed globally for legacy access.
 */
export function setQrModalTitle(title: string): void {
  _qrModalTitle = title;
  (window as any).qrModalTitle = _qrModalTitle;
}

export function getQrModalTitle(): string {
  return _qrModalTitle;
}

/**
 * Sets the current user's referral code.
 * Persists the value to localStorage and exposes it on both `window.myReferralCode`
 * and `window.ViralRefer.myReferralCode` for onclick compatibility.
 */
export function setMyReferralCode(code: string): void {
  _myReferralCode = code;
  localStorage.setItem('vr_my_ref_code', _myReferralCode);
  (window as any).myReferralCode = _myReferralCode;
  (window as any).ViralRefer = (window as any).ViralRefer || {};
  (window as any).ViralRefer.myReferralCode = _myReferralCode;
}

/**
 * Returns the current user's referral code.
 * Lazily hydrates from localStorage on first access if the in-memory value is empty.
 */
export function getMyReferralCode(): string {
  if (!_myReferralCode) {
    const fromStorage = localStorage.getItem('vr_my_ref_code');
    if (fromStorage) {
      _myReferralCode = fromStorage;
      (window as any).myReferralCode = _myReferralCode;
      (window as any).ViralRefer = (window as any).ViralRefer || {};
      (window as any).ViralRefer.myReferralCode = _myReferralCode;
    }
  }
  return _myReferralCode;
}

registerGlobal('setReferralBaseUrl', setReferralBaseUrl);
