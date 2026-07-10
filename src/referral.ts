/**
 * Referral system utilities
 * Handles link generation, QR, sharing, and custom base URL support
 */

import { registerGlobal } from './lib';
import { supabase } from './lib/supabase';
import { recordShareEvent } from './lib/record-share';
import { resolveShareAbVariant } from './lib/share-ab';
import { getHeroCtaVariant, maybeOptimizerScrollToShare } from './lib/optimizer-flags';
import {
  onReferralCreditFailed,
  onReferralCreditPending,
  onReferralCredited,
  onReferralLinkCopied,
  onReferralLinkReady,
  onReferralSelfReferralBlocked,
} from './lib/funnel-conversion';
import { trackVisitorFunnel } from './lib/visitor-tracking';
import {
  buildReferralLinkFromBase,
  captureReferralAttribution,
  parseRefFromLocation,
} from './lib/referral-url';
import { parseEdgeFunctionBody } from './lib/edge-response';
import { tryOptionalTurnstileToken } from './lib/turnstile';
import { escapeHtml } from './content';
import { showToast } from './ui';
import { getReferralBaseUrl, getQrModalTitle, getMyReferralCode, setMyReferralCode } from './public/globals';
import { syncSharePowerUI } from './lib/share-ui';
import { buildQrImageUrl } from './lib/share-power';
import { initShareRemindersOnLinkReady } from './lib/share-reminder-ui';
import { refreshPublicClarityState } from './lib/public-clarity';
import { flashCopySuccess } from './lib/public-polish';

// Track attribution for the current page load
let pendingReferrerCode: string | null = null;
let referralRecordedThisSession = false;
let referralRecordingInFlight = false;
let referralSuccessToastShown = false;
let referralFailureToastShown = false;

export type ReferralRecordOutcome = 'success' | 'duplicate' | 'skipped' | 'failed' | 'in_flight';

/**
 * Robustly builds a referral link, properly handling custom base URLs
 * that may already contain query parameters.
 */
export function buildReferralLink(code: string): string {
  const rawBase = getReferralBaseUrl() || location.origin;
  return buildReferralLinkFromBase(code, rawBase, location.origin);
}

/**
 * Detects and stores pending referrer code from the current URL (?ref=).
 * Called on page load / when attribution banner is shown.
 */
export function detectAndStoreAttribution(): void {
  if (pendingReferrerCode) return;
  const ref = captureReferralAttribution() || parseRefFromLocation();
  if (ref) pendingReferrerCode = ref;
}

function notifyReferralOutcome(outcome: ReferralRecordOutcome, allowFailureRetryToast = false): void {
  if (outcome === 'success' && !referralSuccessToastShown) {
    showToast('Referral credited — thanks for joining!', 'success');
    referralSuccessToastShown = true;
    return;
  }
  if (outcome === 'failed' && (!referralFailureToastShown || allowFailureRetryToast)) {
    showToast("Couldn't credit referral — refresh and try again", 'info');
    referralFailureToastShown = true;
  }
}

/**
 * Records the referral for the current attribution (if any) via the Edge Function.
 * Server-side rate limit + dedupe protect the path (Turnstile optional when configured).
 */
async function recordReferralIfAttributed(options: {
  notify?: boolean;
  allowFailureRetryToast?: boolean;
} = {}): Promise<ReferralRecordOutcome> {
  const notify = options.notify !== false;

  if (!pendingReferrerCode || referralRecordedThisSession) {
    return 'skipped';
  }
  if (referralRecordingInFlight) {
    return 'in_flight';
  }

  referralRecordingInFlight = true;
  try {
    const visitorCode = getMyReferralCode() || localStorage.getItem('vr_my_ref_code') || null;
    const referredCode =
      visitorCode && visitorCode.toUpperCase() !== pendingReferrerCode.toUpperCase()
        ? visitorCode
        : null;

    const turnstileToken = await tryOptionalTurnstileToken(800);

    const { data, error } = await supabase.functions.invoke('record-referral', {
      body: {
        referrerCode: pendingReferrerCode,
        ...(turnstileToken ? { turnstileToken } : {}),
        ...(referredCode ? { referredCode } : {}),
      },
    });

    const responseBody = await parseEdgeFunctionBody(data, error);
    const errorText = String(
      responseBody?.error ?? responseBody?.details ?? error?.message ?? '',
    );

    if (errorText.includes('Self-referral')) {
      referralRecordedThisSession = true;
      return 'skipped';
    }

    if (responseBody?.success) {
      referralRecordedThisSession = true;
      if (notify) {
        notifyReferralOutcome(responseBody.duplicate ? 'duplicate' : 'success');
      }
      return responseBody.duplicate ? 'duplicate' : 'success';
    }

    console.error('[ViralRefer] record-referral failed:', {
      error: error?.message,
      body: responseBody,
      referrerCode: pendingReferrerCode,
    });

    if (notify) {
      notifyReferralOutcome('failed', options.allowFailureRetryToast);
    }
    return 'failed';
  } catch (err) {
    console.warn('[ViralRefer] record-referral failed (continuing):', err);
    if (notify) {
      notifyReferralOutcome('failed', options.allowFailureRetryToast);
    }
    return 'failed';
  } finally {
    referralRecordingInFlight = false;
  }
}

const FUNNEL_RECORD_MAX_ATTEMPTS = 4;
const FUNNEL_RECORD_RETRY_MS = [0, 1500, 4000, 8000] as const;

/** Credits referrer only after Step 1 (Get my link) — not on passive landing. */
async function runFunnelReferralRecording(): Promise<ReferralRecordOutcome> {
  if (!pendingReferrerCode || referralRecordedThisSession) return 'skipped';

  onReferralCreditPending();

  for (let attempt = 0; attempt < FUNNEL_RECORD_MAX_ATTEMPTS; attempt++) {
    if (referralRecordedThisSession) return 'success';

    const delay = FUNNEL_RECORD_RETRY_MS[attempt] ?? 20_000;
    if (delay > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
    }
    if (referralRecordedThisSession) return 'success';

    const outcome = await recordReferralIfAttributed({
      notify: attempt === 0,
      allowFailureRetryToast: attempt === FUNNEL_RECORD_MAX_ATTEMPTS - 1,
    });

    if (outcome === 'success' || outcome === 'duplicate') {
      onReferralCredited();
      return outcome;
    }
    if (outcome === 'skipped') {
      if (pendingReferrerCode) onReferralSelfReferralBlocked();
      return outcome;
    }
  }

  onReferralCreditFailed();
  return 'failed';
}

/**
 * Store attribution from /r/CODE or ?ref= on load. Crediting is funnel-gated (Step 1 click).
 */
export function initAttributedReferralRecording(): void {
  detectAndStoreAttribution();
}

/** True when visitor arrived via someone else's link and is not yet credited. */
export function hasPendingReferrerAttribution(): boolean {
  return !!pendingReferrerCode && !referralRecordedThisSession;
}

/** Vitest helper — whether this session already credited (or skipped self-referral). */
export function isReferralCreditedThisSession(): boolean {
  return referralRecordedThisSession;
}

/** Vitest-only reset for per-session recording flags. */
export function resetReferralRecordingStateForTests(): void {
  pendingReferrerCode = null;
  referralRecordedThisSession = false;
  referralRecordingInFlight = false;
  referralSuccessToastShown = false;
  referralFailureToastShown = false;
  getLinkInFlight = false;
}

/**
 * Generates or retrieves the user's referral code and populates the UI
 */
/** Populate #ref-link, QR, stats — synchronous so the visitor sees value immediately. */
function populateReferralLinkUI(code: string, link: string): void {
  const refInput = document.getElementById('ref-link') as HTMLInputElement | null;
  if (refInput) refInput.value = link;

  const qrImg = document.getElementById('qr-code') as HTMLImageElement | null;
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
  }

  if ((window as any).renderMyStats) {
    (window as any).renderMyStats(code);
  }

  const sharePanel = document.getElementById('share-buttons-panel');
  if (sharePanel) sharePanel.classList.add('share-ready');

  syncSharePowerUI(link);
  initShareRemindersOnLinkReady();
  onReferralLinkReady();
  refreshPublicClarityState();
}

/** Current value in #ref-link (empty until generated). */
export function getReferralLinkFromInput(): string {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return input?.value?.trim() || '';
}

/** Returns an existing link only — does not auto-generate (funnel Step 1 is required first). */
export async function ensureReferralLinkReady(): Promise<string> {
  const existing = getReferralLinkFromInput();
  if (existing && /\/r\/VIRAL-/i.test(existing)) return existing;

  const code = getMyReferralCode();
  if (code) {
    const link = buildReferralLink(code);
    populateReferralLinkUI(code, link);
    return link;
  }

  return '';
}

/** Restore UI for returning visitors who already have a code in localStorage. */
export function applyExistingReferralLink(code: string): void {
  populateReferralLinkUI(code, buildReferralLink(code));
  syncMobileReferralCta();
  if (pendingReferrerCode && !referralRecordedThisSession) {
    void runFunnelReferralRecording();
  }
}

/** Sticky mobile CTA — hidden once #ref-link has a value. */
export function syncMobileReferralCta(): void {
  const bar = document.getElementById('mobile-referral-cta');
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  if (!bar) return;
  if (input?.value?.trim()) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
}

/**
 * Gets or generates a referral code for the current user and pre-fills the referral input.
 * Link + funnel events fire first (conversion); Turnstile recording runs in the background.
 */
let getLinkInFlight = false;

export async function getMyReferralLinkInstant(): Promise<void> {
  if (getLinkInFlight) return;
  getLinkInFlight = true;
  try {
  let code = getMyReferralCode();

  if (!code) {
    code = 'VIRAL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem('vr_my_ref_code', code);
    setMyReferralCode(code);
  }

  const link = buildReferralLink(code);
  populateReferralLinkUI(code, link);

  let via: string | null = null;
  try {
    via = sessionStorage.getItem('vr_get_link_via');
    if (via) sessionStorage.removeItem('vr_get_link_via');
  } catch {
    via = null;
  }
  trackVisitorFunnel('GetReferralLink', {
    hero_cta_variant: getHeroCtaVariant(),
    ...(via ? { via } : {}),
  });

  if (pendingReferrerCode) {
    showToast('Step 1 done — crediting your visit now. Next: COPY your link.', 'success');
  } else {
    showToast('Link ready — tap COPY to share', 'success');
  }

  // FOMO ticker unlocks once this visitor has a referral link
  void import('./app')
    .then((m) => m.onReferralLinkReadyForTicker?.())
    .catch(() => {});

  syncMobileReferralCta();

  const refSection = document.getElementById('referral-section');
  if (refSection) refSection.scrollIntoView({ behavior: 'smooth' });
  maybeOptimizerScrollToShare();

  if (pendingReferrerCode && !referralRecordedThisSession) {
    void runFunnelReferralRecording();
  }
  } finally {
    getLinkInFlight = false;
  }
}

/**
 * Generates a brand new referral code
 */
/**
 * Generates a new random referral code for the user and updates the UI.
 */
export async function generateNewCode(): Promise<void> {
  const code = 'VIRAL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  localStorage.setItem('vr_my_ref_code', code);
  setMyReferralCode(code);
  await getMyReferralLinkInstant();
}

/**
 * Copies the current referral link to clipboard
 */
/**
 * Copies the current referral link to the clipboard.
 * Shows a temporary "Copied!" feedback on the copy button.
 * Robust implementation that finds the copy button via ID + data attribute
 * instead of fragile sibling traversal.
 */
function performCopyToClipboard(link: string): void {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;

  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copied — paste it anywhere to refer', 'success');
    const code = getMyReferralCode();
    if (code) {
      recordShareEvent({
        platform: 'copy',
        referrer_code: code,
        referral_link: link,
        ab_variant: resolveShareAbVariant(code),
      });
    }
    trackVisitorFunnel('CopyReferralLink');
    onReferralLinkCopied();
    const btn =
      (document.getElementById('copy-link-btn') as HTMLElement | null) ||
      (input?.parentElement?.querySelector('button') as HTMLElement | null) ||
      (input?.nextElementSibling as HTMLElement | null);

    if (btn) {
      const origHTML = btn.innerHTML;
      const origText = btn.textContent;

      btn.innerHTML = '<i class="fa-solid fa-check"></i> COPIED!';
      btn.setAttribute('aria-label', 'Copied to clipboard');
      flashCopySuccess(btn);

      setTimeout(() => {
        if (btn) {
          btn.innerHTML = origHTML || 'COPY';
          if (origText) btn.textContent = origText;
          btn.removeAttribute('aria-label');
        }
      }, 1400);
    }
  }).catch(() => {
    if (!input) return;
    try {
      input.value = link;
      input.select();
      document.execCommand('copy');
      showToast('Link copied', 'success');
      const code = getMyReferralCode();
      if (code) {
        recordShareEvent({
          platform: 'copy',
          referrer_code: code,
          referral_link: link,
          ab_variant: resolveShareAbVariant(code),
        });
      }
      trackVisitorFunnel('CopyReferralLink');
      onReferralLinkCopied();
    } catch {
      alert('Copy failed. Link: ' + link);
    }
  });
}

export function copyLink(): void {
  void (async () => {
    const link = await ensureReferralLinkReady();
    if (!link) {
      showToast('Step 1 first — tap Get my referral link above', 'info');
      return;
    }
    performCopyToClipboard(link);
  })();
}

/**
 * Opens the QR code modal
 */
/**
 * Shows a modal with a QR code for the user's referral link.
 * The modal title can be customized via site_content.
 */
export function showQRModal(): void {
  void (async () => {
    await ensureReferralLinkReady();
    const code = getMyReferralCode();
    if (!code) {
      showToast('Get your referral link first', 'info');
      return;
    }

    const input = document.getElementById('ref-link') as HTMLInputElement | null;
    const link = input?.value || buildReferralLink(code);
    openQrModalWithLink(link);
  })();
}

function openQrModalWithLink(link: string): void {
  const qrUrl = buildQrImageUrl(link, 320);

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/90 z-[900] flex items-center justify-center';
  modal.innerHTML = `
    <div class="glass border border-white/10 rounded-3xl p-8 max-w-sm w-full mx-4 text-center" data-qr-modal-card>
      <div class="text-xl font-bold mb-4">${escapeHtml(getQrModalTitle() || 'Scan to Get Your Link')}</div>
      <img src="${qrUrl}" class="mx-auto rounded-2xl border border-white/10 bg-white p-2" alt="QR Code" data-qr-modal-img />
      <div class="text-xs text-zinc-400 mt-4 break-all">${escapeHtml(link)}</div>
      <div class="flex flex-wrap gap-2 justify-center mt-5">
        <button type="button" data-qr-download class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-sm font-semibold">
          <i class="fa-solid fa-download"></i> Save QR
        </button>
        <button type="button" data-qr-native-share class="hidden px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-2xl text-sm font-semibold">
          <i class="fa-solid fa-share-nodes"></i> Share
        </button>
        <button type="button" data-qr-close class="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-sm">Close</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  const card = modal.querySelector('[data-qr-modal-card]');
  card?.addEventListener('click', (e) => e.stopPropagation());

  const downloadBtn = modal.querySelector('[data-qr-download]');
  downloadBtn?.addEventListener('click', () => {
    void downloadQrPng(link);
  });

  const nativeBtn = modal.querySelector('[data-qr-native-share]') as HTMLElement | null;
  if (nativeBtn && typeof navigator.share === 'function') {
    nativeBtn.classList.remove('hidden');
    nativeBtn.addEventListener('click', () => {
      void navigator.share({
        title: 'ViralRefer QR',
        text: 'Scan to join the ViralRefer leaderboard',
        url: link,
      }).catch(() => {});
    });
  }

  modal.querySelector('[data-qr-close]')?.addEventListener('click', () => modal.remove());

  document.body.appendChild(modal);
}

/** Download QR code as PNG for offline sharing (posters, stories, etc.). */
export async function downloadQrPng(link: string): Promise<void> {
  const code = link.match(/\/r\/([^/?#]+)/i)?.[1] || 'share';
  const qrUrl = buildQrImageUrl(link, 512);

  try {
    const res = await fetch(qrUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `viralrefer-qr-${code}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    showToast('QR saved — share the image anywhere', 'success');
  } catch {
    showToast('Could not save QR — try Show larger QR again', 'info');
  }
}

/**
 * Debug helper that logs the current referral state to the console.
 * Exposed globally as `debugReferral`.
 */
export function debugReferral(): void {
  console.group('%c[ViralRefer Debug] Referral State', 'color:#34d399');
  // Debug logs silenced for prod (full audit cleanup)
  // console.log('referralBaseUrl:', getReferralBaseUrl());
  // console.log('myReferralCode:', getMyReferralCode());
  // const refInput = document.getElementById('ref-link') as HTMLInputElement | null;
  // console.log('#ref-link value:', refInput?.value);
  // console.log('Current page URL:', window.location.href);
  console.groupEnd();
}

// Register for onclick compatibility + namespaced access (via central helper)
registerGlobal('getMyReferralLinkInstant', getMyReferralLinkInstant);
registerGlobal('generateNewCode', generateNewCode);
registerGlobal('copyLink', copyLink);
registerGlobal('showQRModal', showQRModal);
registerGlobal('downloadQrPng', downloadQrPng);

/** Inline QR panel — save QR without opening modal. */
export function downloadQrFromPanel(): void {
  void (async () => {
    const link = await ensureReferralLinkReady();
    if (!link) {
      showToast('Get your referral link first', 'info');
      return;
    }
    await downloadQrPng(link);
  })();
}
registerGlobal('downloadQrFromPanel', downloadQrFromPanel);
registerGlobal('debugReferral', debugReferral);
registerGlobal('buildReferralLink', buildReferralLink);

// Auto-detect attribution on module load (funnel Step 1 credits when user taps Get my link)
detectAndStoreAttribution();
