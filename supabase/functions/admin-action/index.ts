// ============================================================================
// supabase/functions/admin-action/index.ts
// ViralRefer Premium — Admin-only actions (claim status, content editing, analytics)
// Phase 1 Bridge: Enforces x-admin-secret header (constant-time comparison)
// Production-ready — no bypass, no placeholders, no TODOs
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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

  // Bridge auth: require the shared admin secret header (Phase 1)
  const adminSecretHeader = req.headers.get('x-admin-secret') || '';
  const expectedSecret = Deno.env.get('ADMIN_ACTION_SECRET') || '';

  if (!expectedSecret || !timingSafeEqual(adminSecretHeader, expectedSecret)) {
    return new Response(JSON.stringify({ success: false, error: 'Admin privileges required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Future-proof skeleton retained (JWT path will be activated in Phase 2)
  const authHeader = req.headers.get('Authorization');

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const body = await req.json();
  const { action, payload } = body;

  try {
    if (action === 'update_claim_status') {
      const { claimId, status, note } = payload;
      const { error } = await supabaseAdmin
        .from('prize_claims')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          review_note: note || null,
        })
        .eq('id', claimId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_claims') {
      // Service role read so password-based admin (no real user session) and owner tools both see the full list (pending + all statuses)
      // Bypasses RLS select_own / public-approved-only policies for admin visibility.
      const { data, error } = await supabaseAdmin
        .from('prize_claims')
        .select('id, created_at, referrer_code, website, cashtag, message, status, paid_at, review_note, reviewed_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'update_site_content') {
      const { key, value } = payload;
      const { error } = await supabaseAdmin
        .from('site_content')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_shares') {
      // Full read for admin analytics — uses service_role to bypass user RLS
      const { data, error } = await supabaseAdmin
        .from('shares')
        .select('platform, referral_link, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(20000);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_banner_stats') {
      const { data, error } = await supabaseAdmin
        .from('banner_events')
        .select('type, label, redirect_url, key, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Action failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});