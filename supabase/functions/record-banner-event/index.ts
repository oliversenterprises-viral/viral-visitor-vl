// ============================================================================
// supabase/functions/record-banner-event/index.ts
// Public Edge — log banner impressions/clicks server-side.
// Tries prod, legacy (0006), and premium (banner_key) insert shapes.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const type = String(body.type || body.event_type || '').toLowerCase();

    if (!type || !['impression', 'click'].includes(type)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const label = String(body.label || body.banner_label || 'untitled').slice(0, 200);
    const redirectUrl = body.redirectUrl || body.redirect_url || null;
    const stableKey = body.key || (label && redirectUrl ? `${label}|${redirectUrl}` : null);
    const timestamp = body.timestamp || new Date().toISOString();
    const userAgent = body.user_agent || body.userAgent || req.headers.get('user-agent') || null;
    const ip =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      null;

    const attempts: Record<string, unknown>[] = [
      {
        event_type: type,
        banner_label: label,
        redirect_url: redirectUrl,
        source: 'client',
        page_path: body.page_path || body.pagePath || null,
        referrer: body.referrer || null,
        user_agent: userAgent,
        ip,
        additional: {
          key: stableKey,
          client_source: 'record-banner-event',
          ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
        },
        created_at: timestamp,
      },
      {
        type,
        label,
        redirect_url: redirectUrl,
        key: stableKey,
        created_at: timestamp,
        metadata: {
          source: 'public-client',
          client_source: 'record-banner-event',
          key: stableKey,
        },
      },
      {
        type,
        banner_key: stableKey || 'unknown',
        label,
        redirect_url: redirectUrl,
        created_at: timestamp,
        ip_address: ip,
        user_agent: userAgent,
        metadata: {
          source: 'public-client',
          client_source: 'record-banner-event',
          key: stableKey,
        },
      },
    ];

    let lastError: { message?: string } | null = null;
    for (const row of attempts) {
      const { error } = await supabaseAdmin.from('banner_events').insert(row);
      if (!error) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      lastError = error;
      console.error('[record-banner-event] insert failed:', error.message);
    }

    throw lastError;
  } catch (err) {
    console.error('[record-banner-event] error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Logged server-side' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});