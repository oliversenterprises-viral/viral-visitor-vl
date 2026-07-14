/**
 * Client: first-friend lock deadline for referral links.
 * Public rule: friend must Get my link to lock · share can add time · copy never locks.
 * Base window 48h; share attempts may extend grace on the server.
 */

import { supabase } from './supabase';
import { showToast } from '../ui';
import { t } from './i18n';

const STORAGE_KEY = 'vr_share_deadline_v1';
/** Match server base window (48h to land first referral). */
export const SHARE_DEADLINE_MS = 48 * 60 * 60 * 1000;
const URGENT_MS = 6 * 60 * 60 * 1000;
let statusPollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Never locks the 24h rule — clipboard, downloads, or non-send actions.
 * Keep in sync with edge `_shared/referrer-share-deadline.ts`.
 */
const NON_VERIFIED = new Set([
  'copy',
  'copy-message',
  'copy-code',
  'embed',
  'markdown',
  'other',
  '',
  // Clipboard-only “share” buttons (message copied, not sent)
  'discord',
  'tiktok',
  'snapchat',
  // Image download helpers — not proof of a real send
  'story-image',
  'x-image',
  'share-pack',
  'winner-pack',
]);

/** Platforms that open an external intent (need user confirm to lock). */
const INTENT_PLATFORMS = new Set([
  'whatsapp',
  'boost-whatsapp',
  'sms',
  'twitter',
  'x',
  'linkedin',
  'facebook',
  'telegram',
  'email',
  'reddit',
  'bluesky',
  'threads',
  'pinterest',
]);

export type ShareDeadlineStatus = 'pending_share' | 'active' | 'expired' | 'unknown';

export interface ShareDeadlineState {
  code: string;
  status: ShareDeadlineStatus;
  createdAt: string;
  deadlineAt: string;
}

function normalizePlatform(raw: string): string {
  const p = String(raw || '').toLowerCase().trim();
  if (p === 'x') return 'twitter';
  return p;
}

/** True if platform *can* count toward lock when a real send is confirmed. */
export function isVerifiedSharePlatform(platform: string): boolean {
  return !NON_VERIFIED.has(normalizePlatform(platform));
}

/** External intent (WhatsApp, SMS, X, …) — open alone does not lock. */
export function isIntentSharePlatform(platform: string): boolean {
  const p = normalizePlatform(platform);
  if (p === 'native') return false;
  if (NON_VERIFIED.has(p)) return false;
  if (INTENT_PLATFORMS.has(p)) return true;
  // boost-* and unknown social intents
  if (p.startsWith('boost-')) return true;
  return false;
}

/** Native Web Share API success is enough to lock (user completed the sheet). */
export function isNativeSharePlatform(platform: string): boolean {
  return normalizePlatform(platform) === 'native';
}

export function readShareDeadlineState(): ShareDeadlineState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShareDeadlineState;
    if (!parsed?.code || !parsed?.deadlineAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeShareDeadlineState(state: ShareDeadlineState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearShareDeadlineState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function msUntilDeadline(state: ShareDeadlineState, now = Date.now()): number {
  const end = Date.parse(state.deadlineAt);
  if (!Number.isFinite(end)) return SHARE_DEADLINE_MS;
  return end - now;
}

export function formatDeadlineCountdown(ms: number): string {
  if (ms <= 0) return '0h 0m';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${h}h ${m}m`;
}

function isExemptCode(code?: string | null): boolean {
  try {
    const exempt = localStorage.getItem('vr_share_deadline_exempt');
    if (!exempt) return false;
    if (!code) return true;
    return exempt.toUpperCase() === code.toUpperCase();
  } catch {
    return false;
  }
}

/** Register code on the server (starts the first-referral deadline clock). */
export async function registerReferrerLinkDeadline(
  code: string,
): Promise<ShareDeadlineState | null> {
  const referrer_code = String(code || '').trim().toUpperCase();
  if (!referrer_code) return null;

  const fallback: ShareDeadlineState = {
    code: referrer_code,
    status: 'pending_share',
    createdAt: new Date().toISOString(),
    deadlineAt: new Date(Date.now() + SHARE_DEADLINE_MS).toISOString(),
  };

  try {
    const { data, error } = await supabase.functions.invoke('register-referrer-link', {
      body: { referrer_code },
    });
    if (error) {
      writeShareDeadlineState(fallback);
      renderShareDeadlineBanner();
      return fallback;
    }
    const envelope = data as {
      success?: boolean;
      data?: {
        status?: string;
        created_at?: string | null;
        deadline_at?: string | null;
        share_required?: boolean;
        exempt?: boolean;
        share_grace_count?: number;
      };
      error?: string;
    };

    const status = (envelope?.data?.status || 'pending_share') as ShareDeadlineStatus;
    const exempt =
      envelope?.data?.exempt === true || envelope?.data?.share_required === false;

    // Owner IP / active / exempt: locked (or no clock)
    if (exempt || status === 'active') {
      const wasPending = readShareDeadlineState()?.status === 'pending_share';
      clearShareDeadlineState();
      try {
        if (exempt) localStorage.setItem('vr_share_deadline_exempt', referrer_code);
        else localStorage.removeItem('vr_share_deadline_exempt');
      } catch {
        /* ignore */
      }
      if (status === 'active' && !exempt) {
        writeShareDeadlineState({
          code: referrer_code,
          status: 'active',
          createdAt: envelope?.data?.created_at || fallback.createdAt,
          deadlineAt: envelope?.data?.deadline_at || fallback.deadlineAt,
        });
        // First referral landed while away — celebrate lock once
        if (wasPending || !document.documentElement.hasAttribute('data-vr-share-locked')) {
          markLocalVerifiedShare('first_referral');
        }
      }
      renderShareDeadlineBanner();
      return {
        code: referrer_code,
        status: 'active',
        createdAt: envelope?.data?.created_at || fallback.createdAt,
        deadlineAt: envelope?.data?.deadline_at || fallback.deadlineAt,
      };
    }

    if (status === 'expired') {
      clearShareDeadlineState();
      renderShareDeadlineBanner();
      return {
        code: referrer_code,
        status: 'expired',
        createdAt: envelope?.data?.created_at || fallback.createdAt,
        deadlineAt: envelope?.data?.deadline_at || fallback.deadlineAt,
      };
    }

    try {
      localStorage.removeItem('vr_share_deadline_exempt');
    } catch {
      /* ignore */
    }

    const state: ShareDeadlineState = {
      code: referrer_code,
      status: status === 'unknown' ? 'pending_share' : status,
      createdAt: envelope?.data?.created_at || fallback.createdAt,
      deadlineAt: envelope?.data?.deadline_at || fallback.deadlineAt,
    };
    writeShareDeadlineState(state);
    renderShareDeadlineBanner();
    return state;
  } catch {
    writeShareDeadlineState(fallback);
    renderShareDeadlineBanner();
    return fallback;
  }
}

/**
 * Local UI lock after server activated the link (first referral).
 * Never call from share sheet / self-confirm alone.
 */
export function markLocalVerifiedShare(platform: string): void {
  // first_referral is always allowed; other labels must be verified platforms
  const p = String(platform || '').toLowerCase();
  if (p !== 'first_referral' && !isVerifiedSharePlatform(platform)) return;
  const cur = readShareDeadlineState();
  if (cur) {
    writeShareDeadlineState({ ...cur, status: 'active' });
  } else {
    try {
      const code = localStorage.getItem('vr_my_ref_code');
      if (code) {
        writeShareDeadlineState({
          code: code.toUpperCase(),
          status: 'active',
          createdAt: new Date().toISOString(),
          deadlineAt: new Date().toISOString(),
        });
      }
    } catch {
      /* ignore */
    }
  }
  renderShareDeadlineBanner();
  void import('./share-first-ui')
    .then((m) => m.onVerifiedShareForShareFirst())
    .catch(() => {});
}

/** Apply server grace deadline from record-share response. */
export function applyGraceDeadlineFromServer(deadlineAt: string | null | undefined): void {
  if (!deadlineAt) return;
  const cur = readShareDeadlineState();
  if (!cur || cur.status !== 'pending_share') return;
  writeShareDeadlineState({ ...cur, deadlineAt });
  renderShareDeadlineBanner();
  showToast(t('deadline.grace_extended'), 'success');
}

/**
 * If the local clock says expired and never verified-shared, wipe local identity.
 * Returns true when the code was purged.
 */
export function enforceLocalShareDeadlineExpiry(myCode: string | null): boolean {
  // Owner IP exempt codes never expire client-side
  if (isExemptCode(myCode)) {
    clearShareDeadlineState();
    return false;
  }

  const state = readShareDeadlineState();
  if (!state) return false;
  if (myCode && state.code && state.code.toUpperCase() !== myCode.toUpperCase()) {
    return false;
  }
  if (state.status === 'active') return false;
  if (msUntilDeadline(state) > 0 && state.status !== 'expired') return false;

  try {
    localStorage.removeItem('vr_my_ref_code');
    clearShareDeadlineState();
    localStorage.removeItem('vr_link_ready_at');
    localStorage.removeItem('vr_link_copied_at');
  } catch {
    /* ignore */
  }

  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  if (input) input.value = '';

  document.documentElement.removeAttribute('data-vr-has-link');
  showToast(t('deadline.toast_removed'), 'info');
  renderShareDeadlineBanner();
  return true;
}

export function renderShareDeadlineBanner(): void {
  const banner = document.getElementById('share-deadline-banner');
  const countdown = document.getElementById('share-deadline-countdown');
  const title = document.getElementById('share-deadline-title');
  const preNote = document.getElementById('share-deadline-pre-note');
  const statusPill = document.getElementById('share-deadline-status-pill');
  const timeWrap = document.getElementById('share-deadline-time-wrap');

  const hideEducation = (): void => {
    if (preNote) preNote.classList.add('hidden');
  };
  const showEducation = (): void => {
    if (preNote) {
      preNote.classList.remove('hidden');
      preNote.textContent = t('deadline.pre_rule');
    }
  };

  if (isExemptCode()) {
    if (banner) banner.classList.add('hidden');
    hideEducation();
    return;
  }

  const state = readShareDeadlineState();

  // Active (verified share): truth UI — green locked banner (not silent hide)
  if (state?.status === 'active') {
    showEducation();
    if (preNote) preNote.classList.add('hidden');
    if (!banner) return;
    banner.classList.remove('hidden');
    banner.classList.add('share-deadline-banner--locked');
    banner.classList.remove(
      'share-deadline-banner--urgent',
      'share-deadline-banner--pending',
      'share-deadline-banner--expired',
    );
    if (title) {
      title.textContent = t('deadline.locked');
      title.setAttribute('data-i18n', 'deadline.locked');
    }
    if (countdown) countdown.textContent = '✓';
    if (statusPill) {
      statusPill.textContent = t('deadline.status_locked');
      statusPill.dataset.status = 'locked';
      statusPill.classList.remove('hidden');
    }
    if (timeWrap) {
      const label = timeWrap.querySelector('[data-i18n="deadline.time_left"]');
      if (label) label.textContent = t('deadline.locked_badge');
    }
    return;
  }

  // Everyone else sees the educational rule (i18n)
  showEducation();

  if (!banner) return;

  // No pending state yet — keep countdown banner hidden; pre-note still shows
  if (!state) {
    banner.classList.add('hidden');
    banner.classList.remove('share-deadline-banner--locked');
    if (statusPill) statusPill.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden', 'share-deadline-banner--locked');
  const ms = msUntilDeadline(state);
  const urgent = ms > 0 && ms < URGENT_MS;

  if (statusPill) {
    statusPill.textContent = t('deadline.status_pending');
    statusPill.dataset.status = 'pending';
    statusPill.classList.remove('hidden');
  }
  if (timeWrap) {
    const label = timeWrap.querySelector('[data-i18n="deadline.time_left"]');
    if (label) label.textContent = t('deadline.time_left');
  }

  if (state.status === 'expired' || ms <= 0) {
    if (title) {
      title.textContent = t('deadline.expired');
      title.setAttribute('data-i18n', 'deadline.expired');
    }
    if (countdown) countdown.textContent = t('deadline.countdown_expired');
    banner.classList.add('share-deadline-banner--expired');
    banner.classList.remove(
      'share-deadline-banner--urgent',
      'share-deadline-banner--pending',
      'share-deadline-banner--locked',
    );
    return;
  }

  banner.classList.remove('share-deadline-banner--expired', 'share-deadline-banner--locked');
  banner.classList.add('share-deadline-banner--pending');
  if (urgent) banner.classList.add('share-deadline-banner--urgent');
  else banner.classList.remove('share-deadline-banner--urgent');

  if (title) {
    const key = urgent ? 'deadline.urgent' : 'deadline.pending';
    title.textContent = t(key);
    title.setAttribute('data-i18n', key);
  }
  if (countdown) countdown.textContent = formatDeadlineCountdown(ms);
}

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let localeListenerBound = false;

export function initShareDeadlineUi(): void {
  renderShareDeadlineBanner();
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    const state = readShareDeadlineState();
    if (state && state.status !== 'active' && msUntilDeadline(state) <= 0) {
      const code = (() => {
        try {
          return localStorage.getItem('vr_my_ref_code');
        } catch {
          return null;
        }
      })();
      enforceLocalShareDeadlineExpiry(code);
    } else {
      renderShareDeadlineBanner();
    }
  }, 30_000);

  // Poll server while pending — lock UI when first referral lands (even if tab stayed open)
  if (statusPollTimer) clearInterval(statusPollTimer);
  statusPollTimer = setInterval(() => {
    const state = readShareDeadlineState();
    if (!state || state.status !== 'pending_share') return;
    void registerReferrerLinkDeadline(state.code);
  }, 20_000);

  if (!localeListenerBound && typeof window !== 'undefined') {
    localeListenerBound = true;
    window.addEventListener('vr:locale-change', () => {
      renderShareDeadlineBanner();
    });
  }
}
