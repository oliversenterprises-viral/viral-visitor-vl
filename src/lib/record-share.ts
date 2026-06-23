import { supabase } from './supabase';

export interface RecordSharePayload {
  platform: string;
  referrer_code: string;
  referral_link: string;
}

/** Best-effort server log when a user shares or copies their referral link. */
export function recordShareEvent(payload: RecordSharePayload): void {
  if (!payload.referrer_code || !payload.referral_link) return;

  supabase.functions
    .invoke('record-share', {
      body: {
        platform: payload.platform,
        referrer_code: payload.referrer_code,
        referral_link: payload.referral_link,
      },
    })
    .catch(() => {});
}