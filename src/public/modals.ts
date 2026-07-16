/**
 * Admin modal handlers
 * All functions related to opening/closing admin-related modals.
 */

import { ViralRefer, registerGlobal } from '../lib/global';
import { switchAdminTab } from '../admin';
import { startAdminLiveHub, stopAdminLiveHub } from '../admin/admin-live-hub';
import { unlockAdminLiveSound } from '../admin/admin-live-sound';
import { supabase } from '../lib/supabase';
import { setAdminSessionToken, clearAdminSessionToken } from '../lib/admin-session';

registerGlobal('closeAdminPanel', () => {
  stopAdminLiveHub();
  clearAdminSessionToken();
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
    startAdminLiveHub();
    await ViralRefer.switchAdminTab(0);
  }
});

/** Secret field injected only while owner modal is open — never static in public HTML. */
function ensureAdminPasswordInput(): HTMLInputElement | null {
  const slot = document.getElementById('admin-owner-gate-slot');
  if (!slot) return document.getElementById('admin-owner-gate-input') as HTMLInputElement | null;
  let input = document.getElementById('admin-owner-gate-input') as HTMLInputElement | null;
  if (!input) {
    input = document.createElement('input');
    input.id = 'admin-owner-gate-input';
    // Masked text (not type=password) so DOM dumps after open are less “login form”-like
    input.type = 'text';
    input.name = 'vr_owner_gate';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Owner verification');
    input.style.setProperty('-webkit-text-security', 'disc');
    input.className =
      'w-full bg-zinc-900 border border-white/20 rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-violet-500';
    input.placeholder = 'Owner key';
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void submitAdminPassword();
      }
    });
    slot.appendChild(input);
  }
  return input;
}

function destroyAdminPasswordInput(): void {
  const input = document.getElementById('admin-owner-gate-input') as HTMLInputElement | null;
  if (input) {
    input.value = '';
    input.remove();
  }
  const slot = document.getElementById('admin-owner-gate-slot');
  if (slot) slot.innerHTML = '';
}

const closeAdminPasswordModal = () => {
  const m = document.getElementById('admin-owner-gate-modal');
  if (m) m.classList.add('hidden');
  destroyAdminPasswordInput();
  const errorEl = document.getElementById('admin-owner-gate-error');
  if (errorEl) errorEl.classList.add('hidden');
};
registerGlobal('closeAdminPasswordModal', closeAdminPasswordModal);

const openAdminPasswordModal = () => {
  const pw = document.getElementById('admin-owner-gate-modal');
  if (!pw) return;
  pw.classList.remove('hidden');
  const input = ensureAdminPasswordInput();
  requestAnimationFrame(() => {
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
  const input = document.getElementById('admin-owner-gate-input') as HTMLInputElement | null;
  const eye = document.getElementById('admin-owner-gate-eye');
  if (!input || !eye) return;
  const masked = input.style.getPropertyValue('-webkit-text-security') === 'disc';
  if (masked) {
    input.style.setProperty('-webkit-text-security', 'none');
    eye.classList.remove('fa-eye');
    eye.classList.add('fa-eye-slash');
  } else {
    input.style.setProperty('-webkit-text-security', 'disc');
    eye.classList.remove('fa-eye-slash');
    eye.classList.add('fa-eye');
  }
};
registerGlobal('toggleAdminPasswordVisibility', toggleAdminPasswordVisibility);

const submitAdminPassword = async () => {
  const input = document.getElementById('admin-owner-gate-input') as HTMLInputElement | null;
  const errorEl = document.getElementById('admin-owner-gate-error');
  const btn = document.getElementById('admin-owner-gate-submit') as HTMLButtonElement | null;

  if (!input) return;
  const val = input.value.trim();

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
    const sessionToken =
      typeof data?.session_token === 'string' ? data.session_token.trim() : '';
    if (!error && data?.success === true && sessionToken) {
      setAdminSessionToken(sessionToken);
      authorized = true;
    }
  } catch {
    /* edge unavailable */
  }

  if (authorized) {
    if (errorEl) errorEl.classList.add('hidden');
    closeAdminPasswordModal();
    void unlockAdminLiveSound();
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
