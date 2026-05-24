/**
 * Public action handlers
 * Core user actions: sharing, claiming the banner, and joining via referral.
 */

import { ViralRefer, registerGlobal } from '../lib/global';
import { getShareMessageTemplate } from './globals';

// Note: getMyReferralLinkInstant, generateNewCode, copyLink, showQRModal
// are registered directly by the Referral module itself for simplicity.

/**
 * Handles sharing the referral link to various platforms.
 * Called from the share buttons on the public site.
 */
export const shareTo = (platform: string) => {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  const link = input?.value || window.location.href;
  console.log('[ViralRefer] Sharing link via', platform, ':', link);

  let text = getShareMessageTemplate() || 'Join me on ViralRefer â€” win homepage banner + $10! {link}';
  text = text.replace(/\{link\}/g, link);

  let url = '';
  if (platform === 'x') url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  else if (platform === 'whatsapp') url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  else if (platform === 'linkedin') url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`;
  else if (platform === 'facebook') url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
  else if (platform === 'telegram') url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  else if (platform === 'sms') url = `sms:?body=${encodeURIComponent(text)}`;
  else if (platform === 'email') url = `mailto:?subject=Check%20out%20ViralRefer&body=${encodeURIComponent(text)}`;
  else navigator.clipboard.writeText(link);

  if (url) window.open(url, '_blank', 'noopener');
};

registerGlobal('shareTo', shareTo);

/**
 * Opens the winner claim flow (or shows a demo message).
 * Registered globally as `claimBanner`.
 */
export const claimBanner = () => {
  const winModal = document.getElementById('winner-modal');
  if (winModal) {
    winModal.classList.remove('hidden');
  } else {
    alert('Claim flow opened (demo).\nIn production this shows the full claim form (website + cashtag + message + Turnstile).\nAfter submit it appears in the Admin â†’ Prize Claims tab.');
    const adminModal = document.getElementById('admin-modal');
    if (adminModal && !adminModal.classList.contains('hidden')) {
      ViralRefer.switchAdminTab(3);
    }
  }
};
registerGlobal('claimBanner', claimBanner);

/**
 * Starts the "Join via Referral" flow (gets or generates a referral code).
 * Registered globally as `joinViaReferral`.
 */
export const joinViaReferral = () => {
  ViralRefer.getMyReferralLinkInstant();
};
registerGlobal('joinViaReferral', joinViaReferral);


