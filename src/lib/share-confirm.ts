/**
 * Share confirmation — anti-cheat gates.
 *
 * Opening WhatsApp/SMS/X or the native share sheet NEVER locks the 24h rule.
 * Confirm UI must NOT appear on top of the share sheet.
 * "Yes, I sent it" stays disabled until:
 *   1) minimum time has passed since share opened, AND
 *   2) the page was away (hidden/blur) long enough and user returned, OR
 *      a long desktop fallback elapsed (native sheet often doesn't hide the tab).
 *
 * Self-report can still be gamed with enough patience; gates make casual cheating hard.
 */

import { showToast } from '../ui';
import {
  isIntentSharePlatform,
  isNativeSharePlatform,
  isVerifiedSharePlatform,
} from './share-deadline';

/**
 * Soft anti-cheat gates — brief pause so confirm is not instant spam,
 * but short enough that real sharers don't feel punished.
 */
/** Min wall time before Yes can unlock (ms). */
export const MIN_ELAPSED_BEFORE_YES_MS = 5_000;
/** Min time the page must have been in background (ms). */
export const MIN_AWAY_MS = 1_500;
/** If page never hides (desktop native), require this longer wait (ms). */
export const DESKTOP_NO_AWAY_FALLBACK_MS = 8_000;
/** Don't even show the banner until this long after open (ms). */
export const MIN_ELAPSED_BEFORE_SHOW_MS = 2_000;

export type PendingIntentShare = {
  platform: string;
  referrer_code: string;
  referral_link: string;
  ab_variant?: 'a' | 'b';
  openedAt: number;
  /** navigator.share() settled (resolve or reject) / intent opened */
  sheetSettled: boolean;
};

let pending: PendingIntentShare | null = null;
let visibilityBound = false;
let pollTimer: ReturnType<typeof window.setInterval> | null = null;
let leftHiddenAt: number | null = null;
let totalAwayMs = 0;
let wasAwayLongEnough = false;

export function getPendingIntentShare(): PendingIntentShare | null {
  return pending;
}

export function getShareConfirmDebugState(): {
  pending: boolean;
  elapsed: number;
  totalAwayMs: number;
  wasAwayLongEnough: boolean;
  canShow: boolean;
  canYes: boolean;
} {
  const elapsed = pending ? Date.now() - pending.openedAt : 0;
  return {
    pending: !!pending,
    elapsed,
    totalAwayMs,
    wasAwayLongEnough,
    canShow: canShowConfirmBanner(),
    canYes: canConfirmYes(),
  };
}

function clearTimers(): void {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function clearPendingIntentShare(): void {
  pending = null;
  leftHiddenAt = null;
  totalAwayMs = 0;
  wasAwayLongEnough = false;
  clearTimers();
  hideConfirmBanner();
  document.getElementById('share-still-pending-chip')?.classList.add('hidden');
  document.documentElement.removeAttribute('data-vr-confirm-dismissed');
}

/** True if this platform may eventually lock after user confirm (not clipboard). */
export function canAwaitShareConfirm(platform: string): boolean {
  if (!isVerifiedSharePlatform(platform)) return false;
  return isIntentSharePlatform(platform) || isNativeSharePlatform(platform);
}

function markAwayTick(): void {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden') {
    if (leftHiddenAt == null) leftHiddenAt = Date.now();
  } else if (leftHiddenAt != null) {
    totalAwayMs += Date.now() - leftHiddenAt;
    leftHiddenAt = null;
    if (totalAwayMs >= MIN_AWAY_MS) wasAwayLongEnough = true;
  }
}

/** Pure eligibility helpers (exported for tests). */
export function evaluateConfirmGates(opts: {
  elapsedMs: number;
  totalAwayMs: number;
  wasAwayLongEnough: boolean;
  pageVisible: boolean;
  sheetSettled: boolean;
  isNative: boolean;
}): { canShow: boolean; canYes: boolean } {
  const {
    elapsedMs,
    totalAwayMs: away,
    wasAwayLongEnough: awayOk,
    pageVisible,
    sheetSettled,
    isNative,
  } = opts;

  // Never while page is hidden (share sheet / other app on top)
  if (!pageVisible) {
    return { canShow: false, canYes: false };
  }

  // Native: wait for sheet promise to settle when possible
  if (isNative && !sheetSettled && elapsedMs < MIN_ELAPSED_BEFORE_SHOW_MS) {
    return { canShow: false, canYes: false };
  }

  const awaySatisfied = awayOk || away >= MIN_AWAY_MS;
  const desktopFallback =
    isNative && !awaySatisfied && elapsedMs >= DESKTOP_NO_AWAY_FALLBACK_MS;
  const awayOrFallback = awaySatisfied || desktopFallback;

  const canShow =
    elapsedMs >= MIN_ELAPSED_BEFORE_SHOW_MS &&
    (awayOrFallback || (!isNative && elapsedMs >= MIN_ELAPSED_BEFORE_YES_MS));

  const canYes =
    elapsedMs >= MIN_ELAPSED_BEFORE_YES_MS &&
    awayOrFallback &&
    (sheetSettled || !isNative || elapsedMs >= DESKTOP_NO_AWAY_FALLBACK_MS);

  return { canShow, canYes };
}

function canShowConfirmBanner(): boolean {
  if (!pending) return false;
  markAwayTick();
  const elapsed = Date.now() - pending.openedAt;
  const pageVisible =
    typeof document === 'undefined' || document.visibilityState === 'visible';
  return evaluateConfirmGates({
    elapsedMs: elapsed,
    totalAwayMs,
    wasAwayLongEnough,
    pageVisible,
    sheetSettled: pending.sheetSettled,
    isNative: isNativeSharePlatform(pending.platform),
  }).canShow;
}

export function canConfirmYes(): boolean {
  if (!pending) return false;
  markAwayTick();
  const elapsed = Date.now() - pending.openedAt;
  const pageVisible =
    typeof document === 'undefined' || document.visibilityState === 'visible';
  return evaluateConfirmGates({
    elapsedMs: elapsed,
    totalAwayMs,
    wasAwayLongEnough,
    pageVisible,
    sheetSettled: pending.sheetSettled,
    isNative: isNativeSharePlatform(pending.platform),
  }).canYes;
}

function startEligibilityPoll(): void {
  clearTimers();
  pollTimer = window.setInterval(() => {
    if (!pending) {
      clearTimers();
      return;
    }
    markAwayTick();
    if (canShowConfirmBanner()) {
      showConfirmBanner();
      refreshConfirmYesState();
    } else {
      refreshConfirmYesState();
      // Keep soft chip while waiting
      maybeShowWaitingChip();
    }
  }, 500);
}

/**
 * Start tracking a share attempt. Call BEFORE opening the share sheet/intent
 * so we can measure away-time while the user is in the other app.
 * Does NOT show confirm immediately.
 */
export function trackShareAwaitingConfirm(payload: {
  platform: string;
  referrer_code: string;
  referral_link: string;
  ab_variant?: 'a' | 'b';
  /** For intent opens, sheet is "settled" immediately after open. */
  sheetSettled?: boolean;
}): void {
  if (!canAwaitShareConfirm(payload.platform)) return;

  // Reset away tracking for this attempt
  leftHiddenAt = document.visibilityState === 'hidden' ? Date.now() : null;
  totalAwayMs = 0;
  wasAwayLongEnough = false;

  pending = {
    platform: payload.platform,
    referrer_code: payload.referrer_code,
    referral_link: payload.referral_link,
    ab_variant: payload.ab_variant,
    openedAt: Date.now(),
    sheetSettled: payload.sheetSettled === true,
  };

  document.documentElement.setAttribute('data-vr-share-pending', '1');
  document.documentElement.removeAttribute('data-vr-share-locked');
  document.documentElement.removeAttribute('data-vr-post-share-return');
  // Never flash confirm on open
  hideConfirmBanner();

  ensureVisibilityListener();
  startEligibilityPoll();
  maybeShowWaitingChip();
}

/** Call when navigator.share() promise settles (resolve or reject). */
export function markShareSheetSettled(): void {
  if (!pending) return;
  pending.sheetSettled = true;
  // Do NOT show confirm here — wait for gates (away + time + visible)
  startEligibilityPoll();
}

/** @deprecated use trackShareAwaitingConfirm */
export function trackIntentShareOpened(payload: {
  platform: string;
  referrer_code: string;
  referral_link: string;
  ab_variant?: 'a' | 'b';
}): void {
  trackShareAwaitingConfirm({ ...payload, sheetSettled: true });
}

function ensureVisibilityListener(): void {
  if (visibilityBound || typeof document === 'undefined') return;
  visibilityBound = true;

  document.addEventListener('visibilitychange', () => {
    markAwayTick();
    if (document.visibilityState === 'visible' && pending) {
      // User returned — only present if gates pass
      window.setTimeout(() => {
        if (pending && canShowConfirmBanner()) showConfirmBanner();
        refreshConfirmYesState();
      }, 300);
    } else if (document.visibilityState === 'hidden') {
      // Hide confirm if it somehow showed under the sheet
      hideConfirmBanner();
    }
  });

  window.addEventListener('blur', () => {
    if (leftHiddenAt == null && document.visibilityState !== 'hidden') {
      // blur without hide (some desktop share UIs)
      leftHiddenAt = Date.now();
    }
  });
  window.addEventListener('focus', () => {
    markAwayTick();
    if (leftHiddenAt != null && document.visibilityState === 'visible') {
      totalAwayMs += Date.now() - leftHiddenAt;
      leftHiddenAt = null;
      if (totalAwayMs >= MIN_AWAY_MS) wasAwayLongEnough = true;
    }
    if (pending && canShowConfirmBanner()) {
      window.setTimeout(() => {
        if (pending && canShowConfirmBanner()) showConfirmBanner();
        refreshConfirmYesState();
      }, 300);
    }
  });
}

function hideConfirmBanner(): void {
  document.getElementById('share-confirm-banner')?.classList.add('hidden');
}

function platformLabel(platform: string): string {
  const p = platform.toLowerCase();
  if (p === 'native') return 'the share sheet';
  if (p.includes('whatsapp')) return 'WhatsApp';
  if (p === 'sms') return 'SMS / Messages';
  if (p === 'x' || p === 'twitter') return 'X';
  if (p === 'telegram') return 'Telegram';
  if (p === 'facebook') return 'Facebook';
  if (p === 'linkedin') return 'LinkedIn';
  if (p === 'reddit') return 'Reddit';
  if (p === 'email') return 'email';
  return 'that app';
}

function formatWait(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${s}s`;
}

function refreshConfirmYesState(): void {
  const yes = document.querySelector<HTMLButtonElement>('[data-share-confirm-yes]');
  const waitHint = document.querySelector<HTMLElement>('[data-share-confirm-wait]');
  if (!pending) return;

  const elapsed = Date.now() - pending.openedAt;
  const ok = canConfirmYes();
  if (yes) {
    yes.disabled = !ok;
    yes.classList.toggle('opacity-40', !ok);
    yes.classList.toggle('cursor-not-allowed', !ok);
    yes.textContent = ok
      ? 'Yes — I sent it'
      : `One moment… ${formatWait(Math.max(0, MIN_ELAPSED_BEFORE_YES_MS - elapsed))}`;
  }
  if (waitHint) {
    if (ok) {
      waitHint.textContent =
        'Nice. Confirm if you sent your link — a friend still must Get my link to lock.';
      waitHint.classList.remove('text-amber-200/90');
      waitHint.classList.add('text-emerald-300/90');
    } else {
      const needAway = !wasAwayLongEnough && totalAwayMs < MIN_AWAY_MS;
      if (elapsed < MIN_ELAPSED_BEFORE_YES_MS) {
        waitHint.textContent = 'Almost ready — send in your app, then come back.';
      } else if (needAway) {
        waitHint.textContent =
          'Open your share app, send the link, then return here (quick).';
      } else {
        waitHint.textContent = 'Almost ready…';
      }
      waitHint.classList.add('text-amber-200/90');
      waitHint.classList.remove('text-emerald-300/90');
    }
  }
}

function maybeShowWaitingChip(): void {
  if (!pending || canShowConfirmBanner()) {
    // If banner can show, chip is secondary
    return;
  }
  let chip = document.getElementById('share-still-pending-chip');
  if (!chip) {
    chip = document.createElement('button');
    chip.id = 'share-still-pending-chip';
    (chip as HTMLButtonElement).type = 'button';
    chip.className =
      'share-still-pending-chip fixed z-[850] left-1/2 -translate-x-1/2 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] px-4 py-2.5 rounded-full border border-amber-400/50 bg-amber-500/95 text-zinc-950 text-sm font-bold shadow-lg shadow-amber-900/30';
    chip.setAttribute('aria-label', 'Share still pending');
    chip.addEventListener('click', () => {
      if (!pending) {
        showToast('Open Share now, send your link, then return here', 'info');
        return;
      }
      if (canShowConfirmBanner()) showConfirmBanner();
      else {
        const elapsed = Date.now() - pending.openedAt;
        const left = Math.max(0, MIN_ELAPSED_BEFORE_YES_MS - elapsed);
        showToast(
          wasAwayLongEnough || totalAwayMs >= MIN_AWAY_MS
            ? `Still pending — wait ${formatWait(left)} before you can confirm`
            : 'Still pending — send your link in another app, then return here',
          'info',
        );
      }
    });
    document.body.appendChild(chip);
  }
  const elapsed = Date.now() - pending.openedAt;
  const left = Math.max(0, MIN_ELAPSED_BEFORE_SHOW_MS - elapsed);
  chip.textContent =
    left > 0
      ? `Send your link… (${formatWait(left)})`
      : 'Come back after you send';
  chip.classList.remove('hidden');
}

/** Only shows when anti-cheat gates pass (never on top of open share sheet). */
export function showConfirmBanner(): void {
  if (!pending) return;
  if (!canShowConfirmBanner()) {
    maybeShowWaitingChip();
    return;
  }

  let banner = document.getElementById('share-confirm-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'share-confirm-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'share-confirm-title');
    banner.className =
      'share-confirm-banner fixed inset-x-0 bottom-0 z-[900] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]';
    banner.innerHTML = `
      <div class="share-confirm-banner__card max-w-lg mx-auto rounded-2xl border border-emerald-400/35 bg-zinc-950/95 backdrop-blur-md px-4 py-3.5 shadow-2xl shadow-black/40">
        <p id="share-confirm-title" class="text-sm font-bold text-emerald-50 leading-snug">Did you send your link?</p>
        <p data-share-confirm-sub class="text-[11px] text-zinc-400 mt-1 leading-snug">
          Simple rule: a friend must open your link and tap Get my link. That locks it. Copying alone never locks. Sharing can add extra time.
        </p>
        <p data-share-confirm-wait class="text-[11px] text-amber-200/90 mt-1.5 font-medium">Checking…</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <button type="button" data-share-confirm-yes
            class="flex-1 min-w-[8rem] py-2.5 px-3 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled>
            Yes — I sent it
          </button>
          <button type="button" data-share-confirm-no
            class="flex-1 min-w-[8rem] py-2.5 px-3 rounded-xl font-semibold text-sm text-zinc-200 bg-white/10 hover:bg-white/15 border border-white/15">
            Not yet
          </button>
        </div>
      </div>`;
    document.body.appendChild(banner);

    banner.querySelector('[data-share-confirm-yes]')?.addEventListener('click', () => {
      void confirmIntentShareSent();
    });
    banner.querySelector('[data-share-confirm-no]')?.addEventListener('click', () => {
      dismissIntentShareConfirm();
    });
  }

  const sub = banner.querySelector('[data-share-confirm-sub]');
  if (sub && pending) {
    if (isNativeSharePlatform(pending.platform)) {
      sub.textContent =
        'Great if you picked an app. Confirm after you send — lock still needs a friend to Get my link.';
    } else {
      sub.textContent = `If you sent via ${platformLabel(pending.platform)}, confirm below. Lock still needs a friend to Get my link.`;
    }
  }
  banner.classList.remove('hidden');
  document.getElementById('share-still-pending-chip')?.classList.add('hidden');
  refreshConfirmYesState();
}

/**
 * User acknowledged they shared. Does NOT lock — only first real referral locks.
 * Logs share analytics / grace; clears the confirm dialog.
 */
export async function confirmIntentShareSent(): Promise<void> {
  const p = pending;
  if (!p) {
    hideConfirmBanner();
    return;
  }
  if (!canConfirmYes()) {
    showToast('Almost — send your link, then come back for a second', 'info');
    refreshConfirmYesState();
    return;
  }

  clearPendingIntentShare();

  // Analytics + optional grace only — never lock on self-report
  const { recordShareEvent } = await import('./record-share');
  recordShareEvent({
    platform: p.platform,
    referrer_code: p.referrer_code,
    referral_link: p.referral_link,
    ab_variant: p.ab_variant,
  });

  showToast(
    'Sent! Your link locks when a friend taps Get my link. Sharing can add time.',
    'success',
  );
  void import('./funnel-guide')
    .then((m) => m.onFunnelShareComplete?.())
    .catch(() => {});
}

function showStillPendingChip(): void {
  document.documentElement.setAttribute('data-vr-confirm-dismissed', '1');
  document.documentElement.setAttribute('data-vr-share-pending', '1');

  const status = document.getElementById('share-first-status');
  if (status) {
    status.dataset.status = 'pending';
    status.textContent =
      'Keep going — send your link. It locks when a friend taps Get my link.';
  }

  const pill = document.getElementById('share-deadline-status-pill');
  if (pill) {
    pill.classList.remove('hidden');
    pill.dataset.status = 'pending';
    pill.textContent = 'Still pending';
  }

  maybeShowWaitingChip();
  const chip = document.getElementById('share-still-pending-chip');
  if (chip) {
    chip.textContent = 'Send a friend, then come back';
    chip.classList.remove('hidden');
  }

  document.getElementById('share-deadline-banner')?.classList.add('share-deadline-banner--urgent');
}

export function dismissIntentShareConfirm(): void {
  hideConfirmBanner();
  showStillPendingChip();
  showToast(
    'Still pending — link NOT locked. Send your link, come back, wait for confirm to unlock.',
    'info',
  );
  startEligibilityPoll();
}
