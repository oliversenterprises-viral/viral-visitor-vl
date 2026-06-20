// ============================================================================
// supabase/functions/record-banner-event/index.ts
// Public (low-privilege) Edge to log banner impressions/clicks server-side.
// Called from public site (content.ts) in addition to (or replacing) localStorage.
// Uses service_role for insert. Can add Turnstile/rate limit later.
// Returns quickly; fire-and-forget from client.
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
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const { type, label, redirectUrl, key, timestamp } = body;

    if (!type || !['impression', 'click'].includes(type)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = {
      type,
      label: label || 'untitled',
      redirect_url: redirectUrl || null,
      key: key || null,
      created_at: timestamp || new Date().toISOString(),
      metadata: { source: 'public-client' }
    };

    const { error } = await supabaseAdmin
      .from('banner_events')
      .insert(event);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    // Log but don't fail the public render
    console.error('[record-banner-event] error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Logged server-side' }), {
      status: 200, // Still 200 so client doesn't break
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
