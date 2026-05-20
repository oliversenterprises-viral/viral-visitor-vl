// ============================================================================
// supabase/functions/record-referral/index.ts
// ViralRefer Premium - Edge Function: Record Referral (Deno / TypeScript)
// First production Edge Function per Sprint 1 approved plan.
// ============================================================================
//
// ROLE: Trusted server-side entrypoint for recording referral events.
//       Performs ALL security checks before any database mutation.
//
// SECURITY (EXACT Sentinel Audit Recommendations followed):
//   - Sentinel Rec #2 & #8: Uses ONLY supabaseAdmin initialized with
//     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'). This bypasses RLS for
//     the INSERT. Never use anon key for writes on referrals table.
//   - Sentinel Rec #6: Turnstile verification (Cloudflare) + IP rate limiting
//     using real client headers (cf-connecting-ip / x-forwarded-for) before
//     any DB write.
//   - Sentinel Rec #5 & self-refer check: Auth-aware self-referral prevention.
//     If Authorization header present, validates JWT and ensures the
//     authenticated user's own referrer_code != the submitted code.
//   - Sentinel Rec #3: No direct client writes; all mutations gated here.
//   - Production: CORS, structured error responses, no PII leakage,
//     idempotency-friendly (unique constraint will reject dups),
//     detailed but safe logging.
//
// USAGE (from client via supabase.functions.invoke):
//   const { data, error } = await supabase.functions.invoke('record-referral', {
//     body: { referrerCode: 'ABC123XY', turnstileToken: '...' }
//   });
//
// REQUIRED SECRETS (set via `supabase secrets set` or dashboard):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY
//   TURNSTILE_SECRET_KEY   (from Cloudflare Turnstile dashboard)
//
// Deploy: supabase functions deploy record-referral
// Local test: supabase functions serve --env-file .env
// ============================================================================

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ---------------------------------------------------------------------------
// CORS headers (production-ready, compatible with supabase-js invoke)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// ---------------------------------------------------------------------------
// Helper: Extract real client IP (Cloudflare + Supabase proxy chain)
function getClientIp(req: Request): string {
  // Cloudflare sets this reliably on Supabase Edge
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  // Fallback: x-forwarded-for (may contain multiple IPs, take first = original client)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Last resort (should never happen in production)
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Helper: Perform Cloudflare Turnstile verification (official recommended pattern)
async function verifyTurnstile(token: string, ip: string): Promise<{ success: boolean; error?: string }> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('[record-referral] TURNSTILE_SECRET_KEY not configured in Supabase secrets');
    return { success: false, error: 'Server configuration error' };
  }

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip && ip !== 'unknown') {
    formData.append('remoteip', ip);
  }

  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const outcome = await result.json();
    console.log('[record-referral] Turnstile outcome:', JSON.stringify(outcome));

    if (outcome.success === true) {
      return { success: true };
    }

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

// ---------------------------------------------------------------------------
// Main Edge Function handler
Deno.serve(async (req: Request) => {
  // CORS preflight (browser safety)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only POST allowed (Sentinel: strict method enforcement)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let referrerCode: string;
  let turnstileToken: string;

  // Parse & validate body
  try {
    const body = await req.json();
    referrerCode = (body.referrerCode || body.referrer_code || '').toString().trim().toUpperCase();
    turnstileToken = (body.turnstileToken || body.token || '').toString().trim();

    if (!referrerCode || referrerCode.length < 4) {
      throw new Error('Missing or invalid referrerCode');
    }
    if (!turnstileToken) {
      throw new Error('Missing turnstileToken');
    }
  } catch (parseErr) {
    console.warn('[record-referral] Invalid request body:', parseErr);
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid request payload' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  console.log(`[record-referral] Request received: code=${referrerCode}, ip=${ip}`);

  // -------------------------------------------------------------------------
  // 1. Turnstile verification (Sentinel Rec #6 - bot protection)
  const turnstileResult = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileResult.success) {
    return new Response(
      JSON.stringify({ success: false, error: 'Bot verification failed', details: turnstileResult.error }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // -------------------------------------------------------------------------
  // 2. IP Rate Limiting (Sentinel Rec #6)
  //    Simple, stateless, DB-backed using service_role.
  //    Limit: max 3 referral attempts per IP in last 60 seconds.
  const RATE_LIMIT_WINDOW_MS = 60_000;
  const RATE_LIMIT_MAX = 3;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  try {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

    const { count, error: rateError } = await supabaseAdmin
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gte('created_at', windowStart);

    if (rateError) {
      console.error('[record-referral] Rate limit query error:', rateError);
      // Fail open on query error (but log) — production may choose fail-closed
    } else if ((count ?? 0) >= RATE_LIMIT_MAX) {
      console.warn(`[record-referral] Rate limit exceeded for IP ${ip} (${count} attempts)`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please wait before trying again.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (rateErr) {
    console.error('[record-referral] Rate limiting exception:', rateErr);
  }

  // -------------------------------------------------------------------------
  // 3. Self-referral prevention (Sentinel Rec #5)
  //    Uses Authorization header if present (JWT from supabase-js client)
  let authenticatedUserId: string | null = null;
  const authHeader = req.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false },
        }
      );

      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (!userError && user) {
        authenticatedUserId = user.id;

        // Fetch the user's own profile referrer_code
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('referrer_code, id')
          .eq('id', user.id)
          .single();

        if (!profileError && profile && profile.referrer_code === referrerCode) {
          console.warn(`[record-referral] Self-refer attempt blocked for user ${user.id}`);
          return new Response(
            JSON.stringify({ success: false, error: 'Self-referral is not allowed.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (authErr) {
      // Non-fatal: continue as anonymous referral record
      console.log('[record-referral] Auth check skipped (no valid session):', authErr);
    }
  }

  // -------------------------------------------------------------------------
  // 4. Validate referrer_code exists (via admin - RLS bypass)
  const { data: refProfile, error: refError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('referrer_code', referrerCode)
    .single();

  if (refError || !refProfile) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid referrer code' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // -------------------------------------------------------------------------
  // 5. Insert referral record (service_role only - Sentinel Rec #2)
  //    Trigger (prevent_self_referral_and_populate + handle_new_referral_increment)
  //    will enforce additional checks + increment counters atomically.
  const insertPayload: any = {
    referrer_code: referrerCode,
    ip_address: ip,
    user_agent: userAgent,
    // referred_user_id left null for now (can be linked later on profile creation if needed)
  };

  // If we have an authenticated referred user, record it (improves analytics)
  if (authenticatedUserId) {
    insertPayload.referred_user_id = authenticatedUserId;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('referrals')
    .insert(insertPayload)
    .select('id, created_at')
    .single();

  if (insertError) {
    // Handle unique constraint violation gracefully (duplicate referral)
    if (insertError.code === '23505') {
      return new Response(
        JSON.stringify({ success: true, message: 'Referral already recorded', duplicate: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('[record-referral] Insert failed:', insertError);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to record referral' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[record-referral] SUCCESS: referral ${inserted.id} recorded for code ${referrerCode}`);

  // Success response (client can proceed to show success / increment local UI)
  return new Response(
    JSON.stringify({
      success: true,
      referralId: inserted.id,
      recordedAt: inserted.created_at,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
