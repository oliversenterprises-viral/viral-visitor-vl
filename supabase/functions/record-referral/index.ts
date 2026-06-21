// ============================================================================
// supabase/functions/record-referral/index.ts
// ViralRefer — Record Referral (production schema aligned)
// ============================================================================
//
// Production referrals table (wqbefjzpgsezzwdrvvua):
//   id, referrer_code, referred_email, referred_ip, user_agent, created_at
// Client-generated codes (VIRAL-XXXX) are valid without a profiles row.
//
// Deploy: supabase functions deploy record-referral
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const REFERRER_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{3,19}$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function normalizeReferrerCode(raw: unknown): string {
  return String(raw || '').trim().toUpperCase();
}

export function isValidReferrerCode(code: string): boolean {
  return REFERRER_CODE_RE.test(code);
}

function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let referrerCode: string;
  let turnstileToken: string;
  let referredCode: string | null = null;

  try {
    const body = await req.json();
    referrerCode = normalizeReferrerCode(body.referrerCode || body.referrer_code);
    turnstileToken = String(body.turnstileToken || body.token || '').trim();
    const rawReferred = body.referredCode || body.referred_code || body.visitorCode || null;
    referredCode = rawReferred ? normalizeReferrerCode(rawReferred) : null;

    if (!isValidReferrerCode(referrerCode)) {
      throw new Error('Missing or invalid referrerCode');
    }
    if (!turnstileToken) {
      throw new Error('Missing turnstileToken');
    }
  } catch (parseErr) {
    console.warn('[record-referral] Invalid request body:', parseErr);
    return new Response(JSON.stringify({ success: false, error: 'Invalid request payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (referredCode && referredCode === referrerCode) {
    return new Response(JSON.stringify({ success: false, error: 'Self-referral is not allowed.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  console.log(`[record-referral] code=${referrerCode}, ip=${ip}`);

  const turnstileResult = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileResult.success) {
    return new Response(
      JSON.stringify({ success: false, error: 'Bot verification failed', details: turnstileResult.error }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: rateError } = await supabaseAdmin
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referred_ip', ip)
      .gte('created_at', windowStart);

    if (rateError) {
      console.error('[record-referral] Rate limit query error:', rateError);
    } else if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded. Please wait before trying again.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (rateErr) {
    console.error('[record-referral] Rate limiting exception:', rateErr);
  }

  if (ip !== 'unknown') {
    const dedupeStart = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    const { data: existing, error: dedupeError } = await supabaseAdmin
      .from('referrals')
      .select('id, created_at')
      .eq('referrer_code', referrerCode)
      .eq('referred_ip', ip)
      .gte('created_at', dedupeStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dedupeError) {
      console.error('[record-referral] Dedupe query error:', dedupeError);
    } else if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Referral already recorded',
          duplicate: true,
          referralId: existing.id,
          recordedAt: existing.created_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  const insertPayload = {
    referrer_code: referrerCode,
    referred_ip: ip === 'unknown' ? null : ip,
    user_agent: userAgent || null,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('referrals')
    .insert(insertPayload)
    .select('id, created_at')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return new Response(JSON.stringify({ success: true, message: 'Referral already recorded', duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.error('[record-referral] Insert failed:', insertError);
    return new Response(JSON.stringify({ success: false, error: 'Failed to record referral' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[record-referral] SUCCESS: ${inserted.id} for ${referrerCode}`);

  return new Response(
    JSON.stringify({
      success: true,
      referralId: inserted.id,
      recordedAt: inserted.created_at,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});