/**
 * Share abandon rescue — make post–get-link sharing hard to ignore or skip.
 *
 * When a visitor has a link but has not locked it (friend Get my link),
 * intercept leave/idle paths with a high-attention panel that funnels
 * them back to the primary send action.
 *
 * White-hat: no dark patterns that trap forever; limited soft dismisses
 * per session; never blocks accessibility or breaks locked/embed flows.
 */

import { isEmbedMode } from './embed-mode';
import { isSharePendingLocal } from './share-first-ui';
import { t } from './i18n';

const SESSION_SHOWS_KEY = 'vr_share_abandon_shows';
const SESSION_SNOOZE_KEY = 'vr_share_abandon_snooze';
const PANEL_ID = 'vr-share-abandon';

/** Soft dwell before first abandon prompt (desktop). */
export const MIN_DWELL_MS = 8_000;
/** Mobile dwell without a send attempt. */
export const MOBILE_DWELL_MS = 18_000;
/** Soft snooze after "I'll send later". */
export const SOFT_SNOOZE_MS = 3 * 60 * 1000;
/** Max full panels per tab session. */
export const MAX_SESSION_SHOWS = 4;
/** Re-check interval while pending. */
export const POLL_MS = 45_000;
/** Min time away before return-prompt. */
export const MIN_AWAY_RETURN_MS = 6_000;

export interface ShareAbandonEligibility {
  hasLink: boolean;
  sharePending: boolean;
  locked: boolean;
  alreadyMaxShows: boolean;
  snoozed: boolean;
  dwellMs: number;
  isCoarsePointer: boolean;
  embed: boolean;
  confirmFlowActive: boolean;
}

export function shouldShowShareAbandon(opts: ShareAbandonEligibility): boolean {
  if (opts.embed || opts.locked || !opts.hasLink || !opts.sharePending) return false;
  if (opts.alreadyMaxShows || opts.snoozed || opts.confirmFlowActive) return false;
  if (opts.isCoarsePointer) return opts.dwellMs >= MOBILE_DWELL_MS;
  return opts.dwellMs >= MIN_DWELL_MS;
}

export function buildShareAbandonMessage(): {
  title: string;
  body: string;
  cta: string;
  later: string;
} {
  return {
    title: t('share_abandon.title'),
    body: t('share_abandon.body'),
    cta: t('share_abandon.cta'),
    later: t('share_abandon.later'),
  };
}

function sessionShows(): number {
  try {
    const n = parseInt(sessionStorage.getItem(SESSION_SHOWS_KEY) || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function bumpShows(): void {
  try {
    sessionStorage.setItem(SESSION_SHOWS_KEY, String(sessionShows() + 1));
  } catch {
    /* non-fatal */
  }
}

function isSnoozed(now = Date.now()): boolean {
  try {
    const until = parseInt(sessionStorage.getItem(SESSION_SNOOZE_KEY) || '0', 10);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

export function softSnoozeShareAbandon(ms = SOFT_SNOOZE_MS, now = Date.now()): void {
  try {
    sessionStorage.setItem(SESSION_SNOOZE_KEY, String(now + ms));
  } catch {
    /* non-fatal */
  }
}

function hasLink(): boolean {
  return (
    document.documentElement.hasAttribute('data-vr-has-link') ||
    !!(document.getElementById('ref-link') as HTMLInputElement | null)?.value?.trim()
  );
}

function isLocked(): boolean {
  return document.documentElement.hasAttribute('data-vr-share-locked');
}

function confirmFlowActive(): boolean {
  const banner = document.getElementById('share-confirm-banner');
  if (banner && !banner.classList.contains('hidden')) return true;
  return document.documentElement.hasAttribute('data-vr-share-confirm');
}

function removePanel(): void {
  document.getElementById(PANEL_ID)?.remove();
  document.documentElement.removeAttribute('data-vr-share-abandon');
}

function invokeSend(): void {
  try {
    sessionStorage.setItem('vr_get_link_via', 'share_abandon_rescue');
  } catch {
    /* non-fatal */
  }
  const g = window as Window & { invokeShareFirstPrimary?: () => void };
  if (typeof g.invokeShareFirstPrimary === 'function') {
    g.invokeShareFirstPrimary();
    return;
  }
  void import('./share-first-ui')
    .then((m) => m.invokeShareFirstPrimary())
    .catch(() => {
      const el =
        document.getElementById('native-share-btn') ||
        document.getElementById('share-first-sms') ||
        document.getElementById('share-first-whatsapp');
      el?.click();
    });
}

function showAbandonPanel(reason: string): void {
  if (document.getElementById(PANEL_ID)) return;
  if (
    !shouldShowShareAbandon({
      hasLink: hasLink(),
      sharePending: isSharePendingLocal(),
      locked: isLocked(),
      alreadyMaxShows: sessionShows() >= MAX_SESSION_SHOWS,
      snoozed: isSnoozed(),
      dwellMs: Number.MAX_SAFE_INTEGER,
      isCoarsePointer: false,
      embed: isEmbedMode(),
      confirmFlowActive: confirmFlowActive(),
    })
  ) {
    return;
  }

  const copy = buildShareAbandonMessage();
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'vr-share-abandon';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'vr-share-abandon-title');
  panel.dataset.reason = reason;
  panel.innerHTML = `
    <div class="vr-share-abandon-backdrop" data-abandon-backdrop></div>
    <div class="vr-share-abandon-card">
      <div class="vr-share-abandon-pulse" aria-hidden="true"></div>
      <p id="vr-share-abandon-title" class="vr-share-abandon-title">${copy.title}</p>
      <p class="vr-share-abandon-body">${copy.body}</p>
      <div class="vr-share-abandon-actions">
        <button type="button" class="vr-share-abandon-cta" data-abandon-cta>
          <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
          ${copy.cta}
        </button>
        <button type="button" class="vr-share-abandon-later" data-abandon-later>${copy.later}</button>
      </div>
      <p class="vr-share-abandon-rule">${t('rule.public')}</p>
    </div>
  `;

  document.body.appendChild(panel);
  document.documentElement.setAttribute('data-vr-share-abandon', reason);
  bumpShows();

  const closeSoft = () => {
    softSnoozeShareAbandon();
    removePanel();
  };

  panel.querySelector('[data-abandon-cta]')?.addEventListener('click', () => {
    removePanel();
    // Brief snooze so re-open mid-sheet doesn't stack
    softSnoozeShareAbandon(45_000);
    invokeSend();
  });
  panel.querySelector('[data-abandon-later]')?.addEventListener('click', closeSoft);
  // Backdrop does NOT dismiss — hard to skip; only explicit Later
  panel.querySelector('[data-abandon-backdrop]')?.addEventListener('click', () => {
    panel.querySelector<HTMLElement>('.vr-share-abandon-card')?.classList.add('vr-share-abandon-shake');
    window.setTimeout(() => {
      panel.querySelector('.vr-share-abandon-card')?.classList.remove('vr-share-abandon-shake');
    }, 420);
  });
}

function tryShow(reason: string, startedAt: number, coarse: boolean): void {
  if (document.getElementById(PANEL_ID)) return;
  if (
    !shouldShowShareAbandon({
      hasLink: hasLink(),
      sharePending: isSharePendingLocal(),
      locked: isLocked(),
      alreadyMaxShows: sessionShows() >= MAX_SESSION_SHOWS,
      snoozed: isSnoozed(),
      dwellMs: Date.now() - startedAt,
      isCoarsePointer: coarse,
      embed: isEmbedMode(),
      confirmFlowActive: confirmFlowActive(),
    })
  ) {
    return;
  }
  showAbandonPanel(reason);
}

/** Browser leave dialog while share still pending (soft; browsers control copy). */
function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (isEmbedMode()) return;
  if (!hasLink() || isLocked() || !isSharePendingLocal()) return;
  // Don't nag mid native/intent confirm
  if (confirmFlowActive()) return;
  e.preventDefault();
  e.returnValue = '';
}

/**
 * Bootstrap abandon rescue (idempotent).
 * Call after get-link / send-mode, and on return visits with pending share.
 */
export function initShareAbandonRescue(win: Window = window): void {
  if (isEmbedMode(win.location) || win.document.documentElement.dataset.vrShareAbandonBound === '1') {
    return;
  }
  win.document.documentElement.dataset.vrShareAbandonBound = '1';

  const started = Date.now();
  const coarse = win.matchMedia('(pointer: coarse)').matches;
  let leftHiddenAt: number | null = null;

  if (!coarse) {
    win.document.addEventListener('mouseout', (e: MouseEvent) => {
      if (e.clientY > 12 || e.relatedTarget != null) return;
      tryShow('exit', started, coarse);
    });
  } else {
    win.setTimeout(() => tryShow('dwell', started, coarse), MOBILE_DWELL_MS);
  }

  win.document.addEventListener('visibilitychange', () => {
    if (win.document.visibilityState === 'hidden') {
      leftHiddenAt = Date.now();
      return;
    }
    if (leftHiddenAt != null && Date.now() - leftHiddenAt >= MIN_AWAY_RETURN_MS) {
      tryShow('return', started, coarse);
    }
    leftHiddenAt = null;
  });

  win.addEventListener('beforeunload', onBeforeUnload);

  // Periodic re-surface if they scroll past and ignore sticky CTA
  win.setInterval(() => {
    if (!hasLink() || isLocked() || !isSharePendingLocal()) {
      removePanel();
      return;
    }
    tryShow('poll', started, coarse);
  }, POLL_MS);

  // Clear panel when locked
  const obs = new MutationObserver(() => {
    if (isLocked() || !isSharePendingLocal()) removePanel();
  });
  obs.observe(win.document.documentElement, {
    attributes: true,
    attributeFilter: ['data-vr-share-locked', 'data-vr-share-pending', 'data-vr-has-link'],
  });
}

/** Force show (tests / debug). Respects eligibility. */
export function forceShareAbandonForTest(reason = 'test'): void {
  showAbandonPanel(reason);
}

export function resetShareAbandonSessionForTest(): void {
  try {
    sessionStorage.removeItem(SESSION_SHOWS_KEY);
    sessionStorage.removeItem(SESSION_SNOOZE_KEY);
  } catch {
    /* ignore */
  }
  removePanel();
  if (typeof document !== 'undefined') {
    delete document.documentElement.dataset.vrShareAbandonBound;
  }
}
