/**
 * Public action handlers
 * Core user actions: sharing, claiming the banner, and joining via referral.
 */

import { ViralRefer, registerGlobal } from '../lib/global';
import { getShareMessageTemplate, getMyReferralCode } from './globals';
import { supabase } from '../lib/supabase';
import { showToast } from '../ui';
import { trackRedditFunnel } from '../lib/reddit-tracking';

const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function ensureTurnstileReady(): Promise<void> {
  if ((window as any).turnstile) return;
  await new Promise<void>((resolve) => {
    const existing = document.querySelector('script[src*="turnstile"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      setTimeout(resolve, 2000);
      return;
    }
    resolve();
  });
}

async function getTurnstileToken(container: HTMLElement): Promise<string> {
  if (!TURNSTILE_SITEKEY) {
    console.warn('[ViralRefer] VITE_TURNSTILE_SITEKEY not set — using dev bypass for claim');
    return 'dev-bypass-token';
  }

  await ensureTurnstileReady();
  container.innerHTML = '';

  return new Promise((resolve, reject) => {
    const widgetDiv = document.createElement('div');
    container.appendChild(widgetDiv);

    (window as any).turnstile.render(widgetDiv, {
      sitekey: TURNSTILE_SITEKEY,
      callback: (token: string) => resolve(token),
      'error-callback': () => reject(new Error('Turnstile verification failed')),
      'expired-callback': () => reject(new Error('Turnstile expired — please try again')),
    });
  });
}

export const closeWinnerModal = () => {
  const modal = document.getElementById('winner-modal');
  if (modal) modal.classList.add('hidden');
  const turnstile = document.getElementById('claim-turnstile-container');
  if (turnstile) turnstile.innerHTML = '';
  const result = document.getElementById('claim-form-result');
  if (result) result.textContent = '';
};
registerGlobal('closeWinnerModal', closeWinnerModal);

/**
 * Handles sharing the referral link to various platforms.
 */
export const shareTo = (platform: string) => {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  const link = input?.value || window.location.href;

  let text = getShareMessageTemplate() || 'Join me on ViralRefer -- win homepage banner + $10! {link}';
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
  trackRedditFunnel('ShareReferral', { platform });
};
registerGlobal('shareTo', shareTo);

/**
 * Opens the production claim form and submits via submit-claim Edge Function.
 */
export const claimBanner = () => {
  const myCode = getMyReferralCode();
  if (!myCode) {
    showToast('Get your referral link first, then claim when you are #1.', 'info');
    ViralRefer.getMyReferralLinkInstant();
    return;
  }

  const codeDisplay = document.getElementById('claim-referrer-code-display');
  if (codeDisplay) codeDisplay.textContent = myCode;

  const modal = document.getElementById('winner-modal');
  if (!modal) {
    showToast('Claim form unavailable — please refresh the page.', 'info');
    return;
  }

  modal.classList.remove('hidden');
  trackRedditFunnel('OpenPrizeClaim');

  const turnstileContainer = document.getElementById('claim-turnstile-container');
  if (turnstileContainer && TURNSTILE_SITEKEY) {
    turnstileContainer.innerHTML = '';
    ensureTurnstileReady().then(() => {
      if (!turnstileContainer.isConnected) return;
      getTurnstileToken(turnstileContainer).catch(() => {});
    });
  }
};
registerGlobal('claimBanner', claimBanner);

/**
 * Submits the prize claim form (called from winner-modal button).
 */
export const submitPrizeClaim = async () => {
  const myCode = getMyReferralCode();
  if (!myCode) {
    showToast('Generate your referral link before claiming.', 'info');
    return;
  }

  const website = (document.getElementById('claim-website') as HTMLInputElement)?.value.trim() || '';
  const cashtag = (document.getElementById('claim-cashtag') as HTMLInputElement)?.value.trim() || '';
  const message = (document.getElementById('claim-message') as HTMLTextAreaElement)?.value.trim() || '';
  const resultEl = document.getElementById('claim-form-result');
  const submitBtn = document.getElementById('submit-claim-form') as HTMLButtonElement | null;

  if (!cashtag && !website) {
    if (resultEl) resultEl.innerHTML = '<span class="text-amber-400">Please enter your Cash App cashtag or website.</span>';
    return;
  }

  if (resultEl) resultEl.textContent = 'Verifying and submitting securely...';
  if (submitBtn) submitBtn.disabled = true;

  try {
    const turnstileContainer = document.getElementById('claim-turnstile-container');
    let turnstileToken = 'dev-bypass-token';
    if (turnstileContainer && TURNSTILE_SITEKEY) {
      turnstileToken = await getTurnstileToken(turnstileContainer);
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const body: Record<string, string> = {
      turnstileToken,
      website,
      cashtag,
      message,
      referrerCode: myCode,
    };

    const invokeOptions: { body: Record<string, string>; headers?: Record<string, string> } = { body };
    if (sessionData.session?.access_token) {
      invokeOptions.headers = { Authorization: `Bearer ${sessionData.session.access_token}` };
    }

    const { data, error } = await supabase.functions.invoke('submit-claim', invokeOptions);

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Claim was rejected');

    if (resultEl) {
      resultEl.innerHTML = `<span class="text-emerald-400">${escapeHtml(data.message || 'Claim submitted! We will review within 48 hours.')}</span>`;
    }
    showToast('Claim submitted — check Admin → Prize Claims', 'success');
    trackRedditFunnel('SubmitPrizeClaim');

    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.62 }, colors: ['#34d399', '#a78bfa', '#fbbf24'] });
    }).catch(() => {});

    setTimeout(() => {
      closeWinnerModal();
      const adminModal = document.getElementById('admin-modal');
      if (adminModal && !adminModal.classList.contains('hidden')) {
        ViralRefer.switchAdminTab(3);
      }
    }, 2200);
  } catch (err: any) {
    const msg = err?.message || err?.error || 'Submission failed. You may not be #1 yet or already have a pending claim.';
    if (resultEl) resultEl.innerHTML = `<span class="text-red-400">${escapeHtml(String(msg))}</span>`;
    showToast('Claim not accepted — see message in form.', 'info');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};
registerGlobal('submitPrizeClaim', submitPrizeClaim);

export const joinViaReferral = () => {
  ViralRefer.getMyReferralLinkInstant();
};
registerGlobal('joinViaReferral', joinViaReferral);