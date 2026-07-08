/**
 * Live arena pulse — subtle toasts when global referrals/shares happen (social proof dopamine).
 */

import { showToast } from '../ui';
import { formatSharePlatformLabel, type PublicActivityRow } from './public-activity';

const PULSE_COOLDOWN_MS = 8000;
let lastPulseAt = 0;

function escapeDisplay(code: string): string {
  const c = code.trim().toUpperCase();
  return c.length > 14 ? `${c.slice(0, 13)}…` : c;
}

/** Show a lightweight toast for live global activity (rate-limited). */
export function maybePulseArenaActivity(
  row: PublicActivityRow,
  now = Date.now(),
): void {
  if (now - lastPulseAt < PULSE_COOLDOWN_MS) return;
  lastPulseAt = now;

  const code = escapeDisplay(row.referrer_code || 'someone');

  if (row.kind === 'share') {
    const platform = formatSharePlatformLabel(row.platform);
    showToast(`⚡ ${code} shared on ${platform}`, 'info');
    return;
  }

  if (row.kind === 'rank_move' && row.new_rank != null) {
    if (row.new_rank === 1) {
      showToast(`👑 ${code} just hit #1!`, 'info');
    } else {
      showToast(`📈 ${code} climbed to #${row.new_rank}`, 'info');
    }
    return;
  }

  if (row.kind === 'referral') {
    showToast(`🎯 New referral credited to ${code}`, 'info');
  }
}

/** Build a pulse row from realtime referral insert. */
export function arenaRowFromReferralInsert(
  referrerCode: string,
  createdAt?: string,
): PublicActivityRow {
  return {
    kind: 'referral',
    referrer_code: referrerCode,
    created_at: createdAt || new Date().toISOString(),
  };
}

/** Build a pulse row from realtime share insert. */
export function arenaRowFromShareInsert(
  referrerCode: string,
  platform: string,
  createdAt?: string,
): PublicActivityRow {
  return {
    kind: 'share',
    referrer_code: referrerCode,
    platform,
    created_at: createdAt || new Date().toISOString(),
  };
}