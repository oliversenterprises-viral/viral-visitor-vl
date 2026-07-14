import { supabase } from './supabase';
import { applyGraceDeadlineFromServer, isVerifiedSharePlatform } from './share-deadline';

export interface RecordSharePayload {
  platform: string;
  referrer_code: string;
  referral_link: string;
  /** A/B message variant active at share time (wave 6). */
  ab_variant?: 'a' | 'b';
}

export interface RecordShareOptions {
  /**
   * @deprecated Self-confirm no longer locks. Lock is only first real referral.
   * Kept for call-site compatibility; ignored for locking.
   */
  confirmLock?: boolean;
}

/**
 * Best-effort server log when a user shares or copies their referral link.
 * Never locks the deadline. Verified share paths may earn server-side grace time.
 */
export function recordShareEvent(
  payload: RecordSharePayload,
  _options: RecordShareOptions = {},
): void {
  if (!payload.referrer_code || !payload.referral_link) return;

  supabase.functions
    .invoke('record-share', {
      body: {
        platform: payload.platform,
        referrer_code: payload.referrer_code,
        referral_link: payload.referral_link,
        ab_variant: payload.ab_variant,
      },
    })
    .then((res) => {
      const body = res.data as {
        grace_extended?: boolean;
        deadline_at?: string | null;
      } | null;
      if (body?.grace_extended && body.deadline_at) {
        applyGraceDeadlineFromServer(body.deadline_at);
      } else if (
        isVerifiedSharePlatform(payload.platform) &&
        body &&
        !body.grace_extended
      ) {
        // silent — max grace already used or not pending
      }
    })
    .catch(() => {});
}
