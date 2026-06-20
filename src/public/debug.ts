/**
 * Debug and demo helpers for the public site.
 * Includes simulation of referrals, debug logging, and keyboard shortcuts for modals.
 *
 * All functions are registered via registerGlobal for consistency.
 */

import { registerGlobal } from '../lib/global';
import { loadLeaderboard } from '../app';
import { getReferralBaseUrl, getMyReferralCode } from './globals';

/**
 * Demo helper that simulates a new referral (used for testing the UI).
 * Registered globally as `simulateNewReferral`.
 *
 * NOTE: This is a LOCAL visual simulation only (DOM mutation).
 * Real-time cross-tab and cross-device updates are now powered by Supabase
 * postgres_changes subscriptions on the referrals table (triggered by real
 * record-referral Edge Function calls with Turnstile + valid codes).
 */
export const simulateNewReferral = async () => {
  const container = document.getElementById('leaderboard-container');
  if (container) container.innerHTML = '<div class="text-emerald-400 py-4">Recording demo referral...</div>';

  setTimeout(async () => {
    await loadLeaderboard();
    const act = document.getElementById('recent-activity');
    if (act) act.innerHTML += `<div class="text-xs px-3 py-1.5 bg-emerald-900/30 rounded-xl mt-1">DEMO • just now</div>`;
  }, 600);
};
registerGlobal('simulateNewReferral', simulateNewReferral);

// Escape key support for detail modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const referralModal = document.getElementById('referral-details-modal');
    const claimModal = document.getElementById('claim-details-modal');
    const winnerModal = document.getElementById('winner-modal');

    if (winnerModal && !winnerModal.classList.contains('hidden')) {
      winnerModal.classList.add('hidden');
    } else if (referralModal && !referralModal.classList.contains('hidden')) {
      referralModal.classList.add('hidden');
    } else if (claimModal && !claimModal.classList.contains('hidden')) {
      claimModal.classList.add('hidden');
    }
  }
});

// Debug helper
/**
 * Debug helper that logs current referral state to the console.
 * Registered globally as `debugReferral`.
 */
export const debugReferral = () => {
  console.group('%c[ViralRefer Debug] Referral State', 'color:#34d399');
  console.log('referralBaseUrl:', getReferralBaseUrl());
  console.log('myReferralCode:', getMyReferralCode());
  const refInput = document.getElementById('ref-link') as HTMLInputElement | null;
  console.log('#ref-link value:', refInput?.value);
  console.log('Current page URL:', window.location.href);
  console.groupEnd();
};
registerGlobal('debugReferral', debugReferral);
