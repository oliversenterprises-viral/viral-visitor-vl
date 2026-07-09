// ============================================================================
// supabase/functions/submit-claim/index.ts
// ViralRefer Premium — Production Edge Function: Submit Prize Claim
// Server-side #1 verification with test-traffic filters + safe response path
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { computeClaimLeader, isSafeHttpUrl } from '../_shared/claim-leader.ts';

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

function allowDevTurnstileBypass(): boolean {
  return Deno.env.get('ALLOW_TURNSTILE_DEV_BYPASS') === 'true';
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

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const turnstileToken = String(payload.turnstileToken ?? '');
  const website = payload.website != null ? String(payload.website) : '';
  const cashtag = payload.cashtag != null ? String(payload.cashtag) : '';
  const message = payload.message != null ? String(payload.message) : '';
  const bodyReferrerCode = payload.referrerCode != null ? String(payload.referrerCode) : '';

  if (!turnstileToken) {
    return new Response(JSON.stringify({ success: false, error: 'Missing turnstileToken' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Homepage feature claim — website required (no cash prize on public product)
  const websiteTrim = website.trim();
  // Ignore leftover cashtag payloads from old clients
  void cashtag;
  if (!websiteTrim) {
    return new Response(JSON.stringify({ success: false, error: 'Website is required for homepage feature claim' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!isSafeHttpUrl(websiteTrim)) {
    return new Response(JSON.stringify({ success: false, error: 'Website must be a valid http(s) URL' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (message.trim().length > 2000) {
    return new Response(JSON.stringify({ success: false, error: 'Message too long' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip = getClientIp(req);

  // Turnstile: real tokens always verified. dev-bypass-token only when explicitly enabled (local/staging).
  if (turnstileToken === 'dev-bypass-token') {
    if (!allowDevTurnstileBypass()) {
      return new Response(JSON.stringify({ success: false, error: 'Bot check failed' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
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

  // SERVER-SIDE TOP-1: prefer get_leaderboard RPC (same filters/tie-break as public board)
  let topReferrerCode = '';
  let topCount = 0;
  let counts: Record<string, number> = {};

  const { data: board, error: boardErr } = await supabaseAdmin.rpc('get_leaderboard', {
    min_referrals: 1,
  });

  if (!boardErr && Array.isArray(board) && board.length > 0) {
    for (const row of board as { referrer_code?: string; referral_count?: number; rank?: number }[]) {
      const code = String(row.referrer_code || '').trim();
      const cnt = Number(row.referral_count) || 0;
      if (code) counts[code] = cnt;
      if (Number(row.rank) === 1 || (!topReferrerCode && code)) {
        topReferrerCode = code;
        topCount = cnt;
      }
    }
    // Ensure rank-1 is authoritative
    const rank1 = (board as { referrer_code?: string; referral_count?: number; rank?: number }[])
      .find((r) => Number(r.rank) === 1);
    if (rank1?.referrer_code) {
      topReferrerCode = String(rank1.referrer_code).trim();
      topCount = Number(rank1.referral_count) || 0;
    }
  } else {
    // Fallback: in-memory aggregate (small DBs / RPC unavailable)
    const { data: topRows, error: topErr } = await supabaseAdmin
      .from('referrals')
      .select('referrer_code, referred_ip, user_agent, created_at')
      .order('created_at', { ascending: true })
      .limit(5000);

    if (topErr || !topRows || topRows.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No referrals yet' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const leader = computeClaimLeader(topRows);
    if (!leader) {
      return new Response(JSON.stringify({ success: false, error: 'No eligible referrals yet' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    topReferrerCode = leader.topReferrerCode;
    topCount = leader.topCount;
    counts = leader.counts;
  }

  if (!topReferrerCode || topCount <= 0) {
    return new Response(JSON.stringify({ success: false, error: 'No eligible referrals yet' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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

  const { data: newClaim, error: insertErr } = await supabaseAdmin
    .from('prize_claims')
    .insert({
      referrer_code: userReferrerCode,
      user_id: claimUserId,
      website: websiteTrim || null,
      cashtag: null, // cash removed from public product
      message: message.trim() || null,
      status: 'pending',
      rank_at_claim: 1,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) {
    // Unique violation = concurrent double-submit (if partial unique index applied)
    if ((insertErr as { code?: string }).code === '23505') {
      return new Response(JSON.stringify({ success: false, error: 'You already have an active claim' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('Claim insert failed:', insertErr);
    return new Response(JSON.stringify({ success: false, error: 'Failed to submit claim' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[submit-claim] Claim created id=${newClaim.id} referrer=${userReferrerCode}`);

  return new Response(JSON.stringify({
    success: true,
    claimId: newClaim.id,
    rank: 1,
    referralCount: topCount,
    message: 'Claim submitted successfully. We will review within 48 hours.',
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
