/**
 * Public action handlers
 * Core user actions: sharing, claiming the banner, and joining via referral.
 */

import { ViralRefer, registerGlobal } from '../lib/global';
import { ensureReferralLinkReady } from '../referral';
import { getMyReferralCode } from './globals';
import { supabase } from '../lib/supabase';
import { showToast } from '../ui';
import { recordShareEvent } from '../lib/record-share';
import { trackVisitorFunnel } from '../lib/visitor-tracking';
import {
  buildShareMessage,
  buildPlatformShareUrl,
  buildEmbedCode,
  buildMarkdownShareMessage,
  buildTrackedShareLink,
  extractReferralCodeFromLink,
  isNativeShareSupported,
  shouldCopyShareMessage,
  type SharePlatform,
} from '../lib/share-power';
import { resolveShareMessageBuildOptions } from '../lib/share-message-options';
import { resolveShareAbVariant } from '../lib/share-ab';
import {
  getShareGapToNextRank,
  getShareLeaderboardRank,
  getShareReferralCount,
} from '../lib/share-context';
import { celebrateShareIfFirst } from '../lib/share-celebrate';
import {
  downloadCanvasPng,
  renderShareCard,
  shareCardFilename,
} from '../lib/share-cards';
import { incrementShareStreak } from '../lib/share-streak';
import { refreshShareStreakUI, setShareAbVariant, setSharePreviewPlatform } from '../lib/share-ui';
import { onShareReminderCompleted } from '../lib/share-reminder-ui';
import { onViralLoopShare } from '../lib/viral-loop-ui';
import { trackDuelInviteShared } from '../lib/duel-invite';
import { nudgeReceiptAfterShare } from '../lib/rank-receipt-card';
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

async function resolveShareContext(): Promise<{ link: string; code: string } | null> {
  const link = await ensureReferralLinkReady();
  if (!link) {
    showToast('Generate your link first, then share', 'info');
    return null;
  }
  const code = getMyReferralCode();
  if (!code) return null;
  return { link, code };
}

function openShareIntent(url: string): void {
  window.open(url, '_blank', 'noopener');
}

function clipboardShareToast(platform: SharePlatform): string {
  if (platform === 'tiktok') return 'TikTok caption copied — paste in bio or post';
  if (platform === 'snapchat') return 'Snapchat caption copied — paste in chat or story';
  if (platform === 'discord') return 'Message copied — paste in Discord';
  return 'Message copied — paste anywhere';
}

function logShare(
  platform: string,
  code: string,
  link: string,
  options: { confirmLock?: boolean } = {},
): void {
  const abVariant = resolveShareAbVariant(code);
  recordShareEvent(
    { platform, referrer_code: code, referral_link: link, ab_variant: abVariant },
    { confirmLock: options.confirmLock === true },
  );
  // Funnel analytics still fire; lock only happens when confirmLock is set
  trackVisitorFunnel('ShareReferral', {
    platform,
    confirmed: options.confirmLock === true ? '1' : '0',
  });
  if (options.confirmLock) {
    incrementShareStreak();
    refreshShareStreakUI();
    onShareReminderCompleted();
    celebrateShareIfFirst();
    onViralLoopShare();
    nudgeReceiptAfterShare();
  }
}

async function copyTextToClipboard(text: string, successToast: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successToast, 'success');
    return true;
  } catch {
    return false;
  }
}

export { syncSharePowerUI } from '../lib/share-ui';

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
    const ctx = await resolveShareContext();
    if (!ctx) return;

    const sharePlatform = platform as SharePlatform;
    const trackedLink = buildTrackedShareLink(ctx.link, sharePlatform);
    const text = buildShareMessage(ctx.link, resolveShareMessageBuildOptions(sharePlatform, ctx.link));
    const abVariant = resolveShareAbVariant(ctx.code);

    const url = buildPlatformShareUrl(sharePlatform, trackedLink, text);
    if (url) {
      // Intent open ≠ sent. Track first, then open (measure away-time).
      const { trackShareAwaitingConfirm } = await import('../lib/share-confirm');
      trackShareAwaitingConfirm({
        platform,
        referrer_code: ctx.code,
        referral_link: trackedLink,
        ab_variant: abVariant,
        sheetSettled: true,
      });
      openShareIntent(url);
      logShare(platform, ctx.code, trackedLink, { confirmLock: false });
      showToast('Send your link in the app — come back; confirm unlocks after a short wait', 'info');
      return;
    }

    if (shouldCopyShareMessage(sharePlatform)) {
      const copied = await copyTextToClipboard(text, clipboardShareToast(sharePlatform));
      if (!copied) showToast('Copy failed — try Copy full message', 'info');
      // Clipboard alone never locks
      logShare(platform, ctx.code, trackedLink, { confirmLock: false });
      showToast('Message copied — paste & send in the app (copy alone does not lock)', 'info');
      return;
    }

    const copied = await copyTextToClipboard(ctx.link, 'Link copied for sharing');
    if (!copied) showToast('Copy failed — try the COPY button', 'info');
    logShare(platform, ctx.code, trackedLink, { confirmLock: false });
  })();
};
registerGlobal('shareTo', shareTo);

/** Mobile-first one-tap: open WhatsApp with tracked message (highest-converting channel). */
export const boostShareWhatsApp = () => {
  void (async () => {
    const ctx = await resolveShareContext();
    if (!ctx) return;

    const text = buildShareMessage(ctx.link, resolveShareMessageBuildOptions('boost', ctx.link));
    const tracked = buildTrackedShareLink(ctx.link, 'boost');
    const abVariant = resolveShareAbVariant(ctx.code);
    const url = buildPlatformShareUrl('whatsapp', tracked, text);
    const { trackShareAwaitingConfirm } = await import('../lib/share-confirm');
    trackShareAwaitingConfirm({
      platform: 'boost-whatsapp',
      referrer_code: ctx.code,
      referral_link: tracked,
      ab_variant: abVariant,
      sheetSettled: true,
    });
    if (url) openShareIntent(url);
    logShare('boost-whatsapp', ctx.code, tracked, { confirmLock: false });
    showToast('Send in WhatsApp — return here; confirm unlocks after you come back', 'info');
  })();
};
registerGlobal('boostShareWhatsApp', boostShareWhatsApp);

/** Duel invite — WhatsApp with challenge link + rivalry copy (highest viral loop). */
export const boostDuelShareWhatsApp = () => {
  void (async () => {
    const ctx = await resolveShareContext();
    if (!ctx) return;

    const text = buildShareMessage(ctx.link, resolveShareMessageBuildOptions('boost', ctx.link));
    const tracked = buildTrackedShareLink(ctx.link, 'boost');
    const abVariant = resolveShareAbVariant(ctx.code);
    const url = buildPlatformShareUrl('whatsapp', tracked, text);
    const { trackShareAwaitingConfirm } = await import('../lib/share-confirm');
    trackShareAwaitingConfirm({
      platform: 'boost-whatsapp',
      referrer_code: ctx.code,
      referral_link: tracked,
      ab_variant: abVariant,
      sheetSettled: true,
    });
    if (url) openShareIntent(url);
    logShare('boost-whatsapp', ctx.code, tracked, { confirmLock: false });
    trackDuelInviteShared('whatsapp');
    showToast('Challenge opened — send it, return here to confirm later', 'info');
  })();
};
registerGlobal('boostDuelShareWhatsApp', boostDuelShareWhatsApp);

/**
 * One-tap native share sheet.
 *
 * Never auto-lock. Never show confirm as soon as the sheet opens.
 * Start tracking BEFORE share() so away-time can be measured; after settle,
 * user must return + wait before "Yes, I sent it" unlocks.
 */
export const nativeShare = () => {
  void (async () => {
    if (!isNativeShareSupported()) {
      // Never dead-end in send mode (platform grid is collapsed) — use SMS/WhatsApp primary
      showToast('Opening best send option for this device…', 'info');
      try {
        const { invokeShareFirstPrimary } = await import('../lib/share-first-ui');
        invokeShareFirstPrimary();
        return;
      } catch {
        /* fall through to direct channel */
      }
      const sms = document.getElementById('share-first-sms');
      const wa = document.getElementById('share-first-whatsapp');
      if (sms && !sms.classList.contains('hidden')) {
        sms.click();
        return;
      }
      if (wa && !wa.classList.contains('hidden')) {
        wa.click();
        return;
      }
      shareTo('sms');
      return;
    }

    const ctx = await resolveShareContext();
    if (!ctx) return;

    const tracked = buildTrackedShareLink(ctx.link, 'native');
    const text = buildShareMessage(ctx.link, resolveShareMessageBuildOptions('native', ctx.link));
    const abVariant = resolveShareAbVariant(ctx.code);

    const { trackShareAwaitingConfirm, markShareSheetSettled } = await import(
      '../lib/share-confirm'
    );

    // Start clock BEFORE sheet opens (do not show confirm yet)
    trackShareAwaitingConfirm({
      platform: 'native',
      referrer_code: ctx.code,
      referral_link: tracked,
      ab_variant: abVariant,
      sheetSettled: false,
    });
    showToast('Send your link in the share sheet — come back to confirm (not instant)', 'info');

    try {
      await navigator.share({
        title: 'ViralRefer — Live Referral Leaderboard',
        text,
        url: tracked,
      });
      // Settled ≠ sent. Analytics only; confirm stays gated.
      logShare('native', ctx.code, tracked, { confirmLock: false });
      markShareSheetSettled();
      showToast(
        'If you sent it, return here and wait — confirm unlocks after a real send pause',
        'info',
      );
    } catch (err) {
      markShareSheetSettled();
      const name = (err as Error)?.name || '';
      const msg = String((err as Error)?.message || '').toLowerCase();
      if (
        name === 'AbortError' ||
        name === 'NotAllowedError' ||
        msg.includes('abort') ||
        msg.includes('cancel') ||
        msg.includes('denied')
      ) {
        showToast('Share cancelled — still pending until you send your link', 'info');
        return;
      }
      // Expand secondary send options + fall through to SMS/WhatsApp (one only)
      document.documentElement.setAttribute('data-vr-send-more', '1');
      void import('../lib/send-mode')
        .then((m) => m.polishShareFirstForSendMode())
        .catch(() => {});
      showToast('Share sheet failed — try SMS or WhatsApp', 'info');
      const sms = document.getElementById('share-first-sms');
      const wa = document.getElementById('share-first-whatsapp');
      if (sms && !sms.classList.contains('hidden')) {
        sms.click();
      } else if (wa && !wa.classList.contains('hidden')) {
        wa.click();
      } else {
        shareTo('whatsapp');
      }
    }
  })();
};
registerGlobal('nativeShare', nativeShare);

/** Copy the full platform-optimized share message (not just the URL). */
export const copyShareMessage = () => {
  void (async () => {
    const ctx = await resolveShareContext();
    if (!ctx) return;

    const text = buildShareMessage(ctx.link, resolveShareMessageBuildOptions('whatsapp', ctx.link));

    try {
      await navigator.clipboard.writeText(text);
      showToast('Full message copied — paste anywhere', 'success');
      logShare('copy-message', ctx.code, buildTrackedShareLink(ctx.link, 'copy'), {
        confirmLock: false,
      });
    } catch {
      showToast('Copy failed — try the COPY link button', 'info');
    }
  })();
};
registerGlobal('copyShareMessage', copyShareMessage);

/** Copy referral code only (VIRAL-XXXX) for verbal / DM sharing. */
export const copyShortCode = () => {
  void (async () => {
    const ctx = await resolveShareContext();
    if (!ctx) return;
    const code = extractReferralCodeFromLink(ctx.link) || ctx.code;
    const copied = await copyTextToClipboard(code, `Code ${code} copied`);
    if (copied) logShare('copy-code', ctx.code, ctx.link, { confirmLock: false });
  })();
};
registerGlobal('copyShortCode', copyShortCode);

/** Copy HTML embed button for blogs and newsletters. */
export const copyEmbedCode = () => {
  void (async () => {
    const ctx = await resolveShareContext();
    if (!ctx) return;
    const embed = buildEmbedCode(ctx.link);
    const copied = await copyTextToClipboard(embed, 'Embed code copied — paste into your site');
    if (copied) logShare('embed', ctx.code, ctx.link, { confirmLock: false });
  })();
};
registerGlobal('copyEmbedCode', copyEmbedCode);

/** Copy Markdown share blurb for Reddit, GitHub, Notion. */
export const copyMarkdownShare = () => {
  void (async () => {
    const ctx = await resolveShareContext();
    if (!ctx) return;
    const opts = resolveShareMessageBuildOptions('copy', ctx.link);
    const md = buildMarkdownShareMessage(ctx.link, {
      referralCount: opts.referralCount,
      leaderboardRank: opts.leaderboardRank,
    });
    const copied = await copyTextToClipboard(md, 'Markdown copied — paste on Reddit, GitHub, Notion');
    if (copied) logShare('markdown', ctx.code, buildTrackedShareLink(ctx.link, 'copy'), {
      confirmLock: false,
    });
  })();
};
registerGlobal('copyMarkdownShare', copyMarkdownShare);

function downloadShareCard(link: string, code: string, format: 'square' | 'story'): boolean {
  const canvas = document.createElement('canvas');
  const ok = renderShareCard(canvas, {
    link,
    code,
    format,
    rank: getShareLeaderboardRank(),
    gapToNext: getShareGapToNextRank(),
    referralCount: getShareReferralCount(),
  });
  if (!ok) return false;
  downloadCanvasPng(canvas, shareCardFilename(code, format));
  return true;
}

/**
 * Image-based X share — downloads a promo card PNG and opens X with link-free text.
 * Bypasses X malware/link filters because the referral URL lives in the image, not the tweet.
 */
export const generateXShareImage = () => {
  void (async () => {
    const ctx = await resolveShareContext();
    if (!ctx || !/\/r\/VIRAL-/i.test(ctx.link)) return;

    if (!downloadShareCard(ctx.link, ctx.code, 'square')) {
      showToast('Could not create share image — try again', 'info');
      return;
    }

    const safeXText =
      'Live referral leaderboard on ViralRefer 🏆 Free · no signup · #1 can claim a homepage feature. Can you beat me? (See image for my link)';
    openShareIntent(`https://x.com/intent/tweet?text=${encodeURIComponent(safeXText)}`);

    showToast('Share image downloaded — attach it to your X post (does not lock link yet)', 'info');
    logShare('x-image', ctx.code, ctx.link, { confirmLock: false });
  })();
};
registerGlobal('generateXShareImage', generateXShareImage);

/** Vertical 9:16 story card for Instagram, TikTok, Snapchat Stories. */
export const generateStoryShareImage = () => {
  void (async () => {
    const ctx = await resolveShareContext();
    if (!ctx || !/\/r\/VIRAL-/i.test(ctx.link)) return;

    if (!downloadShareCard(ctx.link, ctx.code, 'story')) {
      showToast('Could not create story image — try again', 'info');
      return;
    }

    await copyTextToClipboard(ctx.link, 'Story image saved + link copied (copy does not lock link)');
    logShare('story-image', ctx.code, ctx.link, { confirmLock: false });
  })();
};
registerGlobal('generateStoryShareImage', generateStoryShareImage);

/** Download square + story share images in one action. */
export const downloadSharePack = () => {
  void (async () => {
    const ctx = await resolveShareContext();
    if (!ctx || !/\/r\/VIRAL-/i.test(ctx.link)) return;

    const squareOk = downloadShareCard(ctx.link, ctx.code, 'square');
    window.setTimeout(() => {
      const storyOk = downloadShareCard(ctx.link, ctx.code, 'story');
      if (squareOk && storyOk) {
        const isWinner = getShareLeaderboardRank() === 1;
        showToast(
          isWinner
            ? 'Winner share pack downloaded — gold #1 cards'
            : 'Share pack downloaded — square + story images',
          'success',
        );
        logShare(isWinner ? 'winner-pack' : 'share-pack', ctx.code, ctx.link, {
          confirmLock: false,
        });
      } else {
        showToast('Could not create full share pack — try individual buttons', 'info');
      }
    }, 400);
  })();
};
registerGlobal('downloadSharePack', downloadSharePack);

registerGlobal('setSharePreviewPlatform', (platform: string) => {
  setSharePreviewPlatform(platform as SharePlatform);
});
registerGlobal('setShareAbVariant', (variant: string) => {
  if (variant === 'a' || variant === 'b') setShareAbVariant(variant);
});

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
  const message = (document.getElementById('claim-message') as HTMLTextAreaElement)?.value.trim() || '';
  const resultEl = document.getElementById('claim-form-result');
  const submitBtn = document.getElementById('submit-claim-form') as HTMLButtonElement | null;

  // Homepage feature claim — website required; no monetary fields on public product
  if (!website) {
    if (resultEl) {
      resultEl.innerHTML =
        '<span class="text-amber-400">Please enter the website you want featured on the homepage.</span>';
    }
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
    showToast('Claim submitted — we\'ll review within 48 hours.', 'success');
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