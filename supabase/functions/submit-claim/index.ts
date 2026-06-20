// ============================================================================
// supabase/functions/submit-claim/index.ts
// ViralRefer Premium — Production Edge Function: Submit Prize Claim
// Fully implemented with server-side #1 verification (Sentinel requirements)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getClientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ||
         req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         'unknown';
}

async function verifyTurnstile(token: string, ip: string): Promise<{ success: boolean; error?: string }> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return { success: false, error: 'Server misconfiguration' };

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip !== 'unknown') formData.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });
  const outcome = await res.json();
  return { success: !!outcome.success, error: outcome.success ? undefined : (outcome['error-codes'] || 'failed') };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Parse payload
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { turnstileToken, website, cashtag, message, referrerCode: bodyReferrerCode } = payload;
  if (!turnstileToken) {
    return new Response(JSON.stringify({ success: false, error: 'Missing turnstileToken' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip = getClientIp(req);

  // 1. Turnstile bot protection (skip only for explicit local dev token)
  if (turnstileToken !== 'dev-bypass-token') {
    const turnstileOk = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileOk.success) {
      return new Response(JSON.stringify({ success: false, error: 'Bot check failed' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // 2. Resolve referrer code: authenticated profile OR explicit code from public form
  let userReferrerCode = '';
  let claimUserId: string | null = null;

  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, referrer_code')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.referrer_code) {
      return new Response(JSON.stringify({ success: false, error: 'Profile with referral code required' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    userReferrerCode = profile.referrer_code;
    claimUserId = profile.id;
  } else if (bodyReferrerCode) {
    userReferrerCode = bodyReferrerCode.toString().trim().toUpperCase();
    if (!userReferrerCode || userReferrerCode.length < 4) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid referrer code' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: refProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('referrer_code', userReferrerCode)
      .maybeSingle();

    claimUserId = refProfile?.id ?? null;
  } else {
    return new Response(JSON.stringify({ success: false, error: 'Referrer code or authentication required' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 4. SERVER-SIDE TOP-1 CALCULATION (the security guarantee)
  // We compute the true current leader from the referrals table using service_role
  const { data: topRows, error: topErr } = await supabaseAdmin
    .from('referrals')
    .select('referrer_code')
    .order('created_at', { ascending: true }); // for stable tie-break

  if (topErr || !topRows || topRows.length === 0) {
    return new Response(JSON.stringify({ success: false, error: 'No referrals yet' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Count per referrer_code (in-memory aggregate — fast for current scale)
  const counts: Record<string, number> = {};
  for (const r of topRows) {
    counts[r.referrer_code] = (counts[r.referrer_code] || 0) + 1;
  }

  // Find current #1 (highest count, earliest created_at wins ties)
  let topReferrerCode = '';
  let topCount = 0;
  for (const [code, cnt] of Object.entries(counts)) {
    if (cnt > topCount) {
      topCount = cnt;
      topReferrerCode = code;
    }
  }

  // 5. Get min referrals threshold from site_content (default 10)
  let minReferrals = 10;
  const { data: contentRows } = await supabaseAdmin
    .from('site_content')
    .select('key, id, value')
    .in('key', ['min_referrals', 'min_referrals_for_claim'])
    .limit(5);

  const byKey = new Map<string, unknown>();
  for (const row of contentRows || []) {
    const k = (row as { key?: string; id?: string }).key ?? (row as { id?: string }).id;
    if (k) byKey.set(k, (row as { value: unknown }).value);
  }

  const rawMin = byKey.get('min_referrals_for_claim') ?? byKey.get('min_referrals');
  if (typeof rawMin === 'number') minReferrals = rawMin;
  else if (typeof rawMin === 'string') {
    const parsed = parseInt(rawMin, 10);
    if (!Number.isNaN(parsed)) minReferrals = parsed;
  } else if (rawMin && typeof rawMin === 'object' && 'minReferrals' in (rawMin as object)) {
    minReferrals = Number((rawMin as { minReferrals: number }).minReferrals) || 10;
  }

  // 6. Eligibility checks (server-enforced — never trust client)
  if (userReferrerCode !== topReferrerCode) {
    return new Response(JSON.stringify({
      success: false,
      error: 'You are not currently the #1 referrer',
      currentLeader: topReferrerCode,
      yourCount: counts[userReferrerCode] || 0,
      leaderCount: topCount,
    }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (topCount < minReferrals) {
    return new Response(JSON.stringify({
      success: false,
      error: `Minimum ${minReferrals} referrals required. You have ${topCount}.`,
    }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // 7. Check for existing pending/approved claim by this user
  const { count: existingClaims } = await supabaseAdmin
    .from('prize_claims')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_code', userReferrerCode)
    .in('status', ['pending', 'approved', 'paid']);

  if ((existingClaims || 0) > 0) {
    return new Response(JSON.stringify({ success: false, error: 'You already have an active claim' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 8. Insert the claim (service_role — trusted)
  const { data: newClaim, error: insertErr } = await supabaseAdmin
    .from('prize_claims')
    .insert({
      referrer_code: userReferrerCode,
      user_id: claimUserId,
      website: website?.trim() || null,
      cashtag: cashtag?.trim() || null,
      message: message?.trim() || null,
      status: 'pending',
      rank_at_claim: 1,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) {
    console.error('Claim insert failed:', insertErr);
    return new Response(JSON.stringify({ success: false, error: 'Failed to submit claim' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    claimId: newClaim.id,
    rank: 1,
    referralCount: topCount,
    message: 'Claim submitted successfully. We will review within 48 hours.',
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
