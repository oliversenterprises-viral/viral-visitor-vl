/**
 * Public action handlers
 * Core user actions: sharing, claiming the banner, and joining via referral.
 */

import { ViralRefer, registerGlobal } from '../lib/global';
import { ensureReferralLinkReady } from '../referral';
import { getShareMessageTemplate, getMyReferralCode } from './globals';
import { supabase } from '../lib/supabase';
import { showToast } from '../ui';
import { recordShareEvent } from '../lib/record-share';
import { trackVisitorFunnel } from '../lib/visitor-tracking';
import {
  ensureTurnstileReady,
  getTurnstileSiteKey,
  getTurnstileToken,
} from '../lib/turnstile';

const TURNSTILE_SITEKEY = getTurnstileSiteKey();

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
  void (async () => {
    const link = await ensureReferralLinkReady();
    if (!link) {
      showToast('Generate your link first, then share', 'info');
      return;
    }

    let text =
      getShareMessageTemplate() ||
      'Free to join — grab your link in ~30 sec. #1 wins homepage feature + $10 Cash App. {link}';
    text = text.replace(/\{link\}/g, link);

    let url = '';
    if (platform === 'x') url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    else if (platform === 'whatsapp') url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    else if (platform === 'linkedin') url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`;
    else if (platform === 'facebook') url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
    else if (platform === 'telegram') url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    else if (platform === 'sms') url = `sms:?body=${encodeURIComponent(text)}`;
    else if (platform === 'email') url = `mailto:?subject=Check%20out%20ViralRefer&body=${encodeURIComponent(text)}`;
    else {
      await navigator.clipboard.writeText(link);
      showToast('Link copied for sharing', 'success');
    }

    if (url) window.open(url, '_blank', 'noopener');

    const myCode = getMyReferralCode();
    if (myCode) {
      recordShareEvent({ platform, referrer_code: myCode, referral_link: link });
    }

    trackVisitorFunnel('ShareReferral', { platform });
  })();
};
registerGlobal('shareTo', shareTo);

function drawWrappedCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
): number {
  let line = '';
  let y = startY;
  for (const ch of text) {
    const testLine = line + ch;
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, y);
      line = ch;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

function referralCodeFromLink(link: string): string {
  const match = link.match(/\/r\/([^/?#]+)/i);
  return match?.[1] || 'share';
}

/**
 * Image-based X share — downloads a promo card PNG and opens X with link-free text.
 * Bypasses X malware/link filters because the referral URL lives in the image, not the tweet.
 */
export const generateXShareImage = () => {
  void (async () => {
    const link = await ensureReferralLinkReady();
    if (!link || !/\/r\/VIRAL-/i.test(link)) {
      showToast('Generate your link first, then share', 'info');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      showToast('Could not create share image — try again', 'info');
      return;
    }

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#7c3aed');
    grad.addColorStop(1, '#c026d3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, 90);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
    ctx.fillText('ViralRefer', 80, 130);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '32px system-ui, sans-serif';
    ctx.fillText('LIVE REFERRAL LEADERBOARD', 80, 175);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('My Referral Link', 80, 280);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 36px ui-monospace, monospace';
    const linkBottomY = drawWrappedCanvasText(ctx, link, 80, 360, 920, 48);

    ctx.fillStyle = '#e4e4e7';
    ctx.font = '36px system-ui, sans-serif';
    ctx.fillText('Join the real-time leaderboard.', 80, linkBottomY + 80);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillText('Free to join — scan or type the link in the image.', 80, linkBottomY + 125);

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 960, canvas.width, 120);

    ctx.fillStyle = '#7c3aed';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText('viralrefer.app', 80, 1015);

    ctx.fillStyle = '#71717a';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('Attach this image to your post on X', 80, 1050);

    const code = referralCodeFromLink(link);
    const a = document.createElement('a');
    a.download = `viralrefer-${code}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const safeXText =
      'Live referral leaderboard on ViralRefer. Real-time status and rewards. (See image for my link)';
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(safeXText)}`, '_blank', 'noopener');

    showToast('Share image downloaded — attach it to your X post', 'success');

    const myCode = getMyReferralCode();
    if (myCode) {
      recordShareEvent({ platform: 'x', referrer_code: myCode, referral_link: link });
    }

    trackVisitorFunnel('ShareReferral', { platform: 'x-image' });
  })();
};
registerGlobal('generateXShareImage', generateXShareImage);

/**
 * Opens the production claim form and submits via submit-claim Edge Function.
 */
export const claimBanner = () => {
  void (async () => {
    const link = await ensureReferralLinkReady();
    const myCode = getMyReferralCode();
    if (!link || !myCode) {
      showToast('Get your referral link first, then claim when you are #1.', 'info');
      return;
    }
    openClaimModal(myCode);
  })();
};

function openClaimModal(myCode: string): void {

  const codeDisplay = document.getElementById('claim-referrer-code-display');
  if (codeDisplay) codeDisplay.textContent = myCode;

  const modal = document.getElementById('winner-modal');
  if (!modal) {
    showToast('Claim form unavailable — please refresh the page.', 'info');
    return;
  }

  modal.classList.remove('hidden');
  trackVisitorFunnel('OpenPrizeClaim');

  const turnstileContainer = document.getElementById('claim-turnstile-container');
  if (turnstileContainer && TURNSTILE_SITEKEY) {
    turnstileContainer.innerHTML = '';
    ensureTurnstileReady().then(() => {
      if (!turnstileContainer.isConnected) return;
      getTurnstileToken(turnstileContainer, TURNSTILE_SITEKEY, 'claim').catch(() => {});
    });
  }
}
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
      turnstileToken = await getTurnstileToken(turnstileContainer, TURNSTILE_SITEKEY, 'claim');
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
    trackVisitorFunnel('SubmitPrizeClaim');

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