// ============================================================================
// supabase/functions/record-share/index.ts
// Public Edge — log social share / copy events for Admin → Share Analytics.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REF_CODE_FROM_LINK_RE = /\/r\/([A-Za-z0-9_-]+)/i;

function normalizePlatform(raw: string): string {
  const p = String(raw || 'other').toLowerCase().trim();
  if (p === 'x') return 'twitter';
  return p || 'other';
}

function extractReferrerCode(link: string, explicit?: string): string | null {
  const code = String(explicit || '').trim();
  if (code && code.toLowerCase() !== 'unknown') return code.toUpperCase();
  const match = String(link || '').match(REF_CODE_FROM_LINK_RE);
  return match?.[1] ? match[1].toUpperCase() : null;
}

function normalizeAbVariant(raw: unknown): string | null {
  const v = String(raw || '').toLowerCase().trim();
  return v === 'a' || v === 'b' ? v : null;
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

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const body = await req.json();
    const platform = normalizePlatform(body.platform);
    const referral_link = String(body.referral_link || body.referralLink || '').slice(0, 500);
    const referrer_code = extractReferrerCode(referral_link, body.referrer_code || body.referrerCode);

    if (!referral_link || !referrer_code) {
      return new Response(JSON.stringify({ success: false, error: 'Missing referral link or code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const created_at = body.timestamp || new Date().toISOString();
    const ab_variant = normalizeAbVariant(body.ab_variant || body.abVariant);
    const attempts: Record<string, unknown>[] = [
      ...(ab_variant
        ? [{ platform, referrer_code, referral_link, ab_variant, created_at }]
        : []),
      { platform, referrer_code, referral_link, created_at },
      { platform, referrer_code, created_at },
      { platform, referral_link, created_at },
    ];

    let lastError: { message?: string; code?: string } | null = null;
    for (const row of attempts) {
      const { error } = await supabaseAdmin.from('shares').insert(row);
      if (!error) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      lastError = error;
      console.warn('[record-share] insert attempt failed:', error.message, Object.keys(row));
    }

    throw lastError || new Error('All share insert attempts failed');
  } catch (err) {
    console.error('[record-share] error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Logged server-side' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});