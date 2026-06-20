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
    const eventName = String(body.eventName || body.event_name || '').trim();
    if (!eventName) {
      return new Response(JSON.stringify({ success: false, error: 'eventName required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const row = {
      event_name: eventName.slice(0, 80),
      utm_campaign: body.utm_campaign || body.utmCampaign || null,
      utm_content: body.utm_content || body.utmContent || null,
      utm_medium: body.utm_medium || body.utmMedium || null,
      ref_code: body.ref_code || body.refCode || null,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      created_at: body.timestamp || new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('reddit_events').insert(row);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[record-reddit-event] error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Logged server-side' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});