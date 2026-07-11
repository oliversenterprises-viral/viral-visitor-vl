import { supabase } from './supabase';
import { isVerifiedSharePlatform, markLocalVerifiedShare } from './share-deadline';

export interface RecordSharePayload {
  platform: string;
  referrer_code: string;
  referral_link: string;
  /** A/B message variant active at share time (wave 6). */
  ab_variant?: 'a' | 'b';
}

/** Best-effort server log when a user shares or copies their referral link. */
export function recordShareEvent(payload: RecordSharePayload): void {
  if (!payload.referrer_code || !payload.referral_link) return;

  // Verified platforms (not clipboard) clear the 24h removal clock locally
  if (isVerifiedSharePlatform(payload.platform)) {
    markLocalVerifiedShare(payload.platform);
  }

  supabase.functions
    .invoke('record-share', {
      body: {
        platform: payload.platform,
        referrer_code: payload.referrer_code,
        referral_link: payload.referral_link,
        ab_variant: payload.ab_variant,
      },
    })
    .catch(() => {});
}