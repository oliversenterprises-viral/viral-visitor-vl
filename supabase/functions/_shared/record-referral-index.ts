/**
 * Production wiring extracted from record-referral/index.ts (testable without Deno.serve).
 */

import { createRecordReferralServeHandler, type RecordReferralDeps } from './record-referral-serve.ts';

export type RecordReferralEnv = {
  get(key: string): string | undefined;
};

/** Turnstile verify — same logic as record-referral/index.ts verifyTurnstile. */
export async function verifyTurnstileForRecordReferral(
  token: string,
  ip: string,
  env: RecordReferralEnv,
): Promise<{ success: boolean; error?: string }> {
  const secret = env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('[record-referral] TURNSTILE_SECRET_KEY not configured');
    return { success: false, error: 'Server configuration error' };
  }

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip && ip !== 'unknown') formData.append('remoteip', ip);

  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });
    const outcome = await result.json();

    if (outcome.success === true) return { success: true };

    return {
      success: false,
      error: Array.isArray(outcome['error-codes'])
        ? outcome['error-codes'].join(', ')
        : 'verification_failed',
    };
  } catch (err) {
    console.error('[record-referral] Turnstile fetch error:', err);
    return { success: false, error: 'verification_unavailable' };
  }
}

/** Handler factory used by record-referral/index.ts: Deno.serve(createRecordReferralIndexHandler(deps)). */
export function createRecordReferralIndexHandler(deps: RecordReferralDeps) {
  return createRecordReferralServeHandler(deps);
}

/** Build deps from Deno.env + injected supabase admin client (index.ts passes createClient result). */
export function buildRecordReferralIndexDeps(
  env: RecordReferralEnv,
  supabaseAdmin: RecordReferralDeps['supabaseAdmin'],
): RecordReferralDeps {
  return {
    verifyTurnstile: (token, ip) => verifyTurnstileForRecordReferral(token, ip, env),
    supabaseAdmin,
  };
}