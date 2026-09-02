/**
 * Admin modal handlers
 * All functions related to opening/closing admin-related modals.
 */

import { ViralRefer, registerGlobal } from '../lib/global';
import { switchAdminTab, showOwnerFunnelDesk } from '../admin';
import { initAdminSimple, setAdminMore } from '../lib/admin-simple';
import { supabase } from '../lib/supabase';
import { setAdminSessionToken, clearAdminSessionToken } from '../lib/admin-session';

registerGlobal('closeAdminPanel', () => {
  clearAdminSessionToken();
  setAdminMore(false);
  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.add('hidden');
});

registerGlobal('switchAdminTab', switchAdminTab);
registerGlobal('showOwnerFunnelDesk', showOwnerFunnelDesk);

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
    void import('../lib/share-abandon-rescue')
      .then((m) => m.dismissShareAbandonForOwnerHq())
      .catch(() => {});
    initAdminSimple();
    await showOwnerFunnelDesk();
  }
});

/** Entire owner gate lives in JS so first-paint HTML has no password chrome. */
function ensureAdminOwnerGateModal(): HTMLElement | null {
  let modal = document.getElementById('admin-owner-gate-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'admin-owner-gate-modal';
  modal.className = 'hidden fixed inset-0 bg-black/90 z-[300] flex items-center justify-center';
  modal.dataset.vrAdminGate = '1';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'admin-owner-gate-title');
  modal.addEventListener('click', () => closeAdminPasswordModal());
  modal.innerHTML = `
    <div class="glass border border-white/10 rounded-3xl w-full max-w-sm mx-4 p-8" data-vr-owner-gate-panel="1">
      <div class="flex items-center justify-between mb-6">
        <div id="admin-owner-gate-title" class="font-bold text-xl flex items-center gap-3"><i class="fa-solid fa-shield-halved text-rose-400"></i> Owner tools</div>
        <button type="button" class="text-2xl text-zinc-400 hover:text-white" aria-label="Close" data-vr-owner-gate-close="1">✕</button>
      </div>
      <div class="text-sm text-zinc-400 mb-4">Type the owner password to open your desk. Visitors never see this.</div>
      <div id="admin-owner-gate-slot" class="mb-4"></div>
      <div id="admin-owner-gate-error" class="hidden text-rose-400 text-sm mb-4">Incorrect — try again.</div>
      <div class="flex gap-3">
        <button type="button" data-vr-owner-gate-close="1"
                class="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/20 rounded-2xl font-semibold transition-all">
          Cancel
        </button>
        <button type="button" id="admin-owner-gate-submit"
                class="flex-1 py-4 bg-violet-600 hover:bg-violet-500 rounded-2xl font-semibold text-white transition-all flex items-center justify-center gap-2">
          <span>Continue</span>
        </button>
      </div>
      <div class="text-[10px] text-center text-zinc-500 mt-4">Owner session only · not for participants</div>
    </div>`;
  modal.querySelector('[data-vr-owner-gate-panel]')?.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
  });
  modal.querySelectorAll('[data-vr-owner-gate-close]').forEach((el) => {
    el.addEventListener('click', () => closeAdminPasswordModal());
  });
  modal.querySelector('#admin-owner-gate-submit')?.addEventListener('click', () => {
    void submitAdminPassword();
  });
  document.body.appendChild(modal);
  return modal;
}

/** Secret field injected only while owner modal is open — never static in public HTML. */
function ensureAdminPasswordInput(): HTMLInputElement | null {
  ensureAdminOwnerGateModal();
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
  const pw = ensureAdminOwnerGateModal();
  if (!pw) return;
  pw.classList.remove('hidden');
  const input = ensureAdminPasswordInput();
  requestAnimationFrame(() => {
    input?.focus();
  });
};

const OWNER_REVEAL_KEY = 'vr_show_owner';

function revealOwnerTools(): void {
  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) {
    adminBtn.classList.remove('hidden');
    if (!adminBtn.querySelector('[data-vr-owner-label]')) {
      const label = document.createElement('span');
      label.dataset.vrOwnerLabel = '1';
      label.className = 'hidden sm:inline';
      label.textContent = 'Desk';
      adminBtn.appendChild(label);
    }
  }
  try {
    localStorage.setItem(OWNER_REVEAL_KEY, '1');
  } catch {
    /* ignore */
  }
}

function shouldRevealOwnerTools(): boolean {
  try {
    if (localStorage.getItem(OWNER_REVEAL_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('owner') === '1') return true;
  } catch {
    /* ignore */
  }
  return location.hash === '#owner';
}

function wireAdminButton(): void {
  const adminBtn = document.getElementById('admin-btn');
  if (!adminBtn || adminBtn.dataset.vrWired) return;
  adminBtn.dataset.vrWired = '1';
  adminBtn.addEventListener('click', openAdminPasswordModal);
  if (shouldRevealOwnerTools()) {
    revealOwnerTools();
    void import('../lib/share-abandon-rescue')
      .then((m) => {
        if (m.isOwnerHqContext()) m.dismissShareAbandonForOwnerHq();
      })
      .catch(() => {});
  }
  document.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 'o') {
      ev.preventDefault();
      revealOwnerTools();
      openAdminPasswordModal();
    }
  });
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
    revealOwnerTools();
    closeAdminPasswordModal();
    await ViralRefer.openAdminPanel?.();
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
