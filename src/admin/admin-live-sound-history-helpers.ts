/**
 * Pure helpers — admin funnel sound alert history (persisted in localStorage).
 */

import type { AdminLiveEvent } from './admin-live-helpers';
import type { AdminLiveSoundProfile } from './admin-live-sound-helpers';

export const ADMIN_LIVE_SOUND_HISTORY_KEY = 'vr_admin_live_sound_history';
export const ADMIN_LIVE_SOUND_HISTORY_PANEL_KEY = 'vr_admin_sound_history_open';
export const ADMIN_LIVE_SOUND_HISTORY_MAX = 120;

export interface AdminLiveSoundHistoryEntry {
  id: string;
  playedAt: string;
  profile: AdminLiveSoundProfile;
  kind: string;
  label: string;
  detail: string;
  funnelStep?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const PROFILE_LABEL: Record<AdminLiveSoundProfile, string> = {
  funnel: 'Funnel',
  referral: 'Referral',
  share: 'Share',
  claim: 'Claim',
};

/** Build a history row when a chime actually plays. */
export function buildSoundHistoryEntry(
  ev: AdminLiveEvent,
  profile: AdminLiveSoundProfile,
  playedAt: string,
): AdminLiveSoundHistoryEntry {
  return {
    id: `${playedAt}-${ev.id}-${profile}`,
    playedAt,
    profile,
    kind: ev.kind,
    label: ev.label,
    detail: ev.detail,
    funnelStep: ev.funnelStep,
  };
}

/** Prepend entry, dedupe by id, cap list. */
export function appendSoundHistoryEntry(
  entries: readonly AdminLiveSoundHistoryEntry[],
  entry: AdminLiveSoundHistoryEntry,
  max = ADMIN_LIVE_SOUND_HISTORY_MAX,
): AdminLiveSoundHistoryEntry[] {
  const next = [entry, ...entries.filter((e) => e.id !== entry.id)];
  return next.slice(0, max);
}

/** Locale-friendly timestamp for later lookup. */
export function formatSoundHistoryTimestamp(
  iso: string,
  now = Date.now(),
  locale?: string,
): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const loc = locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  const diffMs = now - ts;
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 86_400_000) {
    return new Date(iso).toLocaleTimeString(loc, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return new Date(iso).toLocaleString(loc, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function buildSoundHistoryHtml(
  entries: readonly AdminLiveSoundHistoryEntry[],
  now = Date.now(),
  emptyMessage = 'No sound alerts yet — chimes appear here when funnel steps fire.',
): string {
  if (!entries.length) {
    return `<div class="admin-sound-history-empty text-[10px] text-zinc-500 py-2">${escapeHtml(emptyMessage)}</div>`;
  }

  return entries
    .map((row, i) => {
      const fresh = i === 0 ? ' admin-sound-history-row--fresh' : '';
      const profile = PROFILE_LABEL[row.profile];
      const step =
        row.funnelStep && row.profile === 'funnel'
          ? ` · ${escapeHtml(row.funnelStep)}`
          : '';
      return `
        <div class="admin-sound-history-row${fresh}" data-sound-history-id="${escapeHtml(row.id)}">
          <span class="admin-sound-history-time tabular-nums">${formatSoundHistoryTimestamp(row.playedAt, now)}</span>
          <span class="admin-sound-history-profile admin-sound-history-profile--${row.profile}">${escapeHtml(profile)}</span>
          <span class="admin-sound-history-label">${escapeHtml(row.label)}${step}</span>
          <span class="admin-sound-history-detail font-mono">${escapeHtml(row.detail)}</span>
        </div>`;
    })
    .join('');
}

export function parseSoundHistoryJson(raw: string | null): AdminLiveSoundHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is AdminLiveSoundHistoryEntry => {
        if (!row || typeof row !== 'object') return false;
        const r = row as AdminLiveSoundHistoryEntry;
        return (
          typeof r.id === 'string' &&
          typeof r.playedAt === 'string' &&
          typeof r.profile === 'string' &&
          typeof r.label === 'string'
        );
      })
      .slice(0, ADMIN_LIVE_SOUND_HISTORY_MAX);
  } catch {
    return [];
  }
}