/**
 * Admin modal handlers
 * All functions related to opening/closing admin-related modals.
 */

import { ViralRefer, registerGlobal } from '../lib/global';
import { switchAdminTab } from '../admin';
import { supabase } from '../lib/supabase';

registerGlobal('closeAdminPanel', () => {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.add('hidden');
});

registerGlobal('switchAdminTab', switchAdminTab);

const triggerRefreshSpin = (el?: HTMLElement) => {
  if (el) {
    const orig = el.innerHTML;
    el.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i>';
    setTimeout(() => { if (el) el.innerHTML = orig; }, 900);
  }
};
registerGlobal('triggerRefreshSpin', triggerRefreshSpin);

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

const openAdminPasswordModal = () => {
  const pw = document.getElementById('admin-password-modal');
  if (!pw) return;
  pw.classList.remove('hidden');
  requestAnimationFrame(() => {
    const input = document.getElementById('admin-password-input') as HTMLInputElement | null;
    input?.focus();
  });
};

function wireAdminButton(): void {
  const adminBtn = document.getElementById('admin-btn');
  if (!adminBtn || adminBtn.dataset.vrWired) return;
  adminBtn.dataset.vrWired = '1';
  adminBtn.addEventListener('click', openAdminPasswordModal);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireAdminButton);
} else {
  wireAdminButton();
}

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
  const btn = document.getElementById('admin-password-submit-btn') as HTMLButtonElement | null;

  if (!input) return;
  const val = input.value.trim();

  const VALID = import.meta.env.VITE_ADMIN_PASSWORD || '';
  const btnOrigHtml = btn?.innerHTML || '';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Verifying…</span>';
  }

  let authorized = false;
  try {
    const { data, error } = await supabase.functions.invoke('admin-action', {
      body: { action: 'verify_owner_password', payload: { password: val } },
    });
    if (!error && data?.success === true) authorized = true;
  } catch {
    // fall through to client fallback
  }
  if (!authorized && VALID && val === VALID) authorized = true;

  if (authorized) {
    if (errorEl) errorEl.classList.add('hidden');
    const pwModal = document.getElementById('admin-password-modal');
    if (pwModal) pwModal.classList.add('hidden');
    input.value = '';
    await ViralRefer.openAdminPanel();
  } else {
    if (errorEl) errorEl.classList.remove('hidden');
    if (btn) {
      btn.innerHTML = 'Incorrect — try again';
      setTimeout(() => { if (btn) btn.innerHTML = btnOrigHtml; }, 1400);
    }
  }

  if (btn) btn.disabled = false;
  if (btn && authorized) btn.innerHTML = btnOrigHtml;
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
