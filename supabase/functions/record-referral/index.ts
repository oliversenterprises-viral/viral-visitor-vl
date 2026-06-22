// ============================================================================
// supabase/functions/record-referral/index.ts
// ViralRefer — Record Referral (production schema aligned)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { createRecordReferralServeHandler } from '../_shared/record-referral-serve.ts';

async function verifyTurnstile(token: string, ip: string): Promise<{ success: boolean; error?: string }> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
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

Deno.serve(
  createRecordReferralServeHandler({
    verifyTurnstile,
    supabaseAdmin: createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  }),
);