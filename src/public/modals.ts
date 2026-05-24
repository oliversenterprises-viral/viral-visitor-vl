/**
 * Admin modal handlers
 * All functions related to opening/closing admin-related modals.
 */

import { ViralRefer, registerGlobal } from '../lib/global';

registerGlobal('closeAdminPanel', () => {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.add('hidden');
});

registerGlobal('openAdminPanel', async () => {
  const modal = document.getElementById('admin-modal');
  if (modal) {
    modal.classList.remove('hidden');
    await ViralRefer.switchAdminTab(0);
  }
});

const closeAdminPasswordModal = () => {
  const m = document.getElementById('admin-password-modal');
  if (m) m.classList.add('hidden');
};
registerGlobal('closeAdminPasswordModal', closeAdminPasswordModal);

const toggleAdminPasswordVisibility = () => {
  const input = document.getElementById('admin-password-input') as HTMLInputElement | null;
  const eye = document.getElementById('admin-password-eye');
  if (!input || !eye) return;
  if (input.type === 'password') {
    input.type = 'text';
    eye.classList.remove('fa-eye');
    eye.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    eye.classList.remove('fa-eye-slash');
    eye.classList.add('fa-eye');
  }
};
registerGlobal('toggleAdminPasswordVisibility', toggleAdminPasswordVisibility);

const submitAdminPassword = async () => {
  const input = document.getElementById('admin-password-input') as HTMLInputElement | null;
  const errorEl = document.getElementById('admin-password-error');
  const btn = document.getElementById('admin-password-submit-btn');

  if (!input) return;
  const val = input.value.trim();

  const VALID = import.meta.env.VITE_ADMIN_PASSWORD || 'TestAdmin2026!';

  if (val === VALID) {
    if (errorEl) errorEl.classList.add('hidden');
    const pwModal = document.getElementById('admin-password-modal');
    if (pwModal) pwModal.classList.add('hidden');
    input.value = '';
    await ViralRefer.openAdminPanel();
  } else {
    if (errorEl) errorEl.classList.remove('hidden');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = 'Incorrect â€” try again';
      setTimeout(() => { if (btn) btn.innerHTML = orig; }, 1400);
    }
  }
};
registerGlobal('submitAdminPassword', submitAdminPassword);

// Detail modals
const closeClaimDetailsModal = () => {
  const m = document.getElementById('claim-details-modal');
  if (m) m.classList.add('hidden');
};
registerGlobal('closeClaimDetailsModal', closeClaimDetailsModal);

const closeReferralDetailsModal = () => {
  const m = document.getElementById('referral-details-modal');
  if (m) m.classList.add('hidden');
};
registerGlobal('closeReferralDetailsModal', closeReferralDetailsModal);

// Rules modal (footer link)
const showRulesModal = () => {
  const modal = document.getElementById('rules-modal');
  if (modal) modal.classList.remove('hidden');
};
registerGlobal('showRulesModal', showRulesModal);

const closeRulesModal = () => {
  const m = document.getElementById('rules-modal');
  if (m) m.classList.add('hidden');
};
registerGlobal('closeRulesModal', closeRulesModal);
