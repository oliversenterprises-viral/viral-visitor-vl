/**
 * Client: 24h verified-share deadline for referral links.
 * Clipboard-only does NOT count — visitor must share on a real platform.
 */

import { supabase } from './supabase';
import { showToast } from '../ui';

const STORAGE_KEY = 'vr_share_deadline_v1';
export const SHARE_DEADLINE_MS = 24 * 60 * 60 * 1000;

const NON_VERIFIED = new Set(['copy', 'copy-message', 'embed', 'other', '']);

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

export function isVerifiedSharePlatform(platform: string): boolean {
  return !NON_VERIFIED.has(normalizePlatform(platform));
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

/** Register code on the server (starts the 24h clock). */
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
      return fallback;
    }
    const envelope = data as {
      success?: boolean;
      data?: {
        status?: string;
        created_at?: string | null;
        deadline_at?: string | null;
      };
      error?: string;
    };

    const status = (envelope?.data?.status || 'pending_share') as ShareDeadlineStatus;
    if (status === 'expired') {
      clearShareDeadlineState();
      return {
        code: referrer_code,
        status: 'expired',
        createdAt: envelope?.data?.created_at || fallback.createdAt,
        deadlineAt: envelope?.data?.deadline_at || fallback.deadlineAt,
      };
    }

    const state: ShareDeadlineState = {
      code: referrer_code,
      status: status === 'active' ? 'active' : status === 'unknown' ? 'pending_share' : status,
      createdAt: envelope?.data?.created_at || fallback.createdAt,
      deadlineAt: envelope?.data?.deadline_at || fallback.deadlineAt,
    };
    writeShareDeadlineState(state);
    return state;
  } catch {
    writeShareDeadlineState(fallback);
    return fallback;
  }
}

/** Call when a verified share platform succeeds client-side. */
export function markLocalVerifiedShare(platform: string): void {
  if (!isVerifiedSharePlatform(platform)) return;
  const cur = readShareDeadlineState();
  if (!cur) return;
  writeShareDeadlineState({ ...cur, status: 'active' });
  renderShareDeadlineBanner();
}

/**
 * If the local clock says expired and never verified-shared, wipe local identity.
 * Returns true when the code was purged.
 */
export function enforceLocalShareDeadlineExpiry(myCode: string | null): boolean {
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
  showToast(
    'Link removed — you did not share within 24 hours. Get a new link and share it to stay in the system.',
    'info',
  );
  renderShareDeadlineBanner();
  return true;
}

export function renderShareDeadlineBanner(): void {
  const banner = document.getElementById('share-deadline-banner');
  const countdown = document.getElementById('share-deadline-countdown');
  const title = document.getElementById('share-deadline-title');
  if (!banner) return;

  const state = readShareDeadlineState();
  if (!state || state.status === 'active') {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  const ms = msUntilDeadline(state);

  if (state.status === 'expired' || ms <= 0) {
    if (title) {
      title.textContent =
        'Link expired — not shared within 24 hours. Get a new link and share it to rejoin.';
    }
    if (countdown) countdown.textContent = 'Expired';
    banner.classList.add('share-deadline-banner--expired');
    banner.classList.remove('share-deadline-banner--urgent');
    return;
  }

  banner.classList.remove('share-deadline-banner--expired');
  if (ms < 4 * 60 * 60 * 1000) banner.classList.add('share-deadline-banner--urgent');
  else banner.classList.remove('share-deadline-banner--urgent');

  if (title) {
    title.textContent =
      'Share this link within 24 hours or it is removed from the system (clipboard alone does not count).';
  }
  if (countdown) countdown.textContent = formatDeadlineCountdown(ms);
}

let countdownTimer: ReturnType<typeof setInterval> | null = null;

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
}
